import { ethers } from "ethers";
import { encodeMetaTx, signMetaTx } from "../utils/metaTxHelpers";

/**
 * Example usage for a gasless meta-transaction (frontend)
 *
 * @param {string} functionName - e.g. "registerFile"
 * @param {Array} functionArgs - e.g. [cid]
 * @param {string} contractAddress
 * @param {Array} abi
 * @param {ethers.providers.Web3Provider} provider - window.ethereum provider
 * @param {string} userAddress
 * @returns {Promise<{userAddress, functionSignature, sigR, sigS, sigV}>}
 */
export async function prepareMetaTx({ functionName, functionArgs, contractAddress, abi, provider, userAddress }) {
  // Get signer
  const signer = await provider.getSigner();
  // 1. Encode meta-tx and get message hash
  const { functionSignature, messageHash } = await encodeMetaTx(
    functionName,
    functionArgs,
    contractAddress,
    abi,
    userAddress,
    provider
  );
  // 2. User signs the message hash
  const { sigR, sigS, sigV } = await signMetaTx(messageHash, signer);
  return { userAddress, functionSignature, sigR, sigS, sigV };
}
