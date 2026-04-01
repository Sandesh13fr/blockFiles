import axios from 'axios';
import { PinataSDK } from 'pinata';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env')
];

for (const envPath of envCandidates) {
  dotenv.config({ path: envPath, override: false });
}


const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY;
const PINATA_GATEWAY_KEY = process.env.PINATA_GATEWAY_KEY;

if (!PINATA_JWT) {
  throw new Error(
    "PINATA_JWT is not set. Add your Pinata JWT token to the project-level .env file so uploads can authenticate."
  );
}

const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: PINATA_GATEWAY,
  pinataGatewayKey: PINATA_GATEWAY_KEY
});

const pinCacheTtlMs = Number(process.env.PINATA_PIN_CACHE_TTL_MS || 45_000);
const pinOwnershipCache = new Map();

async function delay(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Checks whether a CID is pinned in the current Pinata account.
 */
export async function isCidPinnedByCurrentAccount(cid) {
  if (!cid) return false;
  const cached = pinOwnershipCache.get(cid);
  const now = Date.now();
  if (cached && now - cached.ts < pinCacheTtlMs) {
    return cached.pinned;
  }
  try {
    const resp = await axios.get('https://api.pinata.cloud/data/pinList', {
      params: {
        hashContains: cid,
        status: 'pinned',
        pageLimit: 1
      },
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`
      }
    });
    const rows = Array.isArray(resp.data?.rows) ? resp.data.rows : [];
    const pinned = rows.some(row => row?.ipfs_pin_hash === cid || row?.hash === cid);
    pinOwnershipCache.set(cid, { pinned, ts: now });
    return pinned;
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    throw new Error(`Pinata pinList check failed: ${detail}`);
  }
}

/**
 * Waits briefly for Pinata pin list to reflect a newly uploaded CID.
 */
export async function waitForCidPinnedByCurrentAccount(cid, options = {}) {
  const retries = Number(options.retries ?? 5);
  const delayMs = Number(options.delayMs ?? 1200);
  let lastError = null;

  for (let i = 0; i < retries; i++) {
    try {
      const pinned = await isCidPinnedByCurrentAccount(cid);
      if (pinned) return { pinned: true, attempts: i + 1 };
    } catch (err) {
      lastError = err;
    }
    if (i < retries - 1) {
      await delay(delayMs);
    }
  }

  if (lastError) {
    return { pinned: false, attempts: retries, reason: lastError.message };
  }
  return { pinned: false, attempts: retries, reason: 'CID not visible in current Pinata account pin list yet' };
}

/**
 * Unpins a file from Pinata Cloud. Tries SDK helpers first, then REST fallback.
 */
export async function unpinFileFromPinata(cid) {
  if (!cid) throw new Error('CID is required to unpin from Pinata');
  const client = await getIpfsClient();

  if (client.pin && typeof client.pin.delete === 'function') {
    return client.pin.delete(cid);
  }
  if (typeof client.unpin === 'function') {
    return client.unpin(cid);
  }

  try {
    const resp = await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      headers: { Authorization: `Bearer ${PINATA_JWT}` }
    });
    return resp.data;
  } catch (err) {
    const detail = err.response?.data?.error || err.message;
    throw new Error(`Pinata REST API unpin failed: ${detail}`);
  }
}

// Log Pinata SDK version at startup for diagnostics (after pinata is defined)
try {
  const version = pinata?.version || pinata?.constructor?.version || pinata?.constructor?.name;
  console.log('Pinata SDK version:', version);
} catch (e) {
  console.log('Could not determine Pinata SDK version:', e.message);
}

/**
 * Uploads a file to Pinata Cloud
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<object>} Pinata upload response
 */
export async function uploadFileToPinata(filePath) {
  try {
    const fileName = path.basename(filePath);
    const file = new File([await fs.promises.readFile(filePath)], fileName);
    const result = await pinata.upload.public.file(file);
    return result;
  } catch (error) {
    console.error('Pinata upload error:', error);
    throw error;
  }
}

/**
 * Uploads an in-memory file to Pinata Cloud.
 */
export async function uploadBufferToPinata(fileBuffer, fileName = 'upload.bin') {
  try {
    const file = new File([fileBuffer], path.basename(fileName));
    const result = await pinata.upload.public.file(file);
    return result;
  } catch (error) {
    console.error('Pinata upload error:', error);
    throw error;
  }
}


// Dummy getIpfsClient for compatibility (returns pinata instance)
export async function getIpfsClient() {
  return pinata;
}

export default pinata;
