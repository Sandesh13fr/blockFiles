// Ethers.js integration for FileOwnershipRegistry
// Place this in your src directory as fileRegistry.js
import { ethers } from 'ethers';

// Replace with your deployed contract address
const CONTRACT_ADDRESS = '0x7EF2e0048f5bAeDe046f6BF797943daF4ED8CB47';

// ABI for FileOwnershipRegistry
const ABI = [
  "function registerFile(string cid) external",
  "function getOwner(string cid) external view returns (address)",
  "event FileRegistered(string cid, address indexed owner)"
];

export async function registerFileOnChain(cid, signer) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  const tx = await contract.registerFile(cid);
  await tx.wait();
  return tx;
}

export async function getFileOwner(cid, provider) {
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  return contract.getOwner(cid);
}
