import { useWallet } from '../contexts/WalletContext.jsx'

function useMetaMask() {
  return useWallet()
}

export { useMetaMask }
export default useMetaMask



