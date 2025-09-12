import { ethers } from 'ethers';

const RELAYER_URL = process.env.REACT_APP_RELAYER_URL || 'http://localhost:3001';

export class GaslessTransactionManager {
  constructor(contract, signer) {
    this.contract = contract;
    this.signer = signer;
  }

  // Get nonce for the user
  async getNonce(userAddress) {
    try {
      const response = await fetch(`${RELAYER_URL}/nonce/${userAddress}`);
      const data = await response.json();
      return ethers.toBigInt(data.nonce);
    } catch (error) {
      console.error('Error getting nonce:', error);
      throw error;
    }
  }

  // Sign a meta-transaction
  async signMetaTransaction(functionName, args, userAddress) {
    try {
      // Get the function signature
      const functionSignature = this.contract.interface.encodeFunctionData(functionName, args);

      // Get nonce
      const nonce = await this.getNonce(userAddress);

      // Create the message to sign
      const messageHash = await this.contract.getMessageHash(functionSignature);

      // Sign the message
      const signature = await this.signer.signMessage(ethers.getBytes(messageHash));

      // Split signature into r, s, v
      const sig = ethers.Signature.from(signature);

      return {
        userAddress,
        functionSignature,
        sigR: sig.r,
        sigS: sig.s,
        sigV: sig.v
      };
    } catch (error) {
      console.error('Error signing meta-transaction:', error);
      throw error;
    }
  }

  // Send meta-transaction through relayer
  async sendMetaTransaction(functionName, args, userAddress) {
    try {
      const metaTxData = await this.signMetaTransaction(functionName, args, userAddress);

      const response = await fetch(`${RELAYER_URL}/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metaTxData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Meta-transaction failed');
      }

      return result;
    } catch (error) {
      console.error('Error sending meta-transaction:', error);
      throw error;
    }
  }

  // Convenience methods for common operations
  async registerFileGasless(cid, userAddress) {
    return this.sendMetaTransaction('registerFile', [cid], userAddress);
  }

  async transferOwnershipGasless(cid, newOwner, userAddress) {
    return this.sendMetaTransaction('transferOwnership', [cid, newOwner], userAddress);
  }

  async grantAccessGasless(cid, user, canWrite, expiryTime, userAddress) {
    return this.sendMetaTransaction('grantAccess', [cid, user, canWrite, expiryTime], userAddress);
  }

  async createSharedAccessGasless(cid, canWrite, expiryTime, userAddress) {
    return this.sendMetaTransaction('createSharedAccess', [cid, canWrite, expiryTime], userAddress);
  }
}

// Hook for using gasless transactions in React components
export const useGaslessTransactions = (contract, signer) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const gaslessManager = React.useMemo(() => {
    if (contract && signer) {
      return new GaslessTransactionManager(contract, signer);
    }
    return null;
  }, [contract, signer]);

  const executeGasless = React.useCallback(async (functionName, args, userAddress) => {
    if (!gaslessManager) {
      throw new Error('Gasless transaction manager not initialized');
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await gaslessManager.sendMetaTransaction(functionName, args, userAddress);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [gaslessManager]);

  return {
    executeGasless,
    isLoading,
    error,
    gaslessManager
  };
};
