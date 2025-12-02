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

if (!PINATA_JWT) {
  throw new Error(
    "PINATA_JWT is not set. Add your Pinata JWT token to the project-level .env file so uploads can authenticate."
  );
}

const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: PINATA_GATEWAY
});

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
    const fileStream = fs.createReadStream(filePath);
    const fileName = path.basename(filePath);
    const file = new File([await fs.promises.readFile(filePath)], fileName);
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