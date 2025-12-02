import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import './index.css'
import Navbar from './components/Navbar'
import AppBackground from './AppBackground'
import Footer from './components/Footer'
import Home from './pages/Home'

const UploadPage = lazy(() => import('./pages/UploadPage'))
const About = lazy(() => import('./pages/About'))
const ClaimAccessPage = lazy(() => import('./pages/ClaimAccessPage'))
const DocChat = lazy(() => import('./pages/DocChat'))

export default function AppShell() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-shell relative min-h-screen">
        <AppBackground />
        <Navbar />
        <div className="app-content relative z-10">
          <Suspense fallback={<div className="p-10 text-center text-white/70">Loading…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/about" element={<About />} />
              <Route path="/claim/:cid/:linkId" element={<ClaimAccessPage />} />
              <Route path="/chat" element={<DocChat />} />
            </Routes>
          </Suspense>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  )
}
