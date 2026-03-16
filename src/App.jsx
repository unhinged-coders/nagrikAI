import { useState, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import MapView from './components/MapView'
import Step3 from './components/Step3'
import Signup from './components/Signup'
import { detectWard, generateComplaintId } from './data/wardData'
import 'leaflet/dist/leaflet.css'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

const severityColor = (s) => s === 'High' ? '#FF3B30' : s === 'Medium' ? '#FF9500' : '#34C759'
const severityBg   = (s) => s === 'High' ? '#FF3B3018' : s === 'Medium' ? '#FF950018' : '#34C75918'
const issueIcon    = (t) => ({ Pothole: '🕳️', Garbage: '🗑️', 'Broken Streetlight': '💡', Waterlogging: '🌊' }[t] || '⚠️')

export default function App() {
  const [user, setUser]                           = useState(null)
  const [result, setResult]                       = useState(null)
  const [location, setLocation]                   = useState(null)
  const [loading, setLoading]                     = useState(false)
  const [preview, setPreview]                     = useState(null)
  const [step, setStep]                           = useState(1)
  const [addressInput, setAddressInput]           = useState('')
  const [complaintId, setComplaintId]             = useState(null)
  const [saving, setSaving]                       = useState(false)
  const [showProfile, setShowProfile]             = useState(false)
  const [complaints, setComplaints]               = useState([])
  const [loadingComplaints, setLoadingComplaints] = useState(false)
  const [photoError, setPhotoError]               = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('nagrik_user')
    if (saved) setUser(JSON.parse(saved))

    navigator.geolocation.watchPosition(
      (pos) => {
        const ward = detectWard(pos.coords.latitude, pos.coords.longitude)
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, ward })
      },
      () => {
        const ward = detectWard(19.0760, 72.8777)
        setLocation({ lat: 19.0760, lng: 72.8777, ward })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )

    const onRestart = () => {
      setStep(1); setResult(null); setPreview(null)
      setAddressInput(''); setComplaintId(null); setPhotoError('')
    }
    window.addEventListener('restartApp', onRestart)
    return () => window.removeEventListener('restartApp', onRestart)
  }, [])

  const loadComplaints = async (uid) => {
    setLoadingComplaints(true)
    try {
      const q = query(collection(db, 'complaints'), where('userId', '==', uid))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setComplaints(list)
    } catch (e) { console.error(e) }
    setLoadingComplaints(false)
  }

  const openProfile = () => {
    if (user) loadComplaints(user.id)
    setShowProfile(true)
  }

  const handlePhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setPhotoError('')
    setLoading(true)

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1]
        const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const res    = await model.generateContent([
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          `You are a strict Mumbai civic issue detector for BMC.
Analyze this image carefully.

ONLY accept these valid civic problems visible in public areas/roads:
Pothole, Garbage dumping, Broken Streetlight, Waterlogging.

If image shows a valid civic issue → reply ONLY with JSON (no extra text):
{"issueType":"Pothole/Garbage/Broken Streetlight/Waterlogging/Other","severity":"Low/Medium/High","description":"one line in English","isValid":true}

If image is NOT a civic issue (selfie, food, animal, indoor photo, nature, random object, person, car, building without damage, etc.) → reply with exactly:
NOT_CIVIC_ISSUE

Be very strict. When in doubt → NOT_CIVIC_ISSUE`
        ])

        const text  = res.response.text().trim()
        const clean = text.replace(/```json|```/g, '').trim()

        if (clean === 'NOT_CIVIC_ISSUE' || !clean.startsWith('{')) {
          setLoading(false)
          setPreview(null)
          setPhotoError('Yeh civic issue nahi lagta. Pothole, garbage, broken streetlight ya waterlogging ki clear photo lo.')
          return
        }

        const parsed = JSON.parse(clean)
        setResult(parsed)
        setLoading(false)
        setStep(2)

      } catch (err) {
        console.error(err)
        setLoading(false)
        setPreview(null)
        setPhotoError('Image analyze nahi ho saki. Dobara try karo.')
      }
    }
  }

  const handleProceed = async () => {
  setSaving(true)
  const cid = generateComplaintId()
  setComplaintId(cid)

  let beforePhotoUrl = null

  try {
    if (preview) {
      const response = await fetch(preview)
      const blob = await response.blob()
      const photoRef = ref(storage, `complaints/${cid}/before.jpg`)
      await uploadBytes(photoRef, blob)
      beforePhotoUrl = await getDownloadURL(photoRef)
    }

    await addDoc(collection(db, 'complaints'), {
      complaintId: cid,
      userId: user.id,
      userFirstName: user.firstName,
      userLastName: user.lastName,
      userMobile: user.mobile,
      userEmail: user.email,
      issueType: result.issueType,
      severity: result.severity,
      description: result.description,
      addressDetail: addressInput.trim(),
      ward: location.ward.ward,
      wardName: location.ward.name,
      lat: location.lat,
      lng: location.lng,
      createdAt: new Date().toISOString(),
      status: 'Pending',
      beforePhoto: beforePhotoUrl,
      afterPhoto: null,
      supportCount: 0,
      supporters: [],
    })
  } catch (e) { console.error('Firestore save error:', e) }

  setResult(r => ({ ...r, addressDetail: addressInput.trim() }))
  setSaving(false)
  setStep(3)
}
  if (!user) return <Signup onComplete={(u) => setUser(u)} />

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0D0D; min-height: 100vh; }
        .app { max-width: 430px; margin: 0 auto; min-height: 100vh; background: #0D0D0D; color: #fff; font-family: 'DM Sans', sans-serif; }
        .hdr { padding: 20px 20px 0; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .logo span { color: #FF6B00; }
        .hdr-right { display: flex; align-items: center; gap: 8px; }
        .step-dots { display: flex; align-items: center; gap: 5px; }
        .sd { width: 6px; height: 6px; border-radius: 3px; background: #222; transition: all 0.3s; }
        .sd.active { width: 18px; background: #FF6B00; }
        .sd.done { background: #34C759; }
        .user-chip { background: #1A1A1A; border: 1px solid #242424; border-radius: 100px; padding: 5px 12px 5px 6px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: border-color 0.2s; }
        .user-chip:hover { border-color: #FF6B00; }
        .user-av { width: 26px; height: 26px; background: #FF6B00; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
        .user-nm { font-size: 13px; font-weight: 600; color: #bbb; }
        .welcome { margin: 10px 20px 4px; padding: 9px 14px; background: #FF6B000D; border: 1px solid #FF6B0025; border-radius: 10px; font-size: 13px; color: #FF6B00; }
        .loc-bar { margin: 10px 20px; background: #1A1A1A; border: 1px solid #222; border-radius: 12px; padding: 11px 15px; display: flex; align-items: center; gap: 8px; }
        .loc-dot { width: 8px; height: 8px; border-radius: 50%; background: #34C759; animation: pulse 2s infinite; flex-shrink: 0; }
        .loc-dot.detecting { background: #FF9500; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(1.25)} }
        .loc-text { font-size: 13px; color: #888; flex: 1; }
        .loc-text strong { color: #fff; }
        .ward-pill { background: #FF6B0018; border: 1px solid #FF6B0040; color: #FF6B00; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 7px; white-space: nowrap; }
        .upload-wrap { padding: 10px 20px 24px; }
        .upload-card { background: #141414; border: 2px dashed #252525; border-radius: 24px; padding: 40px 20px; text-align: center; position: relative; overflow: hidden; }
        .upload-card::before { content:''; position:absolute; inset:0; background: radial-gradient(circle at 50% 40%, #FF6B000A 0%, transparent 65%); pointer-events:none; }
        .upload-icon { font-size: 50px; display: block; margin-bottom: 12px; }
        .upload-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 6px; }
        .upload-sub { font-size: 13px; color: #555; margin-bottom: 22px; line-height: 1.6; }
        .cam-label { display: inline-block; background: #FF6B00; color: #fff; padding: 13px 28px; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; position: relative; }
        .cam-label:hover { background: #E55A00; }
        .cam-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .preview-img { width: 100%; border-radius: 14px; margin-top: 16px; display: block; }
        .ai-loading { display: inline-flex; align-items: center; gap: 10px; background: #1E1E1E; border: 1px solid #2A2A2A; padding: 11px 20px; border-radius: 100px; margin-top: 14px; }
        .spin { width: 16px; height: 16px; border: 2px solid #2A2A2A; border-top-color: #FF6B00; border-radius: 50%; animation: sp 0.8s linear infinite; }
        @keyframes sp { to { transform: rotate(360deg); } }
        .ai-txt { font-size: 13px; color: #888; }
        .photo-error { margin: 12px 0 0; background: #FF3B3012; border: 1px solid #FF3B3035; color: #FF3B30; padding: 13px 16px; border-radius: 14px; font-size: 14px; line-height: 1.6; text-align: center; }
        .photo-error-icon { font-size: 28px; display: block; margin-bottom: 6px; }
        .result-wrap { padding: 0 20px 24px; }
        .sec-label { font-size: 11px; color: #555; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; font-weight: 600; }
        .issue-card { background: #141414; border-radius: 20px; overflow: hidden; margin-bottom: 12px; border: 1px solid #1E1E1E; }
        .issue-hdr { padding: 16px 18px; display: flex; align-items: flex-start; gap: 14px; }
        .issue-ico { width: 50px; height: 50px; border-radius: 14px; background: #1E1E1E; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
        .issue-info { flex: 1; }
        .issue-type { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 4px; }
        .issue-desc { font-size: 13px; color: #777; line-height: 1.55; }
        .sev-tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; margin-top: 9px; }
        .divider { height: 1px; background: #1E1E1E; }
        .loc-info { padding: 13px 18px; display: flex; align-items: center; gap: 12px; }
        .loc-info-ico { font-size: 18px; }
        .loc-info-det { flex: 1; }
        .loc-area { font-size: 14px; font-weight: 600; }
        .loc-ward { font-size: 12px; color: #555; margin-top: 2px; }
        .loc-covers { font-size: 11px; color: #3A3A3A; margin-top: 3px; }
        .officer-bar { background: #141414; border: 1px solid #1E1E1E; border-radius: 14px; padding: 13px 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px; }
        .officer-av { width: 38px; height: 38px; background: #1E1E1E; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .officer-name { font-size: 13px; font-weight: 700; }
        .officer-desig { font-size: 11px; color: #555; margin-top: 2px; }
        .addr-wrap { margin-bottom: 12px; }
        .addr-box { background: #141414; border: 1.5px solid #252525; border-radius: 16px; padding: 14px 16px; transition: border-color 0.2s; }
        .addr-box:focus-within { border-color: #FF6B00; }
        .addr-lbl { font-size: 10px; color: #FF6B00; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; }
        .addr-input { width: 100%; background: transparent; border: none; color: #ddd; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; resize: none; line-height: 1.65; }
        .addr-input::placeholder { color: #333; }
        .addr-hint { font-size: 11px; color: #3A3A3A; margin-top: 8px; line-height: 1.5; }
        .map-wrap { border-radius: 18px; overflow: hidden; margin-bottom: 12px; }
        .action-btn { width: 100%; padding: 15px; border: none; border-radius: 16px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; background: #FF6B00; color: #fff; }
        .action-btn:hover:not(:disabled) { background: #E55A00; transform: translateY(-1px); }
        .action-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .profile-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.82); z-index: 999; display: flex; align-items: flex-end; }
        .profile-sheet { background: #0F0F0F; border-radius: 28px 28px 0 0; padding: 24px 20px 44px; width: 100%; max-height: 88vh; overflow-y: auto; }
        .profile-hdr { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
        .profile-av { width: 50px; height: 50px; background: #FF6B00; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 21px; font-weight: 800; flex-shrink: 0; }
        .profile-name { font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800; }
        .profile-meta { font-size: 12px; color: #444; margin-top: 3px; }
        .profile-count { font-size: 12px; color: #FF6B00; margin-top: 4px; font-weight: 600; }
        .profile-close { margin-left: auto; background: #1A1A1A; border: none; color: #666; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .c-card { background: #161616; border: 1px solid #1E1E1E; border-radius: 16px; padding: 14px 15px; margin-bottom: 10px; }
        .c-card-hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .c-ico { font-size: 20px; }
        .c-type { font-size: 14px; font-weight: 700; flex: 1; }
        .c-sev { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 6px; }
        .c-id { font-size: 11px; color: #3A3A3A; font-family: monospace; margin-bottom: 6px; }
        .c-address { font-size: 12px; color: #666; margin-bottom: 5px; }
        .c-desc { font-size: 12px; color: #555; line-height: 1.5; margin-bottom: 6px; }
        .c-meta { font-size: 11px; color: #3A3A3A; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 6px; }
        .c-status { display: inline-block; background: #FF6B0015; color: #FF6B00; padding: 2px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; }
        .c-track { font-size: 11px; color: #FF6B00; cursor: pointer; margin-top: 4px; }
        .c-track:hover { text-decoration: underline; }
        .empty-state { text-align: center; padding: 48px 20px; color: #333; }
        .logout-btn { width: 100%; margin-top: 16px; padding: 13px; background: transparent; border: 1px solid #1E1E1E; color: #444; border-radius: 14px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; transition: all 0.2s; }
        .logout-btn:hover { border-color: #FF3B30; color: #FF3B30; }
      `}</style>

      <div className="app">
        <div className="hdr">
          <div className="logo">Nagrik<span>AI</span></div>
          <div className="hdr-right">
            <div className="step-dots">
              <div className={`sd ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`} />
              <div className={`sd ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`} />
              <div className={`sd ${step >= 3 ? 'active' : ''}`} />
            </div>
            <div className="user-chip" onClick={openProfile}>
              <div className="user-av">{user.firstName[0]}</div>
              <div className="user-nm">{user.firstName}</div>
            </div>
          </div>
        </div>

        {step === 1 && <div className="welcome">👋 Jai hind, {user.firstName}! Koi issue dikhe toh report karo.</div>}

        <div className="loc-bar">
          <div className={`loc-dot ${!location ? 'detecting' : ''}`} />
          <div className="loc-text">
            {location ? <><strong>{location.ward.name}</strong>, Mumbai</> : 'Location detect ho rahi hai...'}
          </div>
          {location && <div className="ward-pill">Ward {location.ward.ward}</div>}
        </div>

        {step === 1 && (
          <div className="upload-wrap">
            <div className="upload-card">
              <span className="upload-icon">📸</span>
              <div className="upload-title">Issue Report Karo</div>
              <div className="upload-sub">Pothole, garbage, broken light ya<br />waterlogging ki photo lo</div>
              <label className="cam-label">
                📷 Camera Kholo
                <input className="cam-input" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
              </label>
              {preview && <img src={preview} className="preview-img" alt="Preview" />}
              {loading && (
                <div style={{ textAlign: 'center', paddingTop: 16 }}>
                  <div className="ai-loading">
                    <div className="spin" />
                    <span className="ai-txt">AI analyze kar raha hai...</span>
                  </div>
                </div>
              )}
            </div>
            {photoError && (
              <div className="photo-error">
                <span className="photo-error-icon">🚫</span>
                {photoError}
              </div>
            )}
          </div>
        )}

        {step === 2 && result && location && (
          <div className="result-wrap">
            <div className="sec-label">AI Detection</div>
            <div className="issue-card">
              <div className="issue-hdr">
                <div className="issue-ico">{issueIcon(result.issueType)}</div>
                <div className="issue-info">
                  <div className="issue-type">{result.issueType}</div>
                  <div className="issue-desc">{result.description}</div>
                  <div className="sev-tag" style={{ background: severityBg(result.severity), color: severityColor(result.severity) }}>
                    ● {result.severity} Severity
                  </div>
                </div>
              </div>
              <div className="divider" />
              <div className="loc-info">
                <div className="loc-info-ico">📍</div>
                <div className="loc-info-det">
                  <div className="loc-area">{location.ward.name}, Mumbai</div>
                  <div className="loc-ward">BMC Ward {location.ward.ward}</div>
                  <div className="loc-covers">{location.ward.areas.slice(0, 4).join(' · ')}</div>
                </div>
              </div>
            </div>

            <div className="sec-label">Ward Officer</div>
            <div className="officer-bar">
              <div className="officer-av">👮</div>
              <div>
                <div className="officer-name">{location.ward.wardOfficerName}</div>
                <div className="officer-desig">{location.ward.wardOfficerDesignation}</div>
              </div>
            </div>

            <div className="sec-label">Exact Location (Optional)</div>
            <div className="addr-wrap">
              <div className="addr-box">
                <div className="addr-lbl">📍 Address Details</div>
                <textarea className="addr-input" rows={3} placeholder="Jaise: Shivaji Nagar, near petrol pump, Lane 3 ke aage..." value={addressInput} onChange={e => setAddressInput(e.target.value)} />
                <div className="addr-hint">ℹ️ Exact jagah likhne se BMC ko dhundhna aasaan hoga</div>
              </div>
            </div>

            <div className="sec-label">Location on Map</div>
            <div className="map-wrap">
              <MapView location={location} result={result} />
            </div>

            <button className="action-btn" onClick={handleProceed} disabled={saving}>
              {saving ? <><div className="spin" style={{ borderColor: '#ffffff30', borderTopColor: '#fff' }} /> Saving...</> : '📱 Instagram Story Banao →'}
            </button>
          </div>
        )}

        {step === 3 && result && location && complaintId && (
          <Step3 result={result} location={location} preview={preview} user={user} complaintId={complaintId} />
        )}
      </div>

      {showProfile && (
        <div className="profile-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-sheet" onClick={e => e.stopPropagation()}>
            <div className="profile-hdr">
              <div className="profile-av">{user.firstName[0]}</div>
              <div>
                <div className="profile-name">{user.firstName} {user.lastName}</div>
                <div className="profile-meta">{user.mobile} • {user.email}</div>
                <div className="profile-count">{complaints.length} complaint{complaints.length !== 1 ? 's' : ''} reported</div>
              </div>
              <button className="profile-close" onClick={() => setShowProfile(false)}>✕</button>
            </div>

            <div className="sec-label">Meri Complaints</div>

            {loadingComplaints && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#333' }}>
                <div className="spin" style={{ borderColor: '#1E1E1E', borderTopColor: '#FF6B00', margin: '0 auto 10px', width: 24, height: 24 }} />
                Loading...
              </div>
            )}

            {!loadingComplaints && complaints.length === 0 && (
              <div className="empty-state">
                <div style={{ fontSize: 38, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14 }}>Abhi koi complaint nahi</div>
                <div style={{ fontSize: 12, marginTop: 6, color: '#2A2A2A' }}>Pehla issue report karo!</div>
              </div>
            )}

            {!loadingComplaints && complaints.map(c => (
              <div className="c-card" key={c.id}>
                <div className="c-card-hdr">
                  <div className="c-ico">{issueIcon(c.issueType)}</div>
                  <div className="c-type">{c.issueType}</div>
                  <div className="c-sev" style={{ background: severityBg(c.severity), color: severityColor(c.severity) }}>{c.severity}</div>
                </div>
                <div className="c-id">ID: {c.complaintId}</div>
                {c.addressDetail && <div className="c-address">📍 {c.addressDetail}</div>}
                <div className="c-desc">{c.description}</div>
                <div className="c-meta">
                  <span>🏙 Ward {c.ward} — {c.wardName}</span>
                  <span>🕐 {new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
                  <span className="c-status">{c.status}</span>
                </div>
                <div className="c-track" onClick={() => window.open(`${window.location.origin}/complaint/${c.complaintId}`, '_blank')}>
                  🔗 Track: /complaint/{c.complaintId}
                </div>
              </div>
            ))}

            <button className="logout-btn" onClick={() => { localStorage.removeItem('nagrik_user'); setUser(null); setShowProfile(false) }}>
              🚪 Logout
            </button>
          </div>
        </div>
      )}
    </>
  )
}