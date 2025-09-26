// Ethers.js integration for FileOwnershipRegistry
// Place this in your src directory as fileRegistry.js
import { ethers } from 'ethers'

// Use a minimal ABI to avoid JSON import issues
const ABI = [
  'function registerFile(string cid)',
  'function registerFee() view returns (uint256)',
  'function getOwner(string cid) view returns (address)',
  'function grantAccess(string cid, address user, bool canWrite, uint256 expiryTime)',
  'function createSharedAccess(string cid, bool canWrite, uint256 expiryTime) returns (bytes32)',
  'function transferOwnership(string cid, address newOwner)',
  'function metaTransferOwnership(string cid,address newOwner,address fileOwner,uint256 deadline,bytes signature)',
  'function getNonce(address user) view returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

export function getRegistryContract(signerOrProvider) {
  if (!CONTRACT_ADDRESS) throw new Error('VITE_CONTRACT_ADDRESS is missing')
  if (!signerOrProvider) throw new Error('Signer or provider is required')
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider)
}
