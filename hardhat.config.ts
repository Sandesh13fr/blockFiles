import type { HardhatUserConfig } from "hardhat/config";
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatEthersPlugin from "@nomicfoundation/hardhat-ethers";
import dotenv from "dotenv";

dotenv.config();

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const rawSepoliaPrivateKey = process.env.SEPOLIA_PRIVATE_KEY?.trim();
const sepoliaPrivateKey = rawSepoliaPrivateKey
  ? (rawSepoliaPrivateKey.startsWith("0x") ? rawSepoliaPrivateKey : `0x${rawSepoliaPrivateKey}`)
  : undefined;
const sepoliaAccounts = sepoliaPrivateKey ? [sepoliaPrivateKey] : [];

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatEthersPlugin],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      type: "http",
      url: sepoliaRpcUrl,
      accounts: sepoliaAccounts,
    },
  },
};

export default config;