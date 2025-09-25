import { ethers } from "ethers";

/**
 * Encodes a meta-transaction for FileOwnershipRegistry and prepares the message hash for signing.
 * @param {string} functionName - The contract function to call (e.g., "registerFile")
 * @param {Array} functionArgs - Arguments for the function
 * @param {string} contractAddress - The deployed contract address
 * @param {Array} abi - The contract ABI
 * @param {string} userAddress - The user's wallet address
 * @param {ethers.providers.Provider} provider - Ethers provider
 * @returns {Promise<{functionSignature: string, messageHash: string, nonce: number}>}
 */
export async function encodeMetaTx(functionName, functionArgs, contractAddress, abi, userAddress, provider) {
  // 1. Create contract interface (v6)
  const iface = new ethers.Interface(abi);
  // 2. Encode function call
  const functionSignature = iface.encodeFunctionData(functionName, functionArgs);

  // 3. Get nonce from contract
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const nonce = await contract.getNonce(userAddress);

  // 4. Reproduce message hash (must match contract's getMessageHash)
  const innerHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode([
      "address",
      "bytes",
      "uint256"
    ], [contractAddress, functionSignature, nonce])
  );
  const message = ethers.solidityPacked([
    "string",
    "bytes32"
  ], ["\x19Ethereum Signed Message:\n32", innerHash]);
  const messageHash = ethers.keccak256(message);

  return { functionSignature, messageHash, nonce };
}

/**
 * Signs the message hash with the user's wallet (MetaMask, etc.)
 * @param {string} messageHash - The hash to sign
 * @param {ethers.Signer} signer - The user's signer
 * @returns {Promise<{sigR: string, sigS: string, sigV: number}>}
 */
export async function signMetaTx(messageHash, signer) {
  // MetaMask expects a 32-byte hash for personal_sign
  const signature = await signer.signMessage(ethers.getBytes(messageHash));
  // Split signature (v6)
  const sig = ethers.Signature.from(signature);
  return { sigR: sig.r, sigS: sig.s, sigV: sig.v };
}
