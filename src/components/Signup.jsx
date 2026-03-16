import { useState } from 'react'
import { db } from '../firebase'
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'

export default function Signup({ onComplete }) {
  const [mobile, setMobile]       = useState('')
  const [form, setForm]           = useState({ firstName: '', lastName: '', email: '' })
  const [step, setStep]           = useState('mobile')   // 'mobile' | 'register'
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // ── Step 1: user enters mobile → check Firestore ──
  const handleMobileCheck = async () => {
    if (mobile.length !== 10) { setError('Valid 10-digit mobile daalo'); return }
    setLoading(true)
    setError('')
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('mobile', '==', mobile))
      )
      if (!snap.empty) {
        // Returning user — fetch from Firestore and login directly
        const docSnap = snap.docs[0]
        const userData = { ...docSnap.data(), id: docSnap.id }
        localStorage.setItem('nagrik_user', JSON.stringify(userData))
        onComplete(userData)
        return
      }
      // New user — show registration fields
      setStep('register')
    } catch (e) {
      console.error(e)
      setError('Network error. Try again.')
    }
    setLoading(false)
  }

  // ── Step 2: new user fills name + email ──
  const handleRegister = async () => {
    if (!form.firstName || !form.email) { setError('Name aur email zaroori hai'); return }
    setLoading(true)
    setError('')
    try {
      // Double-check — avoid duplicate if user pressed back
      const snap = await getDocs(
        query(collection(db, 'users'), where('mobile', '==', mobile))
      )
      let userData
      if (!snap.empty) {
        const docSnap = snap.docs[0]
        userData = { ...docSnap.data(), id: docSnap.id }
      } else {
        const docRef = await addDoc(collection(db, 'users'), {
          firstName: form.firstName,
          lastName:  form.lastName,
          mobile,
          email:     form.email,
          createdAt: serverTimestamp(),
          reportsCount: 0,
          points: 0,
        })
        userData = { firstName: form.firstName, lastName: form.lastName, mobile, email: form.email, id: docRef.id }
      }
      localStorage.setItem('nagrik_user', JSON.stringify(userData))
      onComplete(userData)
    } catch (e) {
      console.error(e)
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
        .sg-sub { font-size: 14px; color: #555; text-align: center; margin-top: 6px; margin-bottom: 28px; line-height: 1.6; }
        .sg-mobile-row { display: flex; gap: 10px; margin-bottom: 12px; }
        .sg-input { width: 100%; background: #1A1A1A; border: 1.5px solid #252525; border-radius: 14px; padding: 14px 16px; color: #fff; font-size: 15px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.2s; margin-bottom: 12px; display: block; }
        .sg-input:focus { border-color: #FF6B00; }
        .sg-input::placeholder { color: #333; }
        .sg-input.no-mb { margin-bottom: 0; }
        .sg-btn { width: 100%; background: #FF6B00; color: #fff; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.2s; }
        .sg-btn:hover:not(:disabled) { background: #E55A00; }
        .sg-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sg-btn-sm { background: #FF6B00; color: #fff; border: none; border-radius: 14px; padding: 14px 20px; font-size: 15px; font-weight: 700; font-family: 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap; transition: background 0.2s; flex-shrink: 0; }
        .sg-btn-sm:hover:not(:disabled) { background: #E55A00; }
        .sg-btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
        .sg-back { background: transparent; border: none; color: #555; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; gap: 5px; margin-bottom: 18px; padding: 0; }
        .sg-back:hover { color: #888; }
        .sg-mobile-display { background: #FF6B0012; border: 1px solid #FF6B0030; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #FF6B00; font-weight: 600; }
        .sg-error { color: #FF3B30; font-size: 13px; text-align: center; margin-bottom: 10px; }
        .sg-privacy { font-size: 12px; color: #2A2A2A; text-align: center; margin-top: 14px; }
        .sg-divider { text-align: center; color: #2A2A2A; font-size: 12px; margin: 16px 0; }
      `}</style>

      <div className="sg-wrap">
        <div className="sg-card">
          <span className="sg-flag">🇮🇳</span>
          <div className="sg-title">NagrikAI</div>

          {step === 'mobile' && (
            <>
              <div className="sg-sub">
                Apna mobile number daalo — naye ho toh register ho jaoge, pehle se ho toh seedha login.
              </div>
              <div className="sg-mobile-row">
                <input
                  className="sg-input no-mb"
                  placeholder="10-digit mobile number"
                  value={mobile}
                  maxLength={10}
                  inputMode="numeric"
                  onChange={e => { setMobile(e.target.value.replace(/\D/g, '')); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleMobileCheck()}
                  style={{ flex: 1 }}
                />
                <button className="sg-btn-sm" onClick={handleMobileCheck} disabled={loading || mobile.length !== 10}>
                  {loading ? '...' : '→'}
                </button>
              </div>
              {error && <div className="sg-error">{error}</div>}
              <div className="sg-divider">Ek number = ek account, kisi bhi device se</div>
            </>
          )}

          {step === 'register' && (
            <>
              <button className="sg-back" onClick={() => { setStep('mobile'); setError('') }}>← Wapas</button>
              <div className="sg-mobile-display">📱 +91 {mobile}</div>
              <div className="sg-sub" style={{ marginBottom: 16 }}>Pehli baar ho? Thodi details do.</div>
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
                placeholder="Email Address *"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
              {error && <div className="sg-error">{error}</div>}
              <button className="sg-btn" onClick={handleRegister} disabled={loading}>
                {loading ? 'Saving...' : 'Register Karo 🚀'}
              </button>
            </>
          )}

          <div className="sg-privacy">🔒 Your data is safe. We never spam.</div>
        </div>
      </div>
    </>
  )
}