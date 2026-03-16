import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import ComplaintPage from './components/ComplaintPage.jsx'
import BmcDashboard from './components/BmcDashboard.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/complaint/:id" element={<ComplaintPage />} />
        <Route path="/bmc" element={<BmcDashboard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)