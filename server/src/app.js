import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import multer from "multer";
import { uploadFileToPinata, unpinFileFromPinata } from "./ipfs.js";
import os from "os";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
// import { create as createIpfsClient } from 'ipfs-http-client';
import { ensureSchema, query } from "./db.js";
import { ethers } from 'ethers';
import { answerDocQuestion, refreshDocIndex, docBotEnabled } from './docbot.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(process.cwd(), ".env")
];
for (const envPath of envCandidates) {
  dotenv.config({ path: envPath, override: false });
}

const app = express();
const port = Number(process.env.PORT || 4000);
const apiBasePath = process.env.API_BASE_PATH || "/api";
// Registry filter modes:
//  - "strict" (default): only return rows that are confirmed on-chain
//  - "soft": try on-chain first, but if nothing resolves, return DB rows
//  - "off": skip on-chain filtering entirely
const registryFilterMode = (process.env.REGISTRY_FILTER_MODE || 'soft').toLowerCase();

// On-chain registry (for filtering only)
let registry = null;
async function initRegistry() {
  try {
    const rpc = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpc);
    const pk = process.env.SERVER_PRIVATE_KEY;
    const address = process.env.CONTRACT_ADDRESS;
    if (!address) {
      console.warn('CONTRACT_ADDRESS not set; registry filtering disabled');
      return;
    }
    if (!pk) {
      console.warn('SERVER_PRIVATE_KEY not set; registry reads will use public provider only');
    }
    const wallet = pk ? new ethers.Wallet(pk, provider) : provider;
    const abi = [
      'function getOwner(string cid) view returns (address)',
      'function transferOwnership(string cid, address newOwner)'
    ];
    registry = new ethers.Contract(address, abi, wallet);
    console.log('Registry initialized at', address);
  } catch (e) {
    console.error('Failed to init registry', e);
  }
}

app.use(morgan("dev"));
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
    credentials: true,
  })
);

// Use dynamic IPFS client with Infura fallback to local node
// See ./ipfs.js for logic

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

// Multer setup (memory storage, size-limited)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

// API index and health check
app.get(`${apiBasePath}`, (req, res) => {
  res.json({
    ok: true,
    message: "blockFiles API",
    endpoints: {
      health: `${apiBasePath}/health`,
      upload: `${apiBasePath}/upload`,
      listFiles: `${apiBasePath}/files`,
      deleteFile: `${apiBasePath}/files/:cid`,
      docChat: `${apiBasePath}/chat/docbot`,
      docChatReindex: `${apiBasePath}/chat/docbot/reindex`
    }
  });
});
// Friendly message at root of backend server
app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <body style="font-family: sans-serif;">
        <h3>blockFiles backend</h3>
        <p>This server only serves API endpoints.</p>
        <p>Visit <a href="${apiBasePath}">${apiBasePath}</a> for API index.</p>
      </body>
    </html>
  `);
});
app.get(`${apiBasePath}/health`, async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB not reachable" });
  }
});

app.post(`${apiBasePath}/chat/docbot`, async (req, res) => {
  if (!docBotEnabled()) {
    return res.status(503).json({ error: 'Doc chatbot disabled. Provide OPENROUTER_API_KEY on the server.' })
  }
  const { message, history = [], refresh = false } = req.body || {}
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' })
  }
  try {
    if (refresh) await refreshDocIndex()
    const result = await answerDocQuestion({ question: message, history })
    res.json(result)
  } catch (err) {
    console.error('Doc chatbot request failed', err)
    res.status(500).json({ error: 'Doc chatbot failed', details: err.message })
  }
})

app.post(`${apiBasePath}/chat/docbot/reindex`, async (req, res) => {
  if (!docBotEnabled()) {
    return res.status(503).json({ error: 'Doc chatbot disabled. Provide OPENROUTER_API_KEY on the server.' })
  }
  try {
    const result = await refreshDocIndex()
    res.json(result)
  } catch (err) {
    console.error('Doc chatbot reindex failed', err)
    res.status(500).json({ error: 'Doc chatbot reindex failed', details: err.message })
  }
})

// (Legacy meta-transaction routes removed; all actions now require direct wallet transactions.)

// Upload endpoint
app.post(
  `${apiBasePath}/upload`,
  upload.single("file"),
  async (req, res, next) => {
    let tempPath = null;
    let cid = null;
    let dbSaved = false;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filename = req.file.originalname;
      const size = req.file.size;
      const safeFilename = path
        .basename(filename || "upload.bin")
        .replace(/[^a-zA-Z0-9._() -]/g, "_")
        .slice(-80);

      // Save buffer to temp file
      tempPath = path.join(
        os.tmpdir(),
        `blockfiles_${Date.now()}_${process.pid}_${randomUUID()}_${safeFilename}`
      );
      await fs.promises.writeFile(tempPath, req.file.buffer);

      // Upload to Pinata
      const pinataUpload = await uploadFileToPinata(tempPath);

      // Pinata returns an object with ipfsHash (CID)
      cid =
        pinataUpload.ipfsHash ||
        pinataUpload.IpfsHash ||
        pinataUpload.cid ||
        pinataUpload.CID ||
        pinataUpload.hash;
      if (!cid) {
        return res.status(500).json({ error: "Pinata upload failed", details: pinataUpload });
      }

      const insertResult = await query(
        `INSERT INTO files (filename, cid, size)
         VALUES ($1, $2, $3)
         ON CONFLICT (cid) DO NOTHING
         RETURNING id, filename, cid, size, upload_date`,
        [filename, cid, size]
      );
      dbSaved = true;
      let row = insertResult.rows[0];
      let created = true;
      if (!row) {
        created = false;
        const updateResult = await query(
          `UPDATE files
           SET filename = $1,
               size = $3,
               upload_date = CURRENT_TIMESTAMP
           WHERE cid = $2
           RETURNING id, filename, cid, size, upload_date`,
          [filename, cid, size]
        );
        row = updateResult.rows[0];
      }
      if (!row) {
        throw new Error("Failed to persist file metadata");
      }

      res.status(201).json({
        id: row.id,
        filename: row.filename,
        cid: row.cid,
        size: row.size,
        upload_date: row.upload_date,
        created,
      });
    } catch (err) {
      next(err);
    } finally {
      if (tempPath) {
        try {
          await fs.promises.unlink(tempPath);
        } catch (cleanupErr) {
          if (cleanupErr.code !== "ENOENT") {
            console.warn("Temp upload cleanup failed:", cleanupErr.message);
          }
        }
      }

      if (cid && !dbSaved) {
        // Best-effort compensation: avoid orphaning fresh pins when DB persist fails.
        try {
          const exists = await query("SELECT 1 FROM files WHERE cid = $1 LIMIT 1", [cid]);
          if (!exists.rowCount) {
            await unpinFileFromPinata(cid);
          }
        } catch (rollbackErr) {
          console.error("Failed to compensate pin after DB error:", rollbackErr.message || rollbackErr);
        }
      }
    }
  }
);

// List files metadata
app.get(`${apiBasePath}/files`, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, filename, cid, size, upload_date FROM files ORDER BY upload_date DESC"
    );

    // Enforce on-chain registration: only return files that are registered in the contract
    let filtered = rows;
    if (registry && registryFilterMode !== 'off') {
      const checked = await Promise.all(
        rows.map(async (f) => {
          try {
            const owner = await registry.getOwner(f.cid);
            return owner && owner !== ethers.ZeroAddress ? f : null;
          } catch (err) {
            console.warn('Registry check failed for', f.cid, err.message);
            return null;
          }
        })
      );
      const onChainRows = checked.filter(Boolean);

      if (registryFilterMode === 'strict') {
        filtered = onChainRows;
      } else {
        // Soft mode: if on-chain data is empty (e.g., after local chain reset), fall back to DB rows
        const dropped = rows.length - onChainRows.length;
        if (dropped && !onChainRows.length) {
          console.warn('Registry returned no owners; returning DB rows because REGISTRY_FILTER_MODE=soft');
          filtered = rows;
        } else {
          filtered = onChainRows;
        }
      }
    }

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Fetch file by CID

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(413)
        .json({ error: `File too large. Max upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.` });
    }
    return res.status(400).json({ error: err.message || "Upload error" });
  }

  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start
(async function start() {
  try {
    await ensureSchema();
    await initRegistry();
    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}${apiBasePath}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
})();

// Delete file by CID
app.delete(`${apiBasePath}/files/:cid`, async (req, res, next) => {
  try {
    const { cid } = req.params;
    const deleted = await query(
      "DELETE FROM files WHERE cid = $1 RETURNING filename, cid, size, upload_date",
      [cid]
    );
    if (!deleted.rowCount) {
      return res.status(404).json({ error: "File not found", cid });
    }

    // Unpin from Pinata. If this fails, restore DB metadata so state remains consistent.
    try {
      await unpinFileFromPinata(cid);
    } catch (unpinErr) {
      const row = deleted.rows[0];
      try {
        await query(
          "INSERT INTO files (filename, cid, size, upload_date) VALUES ($1, $2, $3, $4) ON CONFLICT (cid) DO NOTHING",
          [row.filename, row.cid, row.size, row.upload_date]
        );
      } catch (restoreErr) {
        console.error("Failed to restore file metadata after unpin failure:", restoreErr);
      }
      console.error("Pinata unpin error:", unpinErr);
      return res.status(502).json({
        error: "Pinata unpin failed",
        details: unpinErr && unpinErr.message ? unpinErr.message : unpinErr,
      });
    }

    res.json({ success: true, cid });
  } catch (err) {
    next(err);
  }
});

