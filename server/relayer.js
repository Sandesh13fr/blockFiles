const express = require('express');
const ethers = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xYourContractAddress';
const PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';

if (!PRIVATE_KEY) {
  console.error('RELAYER_PRIVATE_KEY not found in environment variables');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Contract ABI for meta-transaction functions
const CONTRACT_ABI = [
  "function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) returns (bytes)",
  "function getNonce(address user) view returns (uint256)",
  "function getMessageHash(bytes _data) view returns (bytes32)"
];

const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// Rate limiting (simple in-memory store)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

// Rate limiting middleware
function checkRateLimit(req, res, next) {
  const clientIP = req.ip;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  if (!rateLimit.has(clientIP)) {
    rateLimit.set(clientIP, []);
  }

  const requests = rateLimit.get(clientIP);
  // Remove old requests
  const recentRequests = requests.filter(time => time > windowStart);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  recentRequests.push(now);
  rateLimit.set(clientIP, recentRequests);

  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get nonce for user
app.get('/nonce/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const nonce = await contract.getNonce(address);
    res.json({ nonce: nonce.toString() });
  } catch (error) {
    console.error('Error getting nonce:', error);
    res.status(500).json({ error: 'Failed to get nonce' });
  }
});

// Relay meta-transaction
app.post('/relay', checkRateLimit, async (req, res) => {
  try {
    const { userAddress, functionSignature, sigR, sigS, sigV } = req.body;

    // Validate required fields
    if (!userAddress || !functionSignature || !sigR || !sigS || sigV === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Estimate gas for the transaction
    const gasEstimate = await contract.executeMetaTransaction.estimateGas(
      userAddress,
      functionSignature,
      sigR,
      sigS,
      sigV
    );

    // Add buffer to gas estimate
    const gasLimit = gasEstimate * BigInt(120) / BigInt(100); // 20% buffer

    // Execute the meta-transaction
    const tx = await contract.executeMetaTransaction(
      userAddress,
      functionSignature,
      sigR,
      sigS,
      sigV,
      { gasLimit }
    );

    console.log('Meta-transaction submitted:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();

    res.json({
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    });

  } catch (error) {
    console.error('Error relaying transaction:', error);

    // Handle specific error types
    if (error.message.includes('Invalid signature')) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    if (error.message.includes('Function call failed')) {
      return res.status(400).json({ error: 'Function execution failed' });
    }

    res.status(500).json({ error: 'Transaction failed', details: error.message });
  }
});

// Get supported functions
app.get('/functions', (req, res) => {
  res.json({
    supported: [
      'registerFile(string)',
      'transferOwnership(string,address)',
      'grantAccess(string,address,bool,uint256)',
      'revokeAccess(string,address)',
      'createSharedAccess(string,bool,uint256)',
      'claimSharedAccess(bytes32,string)'
    ]
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Relayer service running on port ${PORT}`);
  console.log(`Contract address: ${CONTRACT_ADDRESS}`);
  console.log(`RPC URL: ${RPC_URL}`);
});
