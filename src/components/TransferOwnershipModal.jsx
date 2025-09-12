import { useState } from 'react';
import { ethers } from 'ethers';

const TransferOwnershipModal = ({ isOpen, onClose, file, contract, signer, onTransferSuccess }) => {
  const [newOwnerAddress, setNewOwnerAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handleTransfer = async () => {
    if (!newOwnerAddress || !ethers.isAddress(newOwnerAddress)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    if (confirmText !== 'TRANSFER') {
      setError('Please type "TRANSFER" to confirm');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const tx = await contract.transferOwnership(file.cid, newOwnerAddress);
      await tx.wait();

      onTransferSuccess(`Ownership transferred to ${newOwnerAddress}`);
      setNewOwnerAddress('');
      setConfirmText('');
      onClose();
    } catch (error) {
      console.error('Error transferring ownership:', error);
      setError('Failed to transfer ownership. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-red-600">Transfer Ownership</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">File: {file.name || file.cid}</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Warning:</strong> This action cannot be undone. You will permanently lose ownership of this file.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Owner Address
          </label>
          <input
            type="text"
            value={newOwnerAddress}
            onChange={(e) => setNewOwnerAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type "TRANSFER" to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="TRANSFER"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={isLoading || !newOwnerAddress || confirmText !== 'TRANSFER'}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Transferring...' : 'Transfer Ownership'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferOwnershipModal;
