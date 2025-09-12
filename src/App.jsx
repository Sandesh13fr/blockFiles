import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import UploadPage from './pages/UploadPage'
import About from './pages/About'
import ClaimAccessPage from './pages/ClaimAccessPage'
import AppBackground from './AppBackground'
import Footer from './components/Footer'

export default function AppShell() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app-shell relative min-h-screen">
        <AppBackground />
        <Navbar />
        <div className="app-content relative z-10">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/claim/:cid/:linkId" element={<ClaimAccessPage />} />
          </Routes>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  )
}
