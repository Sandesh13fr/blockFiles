// Safe, default + named export, guards against SSR and chain mismatch
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'

const DEFAULT_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337)

function useMetaMask() {
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const providerRef = useRef(null)

  const getProvider = useCallback(() => {
    if (typeof window === 'undefined' || !window.ethereum) return null
    if (!providerRef.current) {
      providerRef.current = new ethers.BrowserProvider(window.ethereum)
    }
    return providerRef.current
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not found')
    const provider = getProvider()
    const accts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const network = await provider.getNetwork()
    const connectedChainId = Number(network.chainId)
    if (connectedChainId !== DEFAULT_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + DEFAULT_CHAIN_ID.toString(16) }],
        })
      } catch (err) {
        if (err?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + DEFAULT_CHAIN_ID.toString(16),
              chainName: 'Localhost 8545',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            }],
          })
        } else {
          throw err
        }
      }
    }
    setAccount(ethers.getAddress(accts[0]))
    const netAfter = await provider.getNetwork()
    setChainId(Number(netAfter.chainId))
    return { account: ethers.getAddress(accts[0]), chainId: Number(netAfter.chainId) }
  }, [getProvider])

  const ensureConnected = useCallback(async () => {
    if (!account) return await connect()
    const provider = getProvider()
    const net = await provider.getNetwork()
    const current = Number(net.chainId)
    if (current !== DEFAULT_CHAIN_ID) {
      await connect()
    }
    return { account, chainId: current }
  }, [account, connect, getProvider])

  useEffect(() => {
    if (!window.ethereum) return
    const onAccountsChanged = (accts) => {
      setAccount(accts && accts.length ? ethers.getAddress(accts[0]) : null)
    }
    const onChainChanged = (hexId) => {
      const n = parseInt(hexId, 16)
      setChainId(n)
      // Reset provider cache on chain switch
      providerRef.current = null
    }
    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged)
      window.ethereum.removeListener('chainChanged', onChainChanged)
    }
  }, [])

  const value = useMemo(() => ({
    account,
    chainId,
    connect,
    ensureConnected,
    getProvider,
  }), [account, chainId, connect, ensureConnected, getProvider])

  return value
}

export { useMetaMask }
export default useMetaMask



