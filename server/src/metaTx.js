import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";

import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

// Load env variables
dotenv.config();

const router = express.Router();


// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI and address
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const CONTRACT_ABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../artifacts/contracts/FileOwnershipRegistry.sol/FileOwnershipRegistry.json"), "utf8")
).abi;

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
