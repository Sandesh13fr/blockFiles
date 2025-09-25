import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from 'url';

// Load env variables
dotenv.config();

const router = express.Router();


// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI and address (use minimal ABI to avoid missing artifacts at runtime)
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const CONTRACT_ABI = [
  "function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) returns (bytes)",
  "function getNonce(address user) view returns (uint256)",
  "function getMessageHash(bytes _data) view returns (bytes32)"
];

// Relayer wallet setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, relayer);

// POST /api/meta-tx
// { userAddress, functionSignature, sigR, sigS, sigV }
router.post("/meta-tx", async (req, res) => {
  try {
    const { userAddress, functionSignature, sigR, sigS, sigV } = req.body;
    if (!userAddress || !functionSignature || !sigR || !sigS || sigV === undefined) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    // Send meta-tx
    const tx = await contract.executeMetaTransaction(
      userAddress,
      functionSignature,
      sigR,
      sigS,
      sigV
    );
    const receipt = await tx.wait();
    res.json({ txHash: receipt.transactionHash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Meta-tx failed", details: err.message });
  }
});

export default router;
