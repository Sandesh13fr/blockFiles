import { useRef, useState, useEffect } from 'react'
import { ethers } from 'ethers'
import useMetaMask from '../hooks/useMetaMask'
import { getRegistryContract } from '../fileRegistry'
import { listFiles, uploadFile, downloadByCid, ipfsGatewayUrl, health, deleteFile } from '../api'
import ShareModal from '../components/ShareModal'
import TransferOwnershipModal from '../components/TransferOwnershipModal'

export default function UploadPage() {
  const { account, ensureConnected, getProvider, connect } = useMetaMask()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [txHash, setTxHash] = useState('')
  const inputRef = useRef(null)
  const contractRef = useRef(null)

  const initializeContract = async () => {
    if (contractRef.current) return contractRef.current
    const provider = getProvider()
    if (!provider) throw new Error('MetaMask not found')
    const signer = await provider.getSigner()
    contractRef.current = getRegistryContract(signer)
    return contractRef.current
  }

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
    if (!account) {
      setError('Connect your wallet before uploading.');
      return;
    }
    inputRef.current?.click()
  }

  async function handleFiles(selected) {
    setError('')
    setSuccessMessage('')
    setTxHash('')
    try {
      // Ensure wallet is connected and on correct chain
      await ensureConnected()
      const contract = await initializeContract()
      if (!selected || selected.length === 0) return;
      setLoading(true);
      for (const file of selected) {
        // 1) Upload to IPFS/backend
        const res = await uploadFile(file);
        if (!res?.cid) {
          throw new Error('Upload failed: missing CID');
        }

        // 2) Register on-chain; user pays gas via MetaMask
        setRegistering(true);
        try {
          // Estimate gas and set overrides for broad EVM compatibility
          // Get required registration fee
          let feeValue = 0n
          try {
            const fee = await contract.registerFee()
            feeValue = fee
          } catch {}
          const gasEstimate = await contract.estimateGas.registerFile(res.cid, { value: feeValue })
          const gasLimit = (gasEstimate * 120n) / 100n // +20% buffer
          const provider = getProvider()
          const feeData = await provider.getFeeData()
          const overrides = { gasLimit }
          if (feeValue > 0n) overrides.value = feeValue
          if (feeData.gasPrice) {
            overrides.gasPrice = feeData.gasPrice
          } else {
            const defaultPriority = 1n * 10n ** 9n // 1 gwei
            const defaultMax = 30n * 10n ** 9n // 30 gwei
            overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || defaultPriority
            overrides.maxFeePerGas = feeData.maxFeePerGas || defaultMax
          }

          const tx = await contract.registerFile(res.cid, overrides)
          setTxHash(tx.hash)
          await tx.wait()
          setSuccessMessage(`On-chain registered: ${res.cid}`)
          setTimeout(() => setSuccessMessage(''), 4000)
        } catch (txErr) {
          // 3) Roll back server record on failure
          try { await deleteFile(res.cid) } catch {}
          throw txErr
        } finally {
          setRegistering(false)
        }
      }
      await refresh();
    } catch (e) {
      setRegistering(false)
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!account) {
      setError('Connect your wallet before uploading.');
      return;
    }
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
        <div className="mt-4 p-3 glass text-yellow-200 rounded border border-yellow-300/40">
          Registering file on-chain...
          {txHash && (
            <div className="text-xs mt-1 opacity-80 break-all">Pending tx: {txHash}</div>
          )}
        </div>
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
                        disabled={!contractRef.current}
                        title={!contractRef.current ? 'Connect wallet to transfer' : 'Transfer ownership'}
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
        contract={contractRef.current}
        onShareSuccess={handleShareSuccess}
      />

      <TransferOwnershipModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        file={selectedFile}
        contract={contractRef.current}
        onTransferSuccess={handleTransferSuccess}
      />
    </div>
  )
}



