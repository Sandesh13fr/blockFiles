import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

const WalletContext = createContext({
  account: null,
  isMetaMask: false,
  connect: async () => {},
  disconnect: () => {},
})

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [isMetaMask, setIsMetaMask] = useState(false)
  const initializedRef = useRef(false)
  const allowRestoreRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    if (!window.ethereum) return
    setIsMetaMask(true)
    try {
      allowRestoreRef.current = localStorage.getItem('walletConnected') === '1'
    } catch {
      allowRestoreRef.current = false
    }

    const handleAccountsChanged = (accounts) => {
      const next = accounts && accounts.length > 0 ? accounts[0] : null
      // Only accept non-empty accounts automatically if restore is allowed.
      const restoreAllowed = allowRestoreRef.current || localStorage.getItem('walletConnected') === '1'
      if (next && !restoreAllowed) {
        // Ignore unsolicited auto-connection
        return
      }
      setAccount(next)
      try {
        if (next) {
          localStorage.setItem('walletConnected', '1')
          localStorage.setItem('walletAccount', next)
        } else {
          localStorage.removeItem('walletConnected')
          localStorage.removeItem('walletAccount')
        }
      } catch {}
    }

    const handleChainChanged = () => {
      // Reload to let dapp pick up new chain context safely
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    ;(async () => {
      try {
        if (allowRestoreRef.current) {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' })
          handleAccountsChanged(accounts || [])
        } else {
          // Ensure we start disconnected unless user explicitly connects
          setAccount(null)
        }
      } catch {}
    })()

    return () => {
      try { window.ethereum.removeListener('accountsChanged', handleAccountsChanged) } catch {}
      try { window.ethereum.removeListener('chainChanged', handleChainChanged) } catch {}
    }
  }, [])

  async function connect() {
    if (!window.ethereum) return
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const acc = accounts && accounts[0]
    setAccount(acc || null)
    try {
      if (acc) {
        localStorage.setItem('walletConnected', '1')
        localStorage.setItem('walletAccount', acc)
        allowRestoreRef.current = true
      }
    } catch {}
  }

  function disconnect() {
    setAccount(null)
    try {
      localStorage.removeItem('walletConnected')
      localStorage.removeItem('walletAccount')
    } catch {}
    allowRestoreRef.current = false
  }

  const value = useMemo(() => ({ account, isMetaMask, connect, disconnect }), [account, isMetaMask])

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  return useContext(WalletContext)
}


