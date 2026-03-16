import { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export default function Signup({ onComplete }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', mobile: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.firstName || !form.mobile || !form.email) {
      setError('Saari fields fill karo!'); return
    }
    if (form.mobile.length !== 10) {
      setError('Valid 10-digit mobile number daalo!'); return
    }
    setLoading(true)
    try {
      const docRef = await addDoc(collection(db, 'users'), {
        ...form,
        createdAt: serverTimestamp(),
        reportsCount: 0,
        points: 0,
      })
      // Save full user object including id (docRef.id) to localStorage
      const userData = { ...form, id: docRef.id }
      localStorage.setItem('nagrik_user', JSON.stringify(userData))
      onComplete(userData)
    } catch (e) {
      console.error('Signup error:', e)
      setError('Error saving data. Try again!')
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0D0D; }
        .sg-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #0D0D0D; font-family: 'DM Sans', sans-serif; }
        .sg-card { width: 100%; max-width: 400px; background: #141414; border-radius: 28px; padding: 36px 28px; border: 1px solid #1E1E1E; }
        .sg-flag { font-size: 52px; display: block; text-align: center; margin-bottom: 12px; }
        .sg-title { font-family: 'Syne', sans-serif; font-size: 34px; font-weight: 800; color: #FF6B00; text-align: center; }
        .sg-sub { font-size: 14px; color: #555; text-align: center; margin-top: 6px; margin-bottom: 28px; }
        .sg-input { width: 100%; background: #1A1A1A; border: 1.5px solid #252525; border-radius: 14px; padding: 14px 16px; color: #fff; font-size: 15px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.2s; margin-bottom: 12px; display: block; }
        .sg-input:focus { border-color: #FF6B00; }
        .sg-input::placeholder { color: #333; }
        .sg-btn { width: 100%; background: #FF6B00; color: #fff; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 4px; transition: background 0.2s; }
        .sg-btn:hover:not(:disabled) { background: #E55A00; }
        .sg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sg-error { color: #FF3B30; font-size: 13px; text-align: center; margin-bottom: 10px; }
        .sg-privacy { font-size: 12px; color: #2A2A2A; text-align: center; margin-top: 14px; }
      `}</style>
      <div className="sg-wrap">
        <div className="sg-card">
          <span className="sg-flag">🇮🇳</span>
          <div className="sg-title">NagrikAI</div>
          <div className="sg-sub">Mumbai ki awaaz, AI ki taakat</div>
          <input
            className="sg-input"
            placeholder="First Name *"
            value={form.firstName}
            onChange={e => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            className="sg-input"
            placeholder="Last Name"
            value={form.lastName}
            onChange={e => setForm({ ...form, lastName: e.target.value })}
          />
          <input
            className="sg-input"
            placeholder="Mobile Number * (10 digits)"
            value={form.mobile}
            maxLength={10}
            onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
          />
          <input
            className="sg-input"
            placeholder="Email Address *"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          {error && <div className="sg-error">{error}</div>}
          <button className="sg-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Get Started 🚀'}
          </button>
          <div className="sg-privacy">🔒 Your data is safe. We never spam.</div>
        </div>
      </div>
    </>
  )
}