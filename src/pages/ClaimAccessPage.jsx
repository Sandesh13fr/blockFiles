import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const ClaimAccessPage = () => {
  const { cid, linkId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [contract, setContract] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    initializeWeb3();
  }, []);

  const initializeWeb3 = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;

        if (!contractAddress) {
          setError('Contract address not configured');
          return;
        }

        const contractABI = [
          "function claimSharedAccess(bytes32 linkId, string cid) external",
          "function getSharedAccess(string cid, bytes32 linkId) external view returns (address owner, bool canWrite, uint256 expiryTime, bool isActive)",
          "function hasAccess(string cid, address user) external view returns (bool)"
        ];

        const contract = new ethers.Contract(contractAddress, contractABI, signer);

        setContract(contract);
        setSigner(signer);
        setIsConnected(true);
      } catch (error) {
        console.error('Error initializing Web3:', error);
        setError('Failed to connect to MetaMask');
      }
    } else {
      setError('MetaMask not detected. Please install MetaMask to claim access.');
    }
  };

  const handleClaimAccess = async () => {
    if (!contract || !signer) {
      setError('Web3 not initialized');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // Check if the link is still active
      const sharedAccess = await contract.getSharedAccess(cid, linkId);
      if (!sharedAccess.isActive) {
        setError('This shared access link has already been claimed or is inactive');
        return;
      }

      // Check if link has expired
      if (sharedAccess.expiryTime > 0 && Math.floor(Date.now() / 1000) > sharedAccess.expiryTime) {
        setError('This shared access link has expired');
        return;
      }

      // Claim the access
      const tx = await contract.claimSharedAccess(linkId, cid);
      await tx.wait();

      setSuccess('Access claimed successfully! You now have access to this file.');

      // Redirect to upload page after a delay
      setTimeout(() => {
        navigate('/upload');
      }, 3000);

    } catch (error) {
      console.error('Error claiming access:', error);
      setError('Failed to claim access. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatExpiryTime = (timestamp) => {
    if (timestamp === 0) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar />

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Claim Shared Access</h1>
            <p className="text-gray-600">You've been granted access to a shared file</p>
          </div>

          <div className="mb-6">
            <div className="bg-gray-50 rounded p-4">
              <h3 className="font-semibold text-gray-900 mb-2">File Details</h3>
              <p className="text-sm text-gray-600">
                <strong>CID:</strong> {cid}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Link ID:</strong> {linkId}
              </p>
            </div>
          </div>

          {!isConnected && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                Please connect your MetaMask wallet to claim access to this file.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleClaimAccess}
              disabled={!isConnected || isLoading}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Claiming Access...' : 'Claim Access'}
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Home
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">
              By claiming access, you agree to the terms of use for shared files.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ClaimAccessPage;
