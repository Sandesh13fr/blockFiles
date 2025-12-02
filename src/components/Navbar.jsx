import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import useMetaMask from '../hooks/useMetaMask'

const navItems = [
  { label: 'Home', to: '/', exact: true },
  { label: 'Upload', to: '/upload' },
  { label: 'Doc Chat', to: '/chat' },
  { label: 'About', to: '/about' }
]

export default function Navbar() {
  const { account, connect, disconnect } = useMetaMask()
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = () => setMobileOpen(false)
  const toggleMobile = () => setMobileOpen(v => !v)

  const pillClasses = isActive =>
    [
      'relative rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-300',
      'hover:text-white/90 hover:bg-white/10',
      isActive ? 'text-white bg-white/10 shadow-[0_10px_40px_-15px_rgba(255,255,255,0.8)]' : 'text-white/70'
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-3 sm:px-6 pt-4">
      <div className="absolute inset-x-0 top-0 mx-auto h-24 max-w-5xl bg-gradient-to-r from-indigo-500/30 via-purple-500/20 to-emerald-400/20 blur-3xl opacity-60 pointer-events-none" />
      <nav className="relative mx-auto flex max-w-6xl items-center gap-4 rounded-3xl border border-white/20 bg-white/10 px-4 py-3 sm:px-6 lg:px-8 shadow-[0_8px_35px_rgba(15,15,35,0.35)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <NavLink to="/" aria-label="Home" className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br bg-red-50 p-[1px]">
              <img src="/src/assets/logo.png" alt="blockFiles Logo" className="w-full h-auto rounded-1xl max-w-xl mx-auto" />
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="font-semibold text-white text-base">blockFiles</span>
              <span className="text-xs uppercase tracking-[0.4em] text-white/60">D.F.S.S.</span>
            </div>
          </NavLink>
        </div>

        <ul className="hidden flex-1 items-center justify-center gap-3 md:flex">
          {navItems.map(({ label, to, exact }) => (
            <li key={to}>
              <NavLink to={to} end={exact} className={({ isActive }) => pillClasses(isActive)}>
                <span className="relative z-10">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          {account ? (
            <>
              <button
                onClick={disconnect}
                className="group relative overflow-hidden rounded-full border border-white/30 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white/60 hover:bg-white/15"
                title="Click to disconnect"
              >
                <span className="text-xs uppercase tracking-widest text-white/50">Wallet</span>
                <br className="hidden lg:block" />
                <span className="font-mono text-base text-white">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
              </button>
              <NavLink
                to="/upload"
                className="relative overflow-hidden rounded-full bg-gradient-to-r bg-yellow-300 hover:bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:scale-[1.02]"
              >
                <span className="drop-shadow-yellow-300">Go to Upload</span>
              </NavLink>
            </>
          ) : (
            <button
              onClick={connect}
              className="relative overflow-hidden rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(0,0,0,0.35)] transition hover:border-white/60 hover:bg-white/20"
            >
              Connect Wallet
            </button>
          )}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 md:hidden">
          <div className="text-xs font-semibold uppercase tracking-widest text-white/60">Menu</div>
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={toggleMobile}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white/80 shadow-[0_10px_25px_rgba(0,0,0,0.25)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-6 w-6">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      <div
        className={`md:hidden fixed inset-0 z-40 transition ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={closeMobile}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-slate-950/90 border-l border-white/10 p-6 text-white transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">blockFiles</p>
              <p className="text-lg font-semibold">Menu</p>
            </div>
            <button onClick={closeMobile} aria-label="Close menu" className="p-2 rounded-full bg-white/10 hover:bg-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="space-y-3">
            {navItems.map(({ label, to, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `block rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/5'}`
                }
                onClick={closeMobile}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-8 space-y-3">
            {account ? (
              <>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm">
                  <p className="text-white/50 text-xs uppercase tracking-[0.4em]">Connected</p>
                  <p className="mt-1 font-mono text-base">{account.slice(0, 6)}...{account.slice(-4)}</p>
                </div>
                <button
                  onClick={() => {
                    disconnect()
                    closeMobile()
                  }}
                  className="w-full rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  connect()
                  closeMobile()
                }}
                className="w-full rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </aside>
      </div>
    </header>
  )
}


