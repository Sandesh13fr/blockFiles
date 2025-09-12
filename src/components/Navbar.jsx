import { NavLink } from 'react-router-dom'
import useMetaMask from '../hooks/useMetaMask'

export default function Navbar() {
  const { account, connect, disconnect } = useMetaMask()
  return (
    <header className="sticky inset-0 z-50 border-b border-transparent glass">
      <nav className="relative w-full flex items-center gap-6 pl-0 pr-4 sm:pr-6 transition-all duration-200 ease-in-out lg:px-12 py-5">
        <div className="relative flex items-center">
          <NavLink to="/" aria-label="Home">
            <img src="./src/assets/logo.png" loading="lazy" style={{color:'transparent'}} width="50" height="32" />
          </NavLink>
        </div>
        <ul className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center justify-center gap-20">
          <li className="pt-1 text-base lg:text-lg font-medium text-slate-700">
            <NavLink to="/" end className={({isActive}) => isActive ? 'text-white' : undefined}>Home</NavLink>
          </li>
          <li className="pt-1 text-base lg:text-lg font-medium text-slate-700">
            <NavLink to="/upload" className={({isActive}) => isActive ? 'text-white' : undefined}>Upload</NavLink>
          </li>
          <li className="pt-1 text-base lg:text-lg font-medium text-slate-700">
            <NavLink to="/about" className={({isActive}) => isActive ? 'text-white' : undefined}>About</NavLink>
          </li>
        </ul>
        <div className="flex-grow"></div>
        <div className="hidden items-center justify-center gap-3 md:flex">
          {account ? (
            <>
              <button onClick={disconnect} className="text-base lg:text-lg font-medium text-white bg-white/10 border border-white/30 px-3 py-1.5 rounded-full hover:bg-white/20" title="Click to disconnect">
                {account.slice(0, 6)}...{account.slice(-4)}
              </button>
              <NavLink to="/upload" className="px-5 py-2.5 text-base lg:text-lg transition-all duration-200 hover:bg-yellow-300 hover:text-black focus:text-black focus:bg-yellow-300 font-semibold text-white bg-black rounded-full">
                Go to Upload
              </NavLink>
            </>
          ) : (
            <button onClick={connect} className="px-5 py-2.5 text-base lg:text-lg transition-all duration-200 hover:bg-yellow-300 hover:text-black focus:text-black focus:bg-yellow-300 font-semibold text-white bg-black rounded-full">
              Connect Wallet
            </button>
          )}
        </div>
        <div className="relative flex items-center justify-center md:hidden">
          <button type="button" aria-label="Open menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true" className="h-6 w-auto text-slate-900"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"></path></svg>
          </button>
        </div>
      </nav>
    </header>
  )
}


