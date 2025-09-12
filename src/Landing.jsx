import React from 'react';

export default function Landing({ isMetaMask, account, connect }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">Welcome to blockFiles</h1>
        <p className="mb-6 text-gray-700">A decentralized file storage system powered by IPFS and Web3.</p>
        {!isMetaMask && (
          <div className="mb-4 text-red-600">MetaMask not detected. Please install MetaMask to continue.</div>
        )}
        {isMetaMask && !account && (
          <button
            className="px-6 py-3 rounded bg-yellow-500 text-white text-lg font-semibold hover:bg-yellow-400"
            onClick={connect}
          >
            Connect MetaMask
          </button>
        )}
        {isMetaMask && account && (
          <div className="text-green-700 text-lg font-medium">Connected: {account.slice(0, 6)}...{account.slice(-4)}</div>
        )}
      </div>
    </div>
  );
}
