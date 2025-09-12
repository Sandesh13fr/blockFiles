import { useState } from 'react';
import { ethers } from 'ethers';

const ShareModal = ({ isOpen, onClose, file, contract, signer, onShareSuccess }) => {
  const [shareType, setShareType] = useState('address'); // 'address' or 'link'
  const [recipientAddress, setRecipientAddress] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [expiryTime, setExpiryTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sharedLink, setSharedLink] = useState('');
  const [error, setError] = useState('');

  const handleShareWithAddress = async () => {
    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const expiry = expiryTime ? Math.floor(new Date(expiryTime).getTime() / 1000) : 0;

      const tx = await contract.grantAccess(file.cid, recipientAddress, canWrite, expiry);
      await tx.wait();

      onShareSuccess(`Access granted to ${recipientAddress}`);
      setRecipientAddress('');
      setExpiryTime('');
    } catch (error) {
      console.error('Error granting access:', error);
      setError('Failed to grant access. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSharedLink = async () => {
    setIsLoading(true);
    setError('');

    try {
      const expiry = expiryTime ? Math.floor(new Date(expiryTime).getTime() / 1000) : 0;

      const tx = await contract.createSharedAccess(file.cid, canWrite, expiry);
      const receipt = await tx.wait();

      // Extract linkId from transaction logs
      const event = receipt.logs.find(log => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed.name === 'SharedAccessCreated';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedEvent = contract.interface.parseLog(event);
        const linkId = parsedEvent.args.linkId;
        const shareUrl = `${window.location.origin}/claim/${file.cid}/${linkId}`;
        setSharedLink(shareUrl);
        onShareSuccess('Shared access link created successfully!');
      }
    } catch (error) {
      console.error('Error creating shared link:', error);
      setError('Failed to create shared link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sharedLink);
      onShareSuccess('Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Share File Access</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">File: {file.name || file.cid}</p>
        </div>

        {/* Share Type Selection */}
        <div className="mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setShareType('address')}
              className={`px-3 py-1 rounded text-sm ${
                shareType === 'address'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Share with Address
            </button>
            <button
              onClick={() => setShareType('link')}
              className={`px-3 py-1 rounded text-sm ${
                shareType === 'link'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Create Share Link
            </button>
          </div>
        </div>

        {/* Permissions */}
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={canWrite}
              onChange={(e) => setCanWrite(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm">Allow write access</span>
          </label>
        </div>

        {/* Expiry Time */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiry Time (optional)
          </label>
          <input
            type="datetime-local"
            value={expiryTime}
            onChange={(e) => setExpiryTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Address Input */}
        {shareType === 'address' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Shared Link Display */}
        {sharedLink && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Share Link
            </label>
            <div className="flex">
              <input
                type="text"
                value={sharedLink}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          {shareType === 'address' ? (
            <button
              onClick={handleShareWithAddress}
              disabled={isLoading || !recipientAddress}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Sharing...' : 'Share Access'}
            </button>
          ) : (
            <button
              onClick={handleCreateSharedLink}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating...' : 'Create Link'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
