import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import multer from "multer";
import { getIpfsClient, uploadFileToPinata, unpinFileFromPinata } from "./ipfs.js";
import os from "os";
import fs from "fs";
import path from "path";
import metaTxRouter from "./metaTx.js";
// import { create as createIpfsClient } from 'ipfs-http-client';
import { ensureSchema, query } from "./db.js";
import { ethers } from 'ethers';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const apiBasePath = process.env.API_BASE_PATH || "/api";

// On-chain registry (for filtering + gasless transfers)
let registry = null;
async function initRegistry() {
  try {
    const rpc = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const provider = new ethers.JsonRpcProvider(rpc);
    const pk = process.env.SERVER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY; // reuse relayer key if provided
    const address = process.env.CONTRACT_ADDRESS;
    if (!address) {
      console.warn('CONTRACT_ADDRESS not set; registry filtering and gasless transfer disabled');
      return;
    }
    if (!pk) {
      console.warn('SERVER_PRIVATE_KEY / RELAYER_PRIVATE_KEY not set; gasless transfer disabled');
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
app.use(`${apiBasePath}`, metaTxRouter);
app.get(`${apiBasePath}`, (req, res) => {
  res.json({
    ok: true,
    message: "blockFiles API",
    endpoints: {
      health: `${apiBasePath}/health`,
      upload: `${apiBasePath}/upload`,
      listFiles: `${apiBasePath}/files`,
      deleteFile: `${apiBasePath}/files/:cid`,
      metaTx: `${apiBasePath}/meta-tx`,
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

// (Removed legacy signature-based gasless ownership transfer route: contract lacks meta execution logic)

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

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const RELAYER_KEY = process.env.SERVER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const metaAbi = [
  'function metaTransferOwnership(string cid,address newOwner,address owner,uint256 deadline,uint8 v,bytes32 r,bytes32 s)',
  'function getOwner(string cid) view returns (address)',
  'function getNonce(address user) view returns (uint256)'
];

let relayerWallet; // reuse existing `registry` defined above for filtering if meta ABI present
if (RPC_URL && RELAYER_KEY && CONTRACT_ADDRESS) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  relayerWallet = new ethers.Wallet(RELAYER_KEY, provider);
  registry = new ethers.Contract(CONTRACT_ADDRESS, metaAbi, relayerWallet);
  console.log('[relay] Gasless transfer relayer ready:', relayerWallet.address);
} else {
  console.warn('[relay] Missing RPC_URL / RELAYER_KEY / CONTRACT_ADDRESS – gasless transfer disabled');
}

// Gasless transfer endpoint (expects metaTransferOwnership in contract; if not deployed this will fail)
app.post('/api/gasless-transfer', async (req, res) => {
  try {
    if (!registry) return res.status(500).json({ error: 'Relayer not configured' });
    const { cid, newOwner, owner, deadline, signature } = req.body || {};
    if (!cid || !newOwner || !owner || !deadline || !signature) {
      return res.status(400).json({ error: 'cid,newOwner,owner,deadline,signature required' });
    }
    // Basic validation before sending tx
    const currentOwner = await registry.getOwner(cid);
    if (currentOwner.toLowerCase() !== owner.toLowerCase()) {
      return res.status(400).json({ error: 'Owner mismatch' });
    }
    const tx = await registry.metaTransferOwnership(cid, newOwner, owner, deadline, signature);
    res.json({ txHash: tx.hash });
  } catch (err) {
    console.error('gasless-transfer error', err);
    return res.status(500).json({ error: err.message || 'Failed' });
  }
});