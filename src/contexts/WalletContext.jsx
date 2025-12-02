import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserProvider, getAddress } from 'ethers'

const WalletContext = createContext({
  account: null,
  isMetaMask: false,
  chainId: null,
  connect: async () => {},
  disconnect: () => {},
  ensureConnected: async () => ({ account: null, chainId: null }),
  getProvider: () => null,
})

const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337)
const DEFAULT_CHAIN_HEX = `0x${DEFAULT_CHAIN_ID.toString(16)}`
const DEFAULT_CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME || 'Localhost 8545'
const DEFAULT_CHAIN_RPC = import.meta.env.VITE_CHAIN_RPC_URL || import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545'

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [isMetaMask, setIsMetaMask] = useState(false)
  const [chainId, setChainId] = useState(null)
  const initializedRef = useRef(false)
  const allowRestoreRef = useRef(false)
  const providerRef = useRef(null)

  const getProvider = useCallback(() => {
    if (typeof window === 'undefined' || !window.ethereum) return null
    if (!providerRef.current) {
      providerRef.current = new BrowserProvider(window.ethereum)
    }
    return providerRef.current
  }, [])

  const ensureChain = useCallback(async () => {
    const provider = getProvider()
    if (!provider) throw new Error('MetaMask not found')
    const network = await provider.getNetwork()
    let currentId = Number(network.chainId)
    setChainId(currentId)
    if (currentId === DEFAULT_CHAIN_ID) {
      return currentId
    }

    if (!window.ethereum) throw new Error('MetaMask not found')
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: DEFAULT_CHAIN_HEX }],
      })
    } catch (err) {
      if (err?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: DEFAULT_CHAIN_HEX,
            chainName: DEFAULT_CHAIN_NAME,
            rpcUrls: [DEFAULT_CHAIN_RPC],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          }],
        })
      } else {
        throw err
      }
    }

    providerRef.current = null
    const nextProvider = getProvider()
    if (!nextProvider) throw new Error('MetaMask not found')
    const refreshed = await nextProvider.getNetwork()
    currentId = Number(refreshed.chainId)
    setChainId(currentId)
    return currentId
  }, [getProvider])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (typeof window === 'undefined' || !window.ethereum) return
    setIsMetaMask(Boolean(window.ethereum.isMetaMask))
    try {
      allowRestoreRef.current = localStorage.getItem('walletConnected') === '1'
    } catch {
      allowRestoreRef.current = false
    }

    const handleAccountsChanged = (accounts) => {
      const next = accounts && accounts.length > 0 ? getAddress(accounts[0]) : null
      const restoreAllowed = allowRestoreRef.current || localStorage.getItem('walletConnected') === '1'
      if (next && !restoreAllowed) {
        return
      }
      setAccount(next)
      try {
        if (next) {
          localStorage.setItem('walletConnected', '1')
          localStorage.setItem('walletAccount', next)
          allowRestoreRef.current = true
        } else {
          localStorage.removeItem('walletConnected')
          localStorage.removeItem('walletAccount')
          allowRestoreRef.current = false
          setChainId(null)
          providerRef.current = null
        }
      } catch {}
    }

    const handleChainChanged = (hexId) => {
      providerRef.current = null
      const parsed = typeof hexId === 'string' ? parseInt(hexId, 16) : Number(hexId)
      if (!Number.isNaN(parsed)) {
        setChainId(parsed)
      }
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    ;(async () => {
      try {
        if (allowRestoreRef.current) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          handleAccountsChanged(accounts || [])
          const provider = getProvider()
          const net = await provider?.getNetwork()
          if (net) setChainId(Number(net.chainId))
        } else {
          // Ensure we start disconnected unless user explicitly connects
          setAccount(null)
          setChainId(null)
        }
      } catch {}
    })()

    return () => {
      try { window.ethereum.removeListener('accountsChanged', handleAccountsChanged) } catch {}
      try { window.ethereum.removeListener('chainChanged', handleChainChanged) } catch {}
    }
  }, [getProvider])

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not found')
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts || accounts.length === 0) throw new Error('No MetaMask accounts available')
    const normalized = getAddress(accounts[0])
    setAccount(normalized)
    allowRestoreRef.current = true
    try {
      localStorage.setItem('walletConnected', '1')
      localStorage.setItem('walletAccount', normalized)
    } catch {}
    await ensureChain()
    return normalized
  }, [ensureChain])

  const ensureConnected = useCallback(async () => {
    if (!account) {
      const next = await connect()
      const id = await ensureChain()
      return { account: next, chainId: id }
    }
    const id = await ensureChain()
    return { account, chainId: id }
  }, [account, connect, ensureChain])

  const disconnect = useCallback(() => {
    setAccount(null)
    setChainId(null)
    providerRef.current = null
    try {
      localStorage.removeItem('walletConnected')
      localStorage.removeItem('walletAccount')
    } catch {}
    allowRestoreRef.current = false
  }, [])

  const value = useMemo(() => ({
    account,
    chainId,
    isMetaMask,
    connect,
    disconnect,
    ensureConnected,
    getProvider,
  }), [account, chainId, isMetaMask, connect, disconnect, ensureConnected, getProvider])

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}


