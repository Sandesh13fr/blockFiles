import { useEffect, useRef, useState } from 'react'
import useMetaMask from '../hooks/useMetaMask'
import { listFiles, uploadFile, downloadByCid, ipfsGatewayUrl, health, deleteFile } from '../api'
import { sendMetaTx } from '../utils/sendMetaTx'
import { ethers } from 'ethers'
import ShareModal from '../components/ShareModal'
import TransferOwnershipModal from '../components/TransferOwnershipModal'

export default function UploadPage() {
  const { account, isMetaMask, connect } = useMetaMask();
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [contract, setContract] = useState(null)
  const [signer, setSigner] = useState(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const inputRef = useRef(null)

  async function onDelete(cid) {
    setLoading(true);
    setError('');
    try {
      await deleteFile(cid);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const data = await listFiles()
      setFiles(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    health().then(() => setOk(true)).catch(() => setOk(false))
    refresh()
  }, [])

  useEffect(() => {
    if (account && window.ethereum) {
      initializeContract()
    }
  }, [account])

  const initializeContract = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS

      if (!contractAddress) {
        console.warn('Contract address not configured')
        return
      }

      const contractABI = [
        "function registerFile(string cid) external",
        "function transferOwnership(string cid, address newOwner) external",
        "function grantAccess(string cid, address user, bool canWrite, uint256 expiryTime) external",
        "function revokeAccess(string cid, address user) external",
        "function createSharedAccess(string cid, bool canWrite, uint256 expiryTime) external returns (bytes32)",
        "function claimSharedAccess(bytes32 linkId, string cid) external",
        "function hasAccess(string cid, address user) external view returns (bool)",
        "function hasWriteAccess(string cid, address user) external view returns (bool)",
        "function getOwner(string cid) external view returns (address)",
        "function getAccessPermission(string cid, address user) external view returns (bool hasAccess, bool canWrite, uint256 expiryTime, address grantedBy)",
        "function getSharedAccess(string cid, bytes32 linkId) external view returns (address owner, bool canWrite, uint256 expiryTime, bool isActive)",
        "event FileRegistered(string cid, address indexed owner)",
        "event OwnershipTransferred(string cid, address indexed previousOwner, address indexed newOwner)",
        "event AccessGranted(string cid, address indexed user, bool canWrite, uint256 expiryTime)",
        "event AccessRevoked(string cid, address indexed user)"
      ]

      const contract = new ethers.Contract(contractAddress, contractABI, signer)
      setContract(contract)
      setSigner(signer)
    } catch (error) {
      console.error('Error initializing contract:', error)
    }
  }

  const handleShare = async (file) => {
    const url = ipfsGatewayUrl(file.cid)
    try {
      await navigator.clipboard.writeText(url)
      setSuccessMessage('File URL copied to clipboard!')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (e) {
      setError('Failed to copy URL to clipboard')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleTransfer = (file) => {
    setSelectedFile(file)
    setTransferModalOpen(true)
  }

  const handleShareSuccess = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 5000)
    setShareModalOpen(false)
  }

  const handleTransferSuccess = (message) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 5000)
    setTransferModalOpen(false)
    refresh() // Refresh the file list to update ownership
  }

  function onPickClick() {
    inputRef.current?.click()
  }

  async function handleFiles(selected) {
    if (!selected || selected.length === 0) return;
    setLoading(true);
    setError('');
    try {
      for (const file of selected) {
        const res = await uploadFile(file);
        setRegistering(true);
        if (window.ethereum && res.cid && account) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          // Use the same ABI as in initializeContract
          const contractABI = [
            "function registerFile(string cid) external",
            "function transferOwnership(string cid, address newOwner) external",
            "function grantAccess(string cid, address user, bool canWrite, uint256 expiryTime) external",
            "function revokeAccess(string cid, address user) external",
            "function createSharedAccess(string cid, bool canWrite, uint256 expiryTime) external returns (bytes32)",
            "function claimSharedAccess(bytes32 linkId, string cid) external",
            "function hasAccess(string cid, address user) external view returns (bool)",
            "function hasWriteAccess(string cid, address user) external view returns (bool)",
            "function getOwner(string cid) external view returns (address)",
            "function getAccessPermission(string cid, address user) external view returns (bool hasAccess, bool canWrite, uint256 expiryTime, address grantedBy)",
            "function getSharedAccess(string cid, bytes32 linkId) external view returns (address owner, bool canWrite, uint256 expiryTime, bool isActive)",
            "function getNonce(address user) external view returns (uint256)",
            "function executeMetaTransaction(address userAddress, bytes functionSignature, bytes32 sigR, bytes32 sigS, uint8 sigV) external returns (bytes)",
            "event FileRegistered(string cid, address indexed owner)",
            "event OwnershipTransferred(string cid, address indexed previousOwner, address indexed newOwner)",
            "event AccessGranted(string cid, address indexed user, bool canWrite, uint256 expiryTime)",
            "event AccessRevoked(string cid, address indexed user)"
          ];
          const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS
const apiBaseUrl = import.meta.env.VITE_API_BASE_PATH || "/api"
          await sendMetaTx({
            functionName: "registerFile",
            functionArgs: [res.cid],
            contractAddress,
            abi: contractABI,
            provider,
            userAddress: account,
            apiBaseUrl
          });
        }
        setRegistering(false);
      }
      await refresh();
    } catch (e) {
      setError(e.message);
      setRegistering(false);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    const dt = e.dataTransfer
    if (dt?.files && dt.files.length > 0) {
      handleFiles(dt.files)
      dt.clearData()
    }
  }

  function onDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
  }

  function onDownload(cid, filename) {
  const url = ipfsGatewayUrl(cid)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Decentralized File Storage (IPFS)</h1>
        <p className="text-sm text-slate-200">Backend status: {ok ? <span className="text-green-300">healthy</span> : <span className="text-red-300">unavailable</span>}</p>
        <div className="mt-2 flex items-center gap-4">
          {account ? (
            <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/30 text-white text-sm">
              {account.slice(0, 6)}...{account.slice(-4)}
            </span>
          ) : (
            <button onClick={connect} className="px-4 py-2 rounded-full bg-yellow-300 text-black text-sm font-semibold hover:bg-yellow-400">
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {!account && (
        <div className="mb-6 glass rounded-lg p-4 border border-white/30">
          <p className="text-slate-100">Connect your wallet to enable uploads and on-chain registration.</p>
        </div>
      )}

      <section
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="border-2 border-dashed border-white/40 rounded-lg p-8 glass text-center cursor-pointer hover:border-white/60"
        onClick={onPickClick}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          disabled={!account}
        />
        <p className="text-slate-100">Drag and drop files here, or click to select</p>
        <p className="text-xs text-slate-200 mt-1">Files will be uploaded to IPFS and tracked in PostgreSQL.</p>
        {!account && (
          <p className="text-xs text-red-300 mt-2">Connect MetaMask to upload files.</p>
        )}
      </section>

      {error && (
        <div className="mt-4 p-3 glass text-red-200 rounded border border-red-300/40">{error}</div>
      )}
      {registering && (
        <div className="mt-4 p-3 glass text-yellow-200 rounded border border-yellow-300/40">Registering file on-chain...</div>
      )}
      {successMessage && (
        <div className="mt-4 p-3 glass text-green-200 rounded border border-green-300/40">{successMessage}</div>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium text-white">Files</h2>
          <button
            onClick={refresh}
            className="px-3 py-1.5 rounded bg-gray-900/70 text-white text-sm hover:bg-gray-900 disabled:opacity-50"
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto glass rounded-lg shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/10 text-white">
              <tr>
                <th className="px-4 py-2">Filename</th>
                <th className="px-4 py-2">CID</th>
                <th className="px-4 py-2">Size</th>
                <th className="px-4 py-2">Uploaded</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-200" colSpan={5}>No files yet</td>
                </tr>
              )}
              {files.map((f) => (
                <tr key={f.cid} className="border-t border-white/20">
                  <td className="px-4 py-2 text-white">{f.filename}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <a href={ipfsGatewayUrl(f.cid)} target="_blank" className="text-blue-200 hover:underline" rel="noreferrer">
                        {f.cid}
                      </a>
                      <button
                        className="px-2 py-0.5 text-xs bg-white/20 text-white rounded hover:bg-white/30"
                        onClick={() => copyToClipboard(f.cid)}
                        title="Copy CID"
                      >
                        Copy
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-200">{f.size} B</td>
                  <td className="px-4 py-2 text-slate-200">{new Date(f.upload_date).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        className="px-3 py-1.5 rounded bg-blue-600/80 text-white text-sm hover:bg-blue-600"
                        onClick={() => onDownload(f.cid, f.filename)}
                      >
                        Download
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-green-600/80 text-white text-sm hover:bg-green-600"
                        onClick={() => handleShare(f)}
                        title="Copy file URL to clipboard"
                      >
                        Share
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-purple-600/80 text-white text-sm hover:bg-purple-600"
                        onClick={() => handleTransfer(f)}
                        disabled={!contract}
                        title={!contract ? 'Connect wallet to transfer' : 'Transfer ownership'}
                      >
                        Transfer
                      </button>
                      <button
                        className="px-3 py-1.5 rounded bg-red-600/80 text-white text-sm hover:bg-red-600"
                        onClick={() => onDelete(f.cid)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        file={selectedFile}
        contract={contract}
        signer={signer}
        onShareSuccess={handleShareSuccess}
      />

      <TransferOwnershipModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        file={selectedFile}
        contract={contract}
        signer={signer}
        onTransferSuccess={handleTransferSuccess}
      />
    </div>
  )
}



