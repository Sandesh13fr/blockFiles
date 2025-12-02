import { NavLink } from 'react-router-dom'
import useMetaMask from '../hooks/useMetaMask'
import { motion } from 'framer-motion'

export default function Home() {
  const { account, isMetaMask, connect } = useMetaMask();
  return (
    <div>
      <motion.section
        className="pt-2 pb-10 sm:pb-16 lg:pb-24 mt-30"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <motion.div
              className="w-full max-w-2xl text-center"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.7 }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            >
              <p className="text-base font-semibold tracking-wider text-blue-200 uppercase">Decentralized storage for everyone</p>
              <h1 className="mt- text-4xl font-bold text-white lg:mt-8 sm:text-6xl xl:text-8xl">Own your data with IPFS</h1>
              <p className=" text-base text-slate-100 lg:mt-8 sm:text-xl">Upload files to IPFS, verify ownership on-chain, and download from a public gateway.</p>
              {!account ? (
                <button onClick={connect} className="inline-flex items-center px-6 py-4 mt-8 font-semibold text-black transition-all duration-200 bg-yellow-300 rounded-full lg:mt-16 hover:bg-yellow-400 focus:bg-yellow-400" role="button">
                  Connect Wallet
                  <svg className="w-6 h-6 ml-8 -mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 mt-8 lg:mt-16">
                  <span className="px-4 py-2 rounded-full bg-white/10 border border-white/30 text-white text-base">
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </span>
                  <NavLink to="/upload" className="inline-flex items-center px-6 py-4 font-semibold text-black transition-all duration-200 bg-yellow-300 rounded-full hover:bg-yellow-400 focus:bg-yellow-400" role="button">
                    Start Uploading
                    <svg className="w-6 h-6 ml-8 -mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </NavLink>
                </div>
              )}
              <p className="mt-5 text-slate-200">Already connected? <NavLink to="/upload" className="text-white transition-all duration-200 hover:underline">Go to Upload</NavLink></p>
              <blockquote className="mt-8 p-4 border-l-4 glass rounded" style={{borderColor:'rgba(255,255,255,0.35)'}}>
                <p className="text-slate-100 italic">“Decentralization isn’t just a feature. It’s a return of control to the individual.”</p>
                <footer className="mt-2 text-sm text-slate-200">— blockFiles</footer>
              </blockquote>
            </motion.div>
            {/* Image removed from hero section */}
          </div>
        </div>
  </motion.section>
      <motion.section
        className="py-10 sm:py-14 lg:py-20"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      >
        <div className="px-4 mx-auto max-w-5xl sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h2
              className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.7 }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            >
              What is blockFiles ?
            </motion.h2>
            <motion.p
              className="mt-4 text-lg sm:text-xl text-slate-100"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.7 }}
              transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
            >
              blockFiles is a decentralized file storage system that uses IPFS and blockchain to ensure secure,
              transparent storage and retrieval. You retain full control over your data and can optionally anchor
              ownership on‑chain by registering your file’s content ID (CID) with your wallet. Files are content‑
              addressed—meaning they’re identified by what they are, not where they live—so integrity is verifiable
              by design. With simple sharing via CIDs, optional on‑chain proofs, and a privacy‑respecting workflow,
              blockFiles offers a secure, reliable alternative to traditional centralized storage without
              compromising usability or security.
            </motion.p>
          </div>
        </div>
      </motion.section>
      <section className="py-10 sm:py-14 lg:py-20">
        <div className="px-4 mx-auto max-w-6xl sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-8">Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              title="AI Doc Assistant"
              body="Chat with anything you pinned on Pinata. Gemini indexes your PDFs, DOCX, CSV, or plain text and cites the exact CID for every answer."
            />
            <FeatureCard
              title="On-chain Ownership & Transfers"
              body="Register a CID to your wallet, transfer it securely, and prove authenticity directly from the FileOwnershipRegistry smart contract."
            />
            <FeatureCard
              title="Access & Sharing Links"
              body="Generate read/write links, revoke access instantly, or just drop a CID so teammates can fetch from any IPFS gateway."
            />
            <FeatureCard
              title="Wallet-first Security"
              body="Everything is signed locally in MetaMask—no seed phrases, no custodial signing, no servers holding your keys."
            />
            <FeatureCard
              title="Pinata + PostgreSQL Sync"
              body="Uploads are pinned, recorded in Postgres, and synced to the chatbot index so your metadata stays searchable and auditable."
            />
            <FeatureCard
              title="Scalable IPFS Storage"
              body="Store once, fetch anywhere. Bring your own gateway, run a node, or stay on public infrastructure while keeping content-addressed integrity."
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ title, body }) {
  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-white font-semibold text-xl">{title}</h3>
      <p className="text-slate-100 mt-2 text-base">{body}</p>
    </div>
  )
}


