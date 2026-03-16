import { useState } from 'react'
import { mumbaiWards } from '../data/wardData'

const BMC_PASSWORD = 'bmc@2026'

export default function BmcLogin({ onLogin }) {
  const [ward, setWard] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = () => {
    if (!ward) { setError('Ward select karo!'); return }
    if (password !== BMC_PASSWORD) { setError('Wrong password!'); return }
    const wardData = mumbaiWards.find(w => w.ward === ward)
    localStorage.setItem('bmc_officer', JSON.stringify({ ward, wardData }))
    onLogin({ ward, wardData })
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0D0D; }
        .bl-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #0D0D0D; font-family: 'DM Sans', sans-serif; }
        .bl-card { width: 100%; max-width: 400px; background: #141414; border-radius: 28px; padding: 36px 28px; border: 1px solid #1E1E1E; }
        .bl-icon { font-size: 48px; text-align: center; display: block; margin-bottom: 12px; }
        .bl-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: #fff; text-align: center; }
        .bl-sub { font-size: 13px; color: #555; text-align: center; margin-top: 6px; margin-bottom: 28px; }
        .bl-label { font-size: 11px; color: #FF6B00; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; display: block; }
        .bl-select { width: 100%; background: #1A1A1A; border: 1.5px solid #252525; border-radius: 14px; padding: 14px 16px; color: #fff; font-size: 15px; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 16px; }
        .bl-select:focus { border-color: #FF6B00; }
        .bl-input { width: 100%; background: #1A1A1A; border: 1.5px solid #252525; border-radius: 14px; padding: 14px 16px; color: #fff; font-size: 15px; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 16px; display: block; }
        .bl-input:focus { border-color: #FF6B00; }
        .bl-input::placeholder { color: #333; }
        .bl-btn { width: 100%; background: #FF6B00; color: #fff; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; }
        .bl-btn:hover { background: #E55A00; }
        .bl-error { color: #FF3B30; font-size: 13px; text-align: center; margin-bottom: 12px; }
        .bl-hint { font-size: 11px; color: #2A2A2A; text-align: center; margin-top: 14px; }
      `}</style>
      <div className="bl-wrap">
        <div className="bl-card">
          <span className="bl-icon">🏛️</span>
          <div className="bl-title">BMC Officer Login</div>
          <div className="bl-sub">NagrikAI — Municipal Dashboard</div>

          <label className="bl-label">Select Your Ward</label>
          <select className="bl-select" value={ward} onChange={e => setWard(e.target.value)}>
            <option value="">-- Select Ward --</option>
            {mumbaiWards.map(w => (
              <option key={w.ward} value={w.ward}>{w.ward} — {w.name}</option>
            ))}
          </select>

          <label className="bl-label">Password</label>
          <input className="bl-input" type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />

          {error && <div className="bl-error">{error}</div>}

          <button className="bl-btn" onClick={handleLogin}>Login →</button>
          <div className="bl-hint">Password: bmc@2026</div>
        </div>
      </div>
    </>
  )
}