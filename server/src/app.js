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

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const apiBasePath = process.env.API_BASE_PATH || "/api";

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

// Health check
app.use(`${apiBasePath}`, metaTxRouter);
app.get(`${apiBasePath}/health`, async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB not reachable" });
  }
});

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
    res.json(rows);
  } catch (err) {
    next(err);
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