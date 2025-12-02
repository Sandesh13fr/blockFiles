export default function Footer() {
  return (
    <footer className="w-full relative z-10 mt-12">
      <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
        <div className="glass rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="https://iili.io/fzFH7Mx.png" alt="logo" className="w-10 h-10" />
            <span className="text-white font-semibold">blockFiles</span>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-6 text-slate-100">
            <li>
              <a href="/about" className="hover:underline">About</a>
            </li>
            <li>
              <a href="/upload" className="hover:underline">Upload</a>
            </li>
            <li>
              <a href="https://github.com/Sandesh13fr" target="_blank" rel="noreferrer" className="hover:underline">Contribute</a>
            </li>
            <li>
              <p className="hover:underline">Made with ❤️ by Sandesh</p>
            </li>
          </ul>
        </div>
        <div className="py-6 text-center text-slate-300 text-sm">&copy; {new Date().getFullYear()} blockFiles</div>
      </div>
    </footer>
  )
}


