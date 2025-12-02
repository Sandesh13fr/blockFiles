import { motion } from 'framer-motion';

export default function About() {
  return (
    <div className="px-4 mx-auto max-w-6xl sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-20 mt-25">
      <div className="max-w-3xl mx-auto text-center">
        <motion.h1
          className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-white"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          About blockFiles
        </motion.h1>
        <motion.p
          className="mt-4 text-lg sm:text-xl text-slate-100"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.7 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        >
          blockFiles helps you store files on IPFS, verify ownership on‑chain, and share them anywhere using
          content IDs (CIDs). Your data stays yours—verifiable, portable, and independent of any single server.
        </motion.p>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <img src="https://iili.io/fzF23wF.md.png" alt="IPFS Illustration" className="w-full h-auto rounded-2xl" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        >
          <h2 className="text-2xl sm:text-3xl font-semibold text-white">How it works</h2>
          <p className="mt-3 text-slate-100">
            Upload files to IPFS and get CIDs that uniquely represent their content. Optionally, register those
            CIDs on‑chain with your wallet to leave a public proof of ownership. Anyone can retrieve the content
            by its CID via public gateways or their own node.
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2">
            <li className="text-slate-100">Content‑addressed: if the file changes, the CID changes.</li>
            <li className="text-slate-100">Optional on‑chain proof ties a CID to your wallet address.</li>
            <li className="text-slate-100">Minimal off‑chain metadata for quick listings and UX.</li>
          </ul>
        </motion.div>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          className="order-2 lg:order-1"
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h2 className="text-2xl sm:text-3xl font-semibold text-white">Why blockFiles?</h2>
          <p className="mt-3 text-slate-100">
            Traditional storage locks files to locations and providers. With blockFiles, your content is portable and
            verifiable. You keep control, and you decide how to share—by simply passing a CID.
          </p>
        </motion.div>
        <motion.div
          className="order-1 lg:order-2"
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
        >
          <img src="https://iili.io/fzFH7Mx.png" alt="blockFiles Logo" className="w-full h-auto rounded-2xl max-w-md mx-auto" />
        </motion.div>
      </div>

      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <img
            src="https://iili.io/fzF3AJV.md.png"
            alt="Interlinked files illustration"
            className="w-full h-auto rounded-2xl shadow-2xl"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
        >
          <h2 className="text-2xl sm:text-3xl font-semibold text-white">Built for teams</h2>
          <p className="mt-3 text-slate-100">
            Share one CID and everyone works from the same, verified copy. blockFiles keeps every revision portable,
            readable, and easy to hand off—no waiting, no vendor lock-in.
          </p>
          <p className="mt-3 text-slate-100">
            Sync once, prove ownership on-chain if you need it, and let peers fetch the file straight from IPFS.
            That’s all there is to staying aligned.
          </p>
        </motion.div>
      </div>
    </div>
  )
}



