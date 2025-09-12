import { prepareMetaTx } from "../utils/prepareMetaTx";
import axios from "axios";

/**
 * Example: Call this to perform a gasless meta-transaction from the frontend.
 *
 * @param {string} functionName - e.g. "registerFile"
 * @param {Array} functionArgs - e.g. [cid]
 * @param {string} contractAddress
 * @param {Array} abi
 * @param {ethers.providers.Web3Provider} provider
 * @param {string} userAddress
 * @param {string} apiBaseUrl - e.g. "/api"
 * @returns {Promise<string>} - Transaction hash
 */
export async function sendMetaTx({ functionName, functionArgs, contractAddress, abi, provider, userAddress, apiBaseUrl }) {
  // 1. Prepare meta-tx (encode + sign)
  const metaTx = await prepareMetaTx({ functionName, functionArgs, contractAddress, abi, provider, userAddress });
  // 2. Send to backend relayer
  const response = await axios.post(`${apiBaseUrl}/meta-tx`, metaTx);
  return response.data.txHash;
}
