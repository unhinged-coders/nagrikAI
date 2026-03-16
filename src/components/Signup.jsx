import { useState } from 'react'
import { db } from '../Firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

export default function Signup({ onComplete }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', mobile: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.firstName || !form.mobile || !form.email) {
      setError('Saari fields fill karo!')
      return
    }
    if (form.mobile.length !== 10) {
      setError('Valid 10-digit mobile number daalo!')
      return
    }
    setLoading(true)
    try {
      const docRef = await addDoc(collection(db, 'users'), {
        ...form,
        createdAt: serverTimestamp(),
        reportsCount: 0,
        points: 0,
      })
      const userData = { ...form, id: docRef.id }
      localStorage.setItem('nagrik_user', JSON.stringify(userData))
      onComplete(userData)
    } catch (e) {
      setError('Error saving data. Try again!')
    }
    setLoading(false)
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <span className="flag">🇮🇳</span>
          <h1>NagrikAI</h1>
          <p>Mumbai ki awaaz, AI ki taakat</p>
        </div>

        <div className="form-group">
          <input
            className="input"
            placeholder="First Name *"
            value={form.firstName}
            onChange={e => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            className="input"
            placeholder="Last Name"
            value={form.lastName}
            onChange={e => setForm({ ...form, lastName: e.target.value })}
          />
          <input
            className="input"
            placeholder="Mobile Number * (10 digits)"
            value={form.mobile}
            maxLength={10}
            onChange={e => setForm({ ...form, mobile: e.target.value.replace(/\D/g, '') })}
          />
          <input
            className="input"
            placeholder="Email Address *"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : 'Get Started 🚀'}
        </button>

        <p className="privacy-text">🔒 Your data is safe. We never spam.</p>
      </div>
    </div>
  )
}