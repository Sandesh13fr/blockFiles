import axios from 'axios';
/**
 * Unpins a file from Pinata Cloud
 * @param {string} cid - The CID to unpin
 * @returns {Promise<object>} Pinata unpin response
 */
export async function unpinFileFromPinata(cid) {
  const pinata = getIpfsClient();
  // Try pinata.pin.delete (Pinata SDK v2+)
  if (pinata.pin && typeof pinata.pin.delete === 'function') {
    return await pinata.pin.delete(cid);
  }
  // Try pinata.unpin (Pinata SDK v1)
  if (typeof pinata.unpin === 'function') {
    return await pinata.unpin(cid);
  }
  // Fallback: Use Pinata REST API directly
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT not set in environment.');
  try {
    const url = `https://api.pinata.cloud/pinning/unpin/${cid}`;
    const resp = await axios.delete(url, {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    return resp.data;
  } catch (err) {
    throw new Error('Pinata REST API unpin failed: ' + (err.response?.data?.error || err.message));
  }
}
import { PinataSDK } from 'pinata';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();


const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY
});

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