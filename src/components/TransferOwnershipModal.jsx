import { useState } from 'react'
import useMetaMask from '../hooks/useMetaMask'
import { ethers } from 'ethers'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

export default function TransferOwnershipModal({ isOpen, onClose, file, onTransferSuccess, contract }) {
  const { account, getProvider, ensureConnected } = useMetaMask()
  const [newOwner, setNewOwner] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState('')

  if (!isOpen) return null

  const reset = () => {
    setNewOwner('')
    setError('')
    setTxHash('')
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setTxHash('')
    try {
      if (!file) throw new Error('No file selected')
      if (!ethers.isAddress(newOwner)) throw new Error('Invalid address')
      await ensureConnected()
      const provider = getProvider()
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)
      const owner = account
      const deadline = Math.floor(Date.now() / 1000) + 600 // 10 minutes
      if (!contract) throw new Error('Contract not ready')
      // real nonce from contract
      const nonce = await contract.getNonce(owner)
      const domain = {
        name: 'FileOwnershipRegistry',
        version: '1',
        chainId,
        verifyingContract: CONTRACT_ADDRESS
      }
      const types = {
        MetaTransfer: [
          { name: 'cid', type: 'string' },
          { name: 'newOwner', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      }
      const message = {
        cid: file.cid,
        newOwner,
        owner,
        nonce: Number(nonce),
        deadline
      }
      const signature = await signer.provider.send('eth_signTypedData_v4', [owner, JSON.stringify({ domain, types: { EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ], ...types }, primaryType: 'MetaTransfer', message })])

      setLoading(true)
      // Call backend gasless endpoint
      const res = await fetch(`${import.meta.env.VITE_API_BASE_PATH || '/api'}/gasless-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: file.cid, newOwner, owner, deadline, signature })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gasless transfer failed')
      setTxHash(data.txHash)
      onTransferSuccess?.('Ownership transfer submitted (gasless)')
      reset()
      onClose()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900/90 border border-white/20 rounded-lg p-6 w-full max-w-md text-white">
        <h2 className="text-lg font-semibold mb-4">Transfer Ownership (Gasless)</h2>
        {file && (
          <p className="text-xs mb-3 break-all text-slate-300">CID: {file.cid}</p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1">New Owner Address</label>
            <input
              className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 text-sm outline-none focus:border-white/50"
              placeholder="0x..."
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value.trim())}
              disabled={loading}
            />
          </div>
          {error && <div className="text-red-300 text-xs bg-red-900/30 border border-red-600/40 p-2 rounded">{error}</div>}
          {txHash && <div className="text-green-300 text-xs break-all">Tx: {txHash}</div>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { reset(); onClose(); }} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm" disabled={loading}>Cancel</button>
            <button type="submit" disabled={loading || !newOwner} className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 text-sm disabled:opacity-50">{loading ? 'Submitting...' : 'Transfer (Gasless)'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
