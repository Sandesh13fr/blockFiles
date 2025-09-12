import { ethers } from "ethers";
import { Interface } from "ethers/lib.esm/abi/interface";

// Usage: await encodeMetaTx("registerFile", [cid], contractAddress, abi, userAddress, provider)
export async function encodeMetaTx(functionName, functionArgs, contractAddress, abi, userAddress, provider) {
  // 1. Create contract interface
  const iface = new Interface(abi);
  // 2. Encode function call
  const functionSignature = iface.encodeFunctionData(functionName, functionArgs);

  // 3. Get nonce from contract
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const nonce = await contract.getNonce(userAddress);

  // 4. Reproduce message hash (must match contract's getMessageHash)
  // keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(address(this), _data, nonces[msg.sender]))))
  const innerHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode([
      "address",
      "bytes",
      "uint256"
    ], [contractAddress, functionSignature, nonce])
  );
  const message = ethers.utils.solidityPack([
    "string",
    "bytes32"
  ], ["\x19Ethereum Signed Message:\n32", innerHash]);
  const messageHash = ethers.utils.keccak256(message);

  return { functionSignature, messageHash, nonce };
}
