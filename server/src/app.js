import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import multer from "multer";
import { uploadFileToPinata, unpinFileFromPinata } from "./ipfs.js";
import os from "os";
import fs from "fs";
import path from "path";
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

// Multer setup (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

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
    return res.status(503).json({ error: 'Doc chatbot disabled. Provide GEMINI_API_KEY on the server.' })
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
    return res.status(503).json({ error: 'Doc chatbot disabled. Provide GEMINI_API_KEY on the server.' })
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
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filename = req.file.originalname;
      const size = req.file.size;
      // Save buffer to temp file
      const tempPath = path.join(os.tmpdir(), `${Date.now()}_${filename}`);
      await fs.promises.writeFile(tempPath, req.file.buffer);

      // Upload to Pinata
      const upload = await uploadFileToPinata(tempPath);
      // Remove temp file
      await fs.promises.unlink(tempPath);

      // Pinata returns an object with ipfsHash (CID)
      const cid = upload.ipfsHash || upload.IpfsHash || upload.cid || upload.CID || upload.hash;
      if (!cid) {
        return res.status(500).json({ error: "Pinata upload failed", details: upload });
      }

      await query(
        "INSERT INTO files (filename, cid, size) VALUES ($1, $2, $3)",
        [filename, cid, size]
      );

      res.status(201).json({ filename, cid, size });
    } catch (err) {
      next(err);
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
    if (registry) {
      const checked = await Promise.all(
        rows.map(async (f) => {
          try {
            const owner = await registry.getOwner(f.cid);
            return owner && owner !== ethers.ZeroAddress ? f : null;
          } catch {
            return null;
          }
        })
      );
      filtered = checked.filter(Boolean);
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
  // Unpin from Pinata
    try {
      await unpinFileFromPinata(cid);
    } catch (unpinErr) {
      console.error('Pinata unpin error:', unpinErr);
      return res.status(500).json({ error: 'Pinata unpin failed', details: unpinErr && unpinErr.message ? unpinErr.message : unpinErr });
    }
    // Remove from database
    await query('DELETE FROM files WHERE cid = $1', [cid]);
    res.json({ success: true, cid });
  } catch (err) {
    next(err);
  }
});

