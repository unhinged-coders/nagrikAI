import { useState, useEffect, useRef } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from './Firebase.js'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import emailjs from 'emailjs-com'
import Signup from './components/Signup'
import MapView from './components/MapView'
import Step3 from './components/Step3'
import { detectWard } from './data/wardData'
import './App.css'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

const generateComplaintId = () => {
  const rand = Math.floor(Math.random() * 90000) + 10000
  return `NM-2026-${rand}`
}

export default function App() {
  const [user, setUser] = useState(null)
  const [step, setStep] = useState(1) // 1=camera, 2=result, 3=story
  const [photo, setPhoto] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState(null)
  const [ward, setWard] = useState(null)
  const [address, setAddress] = useState('')
  const [complaintId] = useState(generateComplaintId())
  const [emailSent, setEmailSent] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('nagrik_user')
    if (saved) setUser(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords
          setLocation({ lat: latitude, lng: longitude })
          setWard(detectWard(latitude, longitude))
        },
        () => {
          // Default Mumbai
          setLocation({ lat: 19.0760, lng: 72.8777 })
          setWard(detectWard(19.0760, 72.8777))
        }
      )
    }
  }, [])

  const handlePhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  const analyzePhoto = async () => {
    if (!photo) return
    setLoading(true)
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const base64 = photo.split(',')[1]
      const prompt = `You are a Mumbai civic issue classifier. Analyze this image and respond ONLY in this exact JSON format:
{
  "issueType": "one of: Pothole, Garbage, Broken Streetlight, Waterlogging, Encroachment, Broken Road, Open Drain, Other",
  "severity": "one of: Low, Medium, High",
  "description": "1-2 sentence description of the issue in English"
}
Only respond with valid JSON, nothing else.`
      const res = await model.generateContent([
        prompt,
        { inlineData: { mimeType: 'image/jpeg', data: base64 } }
      ])
      const text = res.response.text().trim()
      const clean = text.replace(/```json|```/g, '').trim()
      setResult(JSON.parse(clean))
      setStep(2)
    } catch (e) {
      alert('AI analysis failed. Check your API key!')
      console.error(e)
    }
    setLoading(false)
  }

  const sendEmail = async () => {
    if (!ward || !result) return
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          complaint_id: complaintId,
          officer_name: ward.wardOfficerName,
          officer_email: ward.wardOfficeEmail,
          user_name: `${user?.firstName} ${user?.lastName}`,
          user_mobile: user?.mobile,
          issue_type: result.issueType,
          severity: result.severity,
          description: result.description,
          area: ward.name,
          ward: ward.ward,
          address: address || 'Not provided',
          date: new Date().toLocaleDateString('en-IN'),
          complaint_url: `https://nagrik-ai.vercel.app/c/${complaintId}`,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      )
      setEmailSent(true)
    } catch (e) {
      console.error('Email failed:', e)
    }
  }

  const submitComplaint = async () => {
    setLoading(true)
    try {
      await addDoc(collection(db, 'complaints'), {
        complaintId,
        userId: user?.id || 'anonymous',
        userName: `${user?.firstName} ${user?.lastName}`,
        issueType: result.issueType,
        severity: result.severity,
        description: result.description,
        address,
        ward: ward?.ward,
        wardName: ward?.name,
        wardOfficer: ward?.wardOfficerName,
        wardEmail: ward?.wardOfficeEmail,
        location: location || null,
        status: 'Open',
        upvotes: 0,
        emailSent: false,
        createdAt: serverTimestamp(),
        publicUrl: `https://nagrik-ai.vercel.app/c/${complaintId}`,
      })
      await sendEmail()
      setSubmitted(true)
      setStep(3)
    } catch (e) {
      console.error(e)
      alert('Submission failed. Try again!')
    }
    setLoading(false)
  }

  if (!user) return <Signup onComplete={setUser} />

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="logo">NagrikAI 🇮🇳</span>
          <span className="tagline">Mumbai ki awaaz</span>
        </div>
        <div className="header-right">
          <span className="user-name">👤 {user.firstName}</span>
          {ward && <span className="ward-badge">📍 {ward.ward}</span>}
        </div>
      </header>

      {/* Step indicator */}
      <div className="steps-bar">
        {['📸 Photo', '🤖 AI Result', '📱 Share'].map((s, i) => (
          <div key={i} className={`step-dot ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
            {s}
          </div>
        ))}
      </div>

      <main className="main">

        {/* STEP 1 — Camera */}
        {step === 1 && (
          <div className="step-container">
            <h2 className="section-title">📸 Photo Lo</h2>
            <p className="section-sub">Civic issue ki photo lo — AI baaki sab karega</p>

            <div className="photo-area" onClick={() => fileRef.current?.click()}>
              {photo ? (
                <img src={photo} alt="preview" className="photo-preview" />
              ) : (
                <div className="photo-placeholder">
                  <span className="camera-icon">📷</span>
                  <p>Tap to take photo</p>
                  <p className="hint">Pothole, Garbage, Streetlight issues</p>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              style={{ display: 'none' }}
            />

            {photo && (
              <>
                <div className="address-section">
                  <label className="input-label">📍 Specific Address (optional)</label>
                  <input
                    className="input"
                    placeholder="e.g. Near SBI Bank, Linking Road..."
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                  />
                </div>

                {ward && (
                  <div className="ward-info">
                    <span>🏢 Ward {ward.ward} — {ward.name}</span>
                    <span>👮 {ward.wardOfficerName}</span>
                  </div>
                )}

                <button className="btn-primary" onClick={analyzePhoto} disabled={loading}>
                  {loading ? '🤖 AI Analyzing...' : '🤖 Analyze with AI'}
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 2 — AI Result */}
        {step === 2 && result && (
          <div className="step-container">
            <h2 className="section-title">🤖 AI Result</h2>

            <div className="result-card">
              <div className="result-row">
                <div className="result-item">
                  <span className="result-label">Issue Type</span>
                  <span className="result-value orange">{result.issueType}</span>
                </div>
                <div className="result-item">
                  <span className="result-label">Severity</span>
                  <span className={`result-value severity-${result.severity?.toLowerCase()}`}>
                    {result.severity === 'High' ? '🔴' : result.severity === 'Medium' ? '🟡' : '🟢'} {result.severity}
                  </span>
                </div>
              </div>
              <div className="result-desc">
                <span className="result-label">Description</span>
                <p>{result.description}</p>
              </div>
            </div>

            <div className="photo-thumb">
              <img src={photo} alt="complaint" style={{ width: '100%', borderRadius: '12px', maxHeight: '200px', objectFit: 'cover' }} />
            </div>

            {location && <MapView lat={location.lat} lng={location.lng} ward={ward} />}

            {ward && (
              <div className="officer-card">
                <p className="officer-title">📧 Will be sent to:</p>
                <p className="officer-name">{ward.wardOfficerName}</p>
                <p className="officer-email">{ward.wardOfficeEmail}</p>
                <p className="complaint-id">🔖 ID: {complaintId}</p>
              </div>
            )}

            <button className="btn-primary" onClick={submitComplaint} disabled={loading}>
              {loading ? '📤 Submitting...' : '📤 Submit Complaint'}
            </button>

            <button className="btn-outline" onClick={() => setStep(1)}>
              ← Retake Photo
            </button>
          </div>
        )}

        {/* STEP 3 — Story */}
        {step === 3 && (
          <Step3
            result={result}
            photo={photo}
            ward={ward}
            address={address}
            complaintId={complaintId}
          />
        )}

      </main>
    </div>
  )
}