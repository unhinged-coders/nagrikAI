import { useState, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { collection, addDoc, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { db } from './firebase'
import MapView from './components/MapView'
import Step3 from './components/Step3'
import Signup from './components/Signup'
import { detectWard, generateComplaintId } from './data/wardData'
import 'leaflet/dist/leaflet.css'
import { useLanguage } from './hooks/useLanguage'
import LangToggle from './components/LangToggle'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

const severityColor = (s) => s === 'High' ? '#FF3B30' : s === 'Medium' ? '#FF9500' : '#34C759'
const severityBg   = (s) => s === 'High' ? '#FF3B3018' : s === 'Medium' ? '#FF950018' : '#34C75918'
const issueIcon    = (t) => ({ Pothole: '🕳️', Garbage: '🗑️', 'Broken Streetlight': '💡', Waterlogging: '🌊' }[t] || '⚠️')

const TRUSTED_THRESHOLD = 5

const compressImage = (file) =>
  new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 800
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else                { width  = Math.round(width  * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })

export default function App() {
  const { t } = useLanguage()

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
  const [existingComplaint, setExistingComplaint] = useState(null)
  const [checkingDuplicate, setCheckingDuplicate] = useState(false)
  const [supported, setSupported]                 = useState(false)
  const [photoBase64, setPhotoBase64]             = useState(null)

  const resolvedCount = complaints.filter(c => c.status === 'Resolved').length
  const trusted       = resolvedCount >= TRUSTED_THRESHOLD
  const remaining     = Math.max(0, TRUSTED_THRESHOLD - resolvedCount)

  useEffect(() => {
    // Force html+body to fill screen with no overflow
    document.documentElement.style.cssText = 'height:100%;background:#0D0D0D;overflow-x:hidden;'
    document.body.style.cssText = 'height:100%;background:#0D0D0D;margin:0;padding:0;overflow-x:hidden;'

    const saved = localStorage.getItem('nagrik_user')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.id) setUser(parsed)
        else localStorage.removeItem('nagrik_user')
      } catch (e) { localStorage.removeItem('nagrik_user') }
    }

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
      setPhotoBase64(null)
      setAddressInput(''); setComplaintId(null); setPhotoError('')
      setExistingComplaint(null); setCheckingDuplicate(false); setSupported(false)
    }
    window.addEventListener('restartApp', onRestart)
    return () => window.removeEventListener('restartApp', onRestart)
  }, [])

  useEffect(() => {
    if (step === 2 && result && location) checkDuplicate()
  }, [step])

  useEffect(() => {
    if (user) loadComplaints(user.id)
  }, [user])

  const loadComplaints = async (uid) => {
    setLoadingComplaints(true)
    try {
      const q = query(collection(db, 'complaints'), where('userId', '==', uid))
      const snap = await getDocs(q)
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setComplaints(list)
    } catch (e) { console.error('loadComplaints error:', e) }
    setLoadingComplaints(false)
  }

  const openProfile = () => {
    if (user) loadComplaints(user.id)
    setShowProfile(true)
  }

  const checkDuplicate = async () => {
    setCheckingDuplicate(true)
    try {
      const q = query(
        collection(db, 'complaints'),
        where('ward', '==', location.ward.ward),
        where('issueType', '==', result.issueType)
      )
      const snap = await getDocs(q)
      const active = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.status !== 'Resolved' && c.userId !== user.id)
      if (active.length > 0) setExistingComplaint(active[0])
    } catch (e) { console.error(e) }
    setCheckingDuplicate(false)
  }

  const supportExisting = async () => {
    if (!existingComplaint) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'complaints', existingComplaint.id), {
        supportCount: (existingComplaint.supportCount || 0) + 1,
        supporters: arrayUnion(user.id)
      })
      setSupported(true)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handlePhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setPhotoError(''); setLoading(true)
    try {
      const compressed = await compressImage(file)
      if (!compressed) throw new Error('Compression failed')
      setPhotoBase64(compressed)
      const base64 = compressed.split(',')[1]
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const res   = await model.generateContent([
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        `You are a strict Mumbai civic issue detector for BMC.
Analyze this image carefully.
ONLY accept these valid civic problems visible in public areas/roads:
Pothole, Garbage dumping, Broken Streetlight, Waterlogging.
If image shows a valid civic issue → reply ONLY with JSON (no extra text):
{"issueType":"Pothole/Garbage/Broken Streetlight/Waterlogging/Other","severity":"Low/Medium/High","description":"one line in English","isValid":true}
If image is NOT a civic issue → reply with exactly: NOT_CIVIC_ISSUE
Be very strict. When in doubt → NOT_CIVIC_ISSUE`
      ])
      const text  = res.response.text().trim()
      const clean = text.replace(/```json|```/g, '').trim()
      if (clean === 'NOT_CIVIC_ISSUE' || !clean.startsWith('{')) {
        setLoading(false); setPreview(null); setPhotoBase64(null)
        setPhotoError(t('photoErrorMsg')); return
      }
      const parsed = JSON.parse(clean)
      setResult(parsed); setLoading(false); setStep(2)
    } catch (err) {
      console.error(err)
      setLoading(false); setPreview(null); setPhotoBase64(null)
      setPhotoError(t('photoErrorMsg'))
    }
  }

  const handleProceed = async () => {
    setSaving(true)
    const cid = generateComplaintId()
    setComplaintId(cid)
    try {
      await addDoc(collection(db, 'complaints'), {
        complaintId: cid, userId: user.id,
        userFirstName: user.firstName, userLastName: user.lastName,
        userMobile: user.mobile, userEmail: user.email,
        issueType: result.issueType, severity: result.severity,
        description: result.description, addressDetail: addressInput.trim(),
        ward: location.ward.ward, wardName: location.ward.name,
        lat: location.lat, lng: location.lng,
        createdAt: new Date().toISOString(), status: 'Pending',
        beforePhoto: photoBase64 || null, afterPhoto: null,
        supportCount: 0, supporters: [],
      })
      loadComplaints(user.id)
    } catch (e) { console.error('Firestore save error:', e) }
    setResult(r => ({ ...r, addressDetail: addressInput.trim() }))
    setSaving(false); setStep(3)
  }

  if (!user) return <Signup onComplete={(u) => setUser(u)} />

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          height: 100%;
          width: 100%;
          background: #0D0D0D;
          overflow-x: hidden;
        }

        #root {
          height: 100%;
          background: #0D0D0D;
        }

        /* ── Full screen shell ── */
        .app-shell {
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          background: #0D0D0D;
          display: flex;
          justify-content: center;
        }

        /* ── Main column ── */
        .app {
          width: 100%;
          max-width: 480px;
          min-height: 100vh;
          min-height: 100dvh;
          background: #0D0D0D;
          color: #fff;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* PC: show border, sidebar info */
        @media (min-width: 768px) {
          .app-shell { background: #080808; align-items: stretch; }
          .app { border-left: 1px solid #181818; border-right: 1px solid #181818; }
        }

        /* ── Header ── */
        .hdr {
          padding: 14px 16px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .logo {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 800;
          flex-shrink: 0;
        }
        .logo span { color: #FF6B00; }

        .hdr-right {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
          flex-shrink: 0;
        }

        .step-dots { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .sd { width: 5px; height: 5px; border-radius: 3px; background: #222; transition: all 0.3s; }
        .sd.active { width: 14px; background: #FF6B00; }
        .sd.done { background: #34C759; }

        .user-chip {
          background: #1A1A1A;
          border: 1px solid #242424;
          border-radius: 100px;
          padding: 4px 10px 4px 4px;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: border-color 0.2s;
          flex-shrink: 0;
        }
        .user-chip:hover { border-color: #FF6B00; }
        .user-chip.trusted-chip { border-color: #34C75950; }

        .user-av {
          width: 22px; height: 22px;
          background: #FF6B00; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 800; flex-shrink: 0;
        }
        .user-nm { font-size: 12px; font-weight: 600; color: #bbb; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .trusted-pill {
          background: #34C75918; color: #34C759;
          border: 1px solid #34C75940;
          border-radius: 20px; padding: 3px 7px;
          font-size: 9px; font-weight: 700;
          white-space: nowrap; flex-shrink: 0;
        }

        /* ── Welcome bar ── */
        .welcome {
          margin: 10px 14px 0;
          padding: 8px 12px;
          background: #FF6B000D; border: 1px solid #FF6B0025;
          border-radius: 10px; font-size: 12px; color: #FF6B00;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* ── Location bar ── */
        .loc-bar {
          margin: 8px 14px 0;
          background: #1A1A1A; border: 1px solid #222;
          border-radius: 12px; padding: 9px 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .loc-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #34C759; animation: pulse 2s infinite; flex-shrink: 0;
        }
        .loc-dot.detecting { background: #FF9500; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(1.3)} }
        .loc-text { font-size: 12px; color: #888; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .loc-text strong { color: #fff; }
        .ward-pill {
          background: #FF6B0018; border: 1px solid #FF6B0040;
          color: #FF6B00; font-size: 10px; font-weight: 700;
          padding: 2px 7px; border-radius: 6px; white-space: nowrap; flex-shrink: 0;
        }

        /* ── Upload step — fills remaining screen ── */
        .upload-wrap {
          flex: 1;
          padding: 10px 14px 14px;
          display: flex;
          flex-direction: column;
        }
        .upload-card {
          flex: 1;
          background: #141414;
          border: 2px dashed #252525;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          position: relative;
          overflow: hidden;
          text-align: center;
        }
        .upload-card::before {
          content:''; position:absolute; inset:0;
          background: radial-gradient(circle at 50% 45%, #FF6B000B 0%, transparent 60%);
          pointer-events:none;
        }
        .upload-icon { font-size: 48px; margin-bottom: 12px; display: block; }
        .upload-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 8px; }
        .upload-sub { font-size: 13px; color: #555; margin-bottom: 24px; line-height: 1.6; max-width: 260px; }
        .cam-label {
          background: #FF6B00; color: #fff;
          padding: 14px 28px; border-radius: 14px;
          font-size: 15px; font-weight: 700;
          cursor: pointer; transition: background 0.2s;
          position: relative; display: inline-block;
        }
        .cam-label:hover { background: #E55A00; }
        .cam-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
        .preview-img { width: 100%; border-radius: 12px; margin-top: 14px; display: block; max-height: 200px; object-fit: cover; }
        .ai-loading {
          display: inline-flex; align-items: center; gap: 8px;
          background: #1E1E1E; border: 1px solid #2A2A2A;
          padding: 10px 18px; border-radius: 100px; margin-top: 12px;
        }
        .spin { width: 14px; height: 14px; border: 2px solid #2A2A2A; border-top-color: #FF6B00; border-radius: 50%; animation: sp 0.8s linear infinite; }
        @keyframes sp { to { transform: rotate(360deg); } }
        .ai-txt { font-size: 12px; color: #888; }
        .photo-error {
          margin-top: 10px;
          background: #FF3B3012; border: 1px solid #FF3B3035;
          color: #FF3B30; padding: 12px 14px;
          border-radius: 12px; font-size: 13px; line-height: 1.6; text-align: center;
        }
        .photo-error-icon { font-size: 24px; display: block; margin-bottom: 5px; }

        /* ── Result step ── */
        .result-wrap { padding: 0 14px 24px; overflow-y: auto; }
        .sec-label { font-size: 10px; color: #555; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; font-weight: 600; }
        .issue-card { background: #141414; border-radius: 18px; overflow: hidden; margin-bottom: 10px; border: 1px solid #1E1E1E; }
        .issue-hdr { padding: 14px; display: flex; align-items: flex-start; gap: 12px; }
        .issue-ico { width: 44px; height: 44px; border-radius: 12px; background: #1E1E1E; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .issue-info { flex: 1; }
        .issue-type { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800; margin-bottom: 3px; }
        .issue-desc { font-size: 12px; color: #777; line-height: 1.5; }
        .sev-tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; margin-top: 7px; }
        .divider { height: 1px; background: #1E1E1E; }
        .loc-info { padding: 11px 14px; display: flex; align-items: center; gap: 10px; }
        .loc-info-ico { font-size: 16px; }
        .loc-info-det { flex: 1; }
        .loc-area { font-size: 13px; font-weight: 600; }
        .loc-ward { font-size: 11px; color: #555; margin-top: 2px; }
        .loc-covers { font-size: 10px; color: #3A3A3A; margin-top: 2px; }
        .officer-bar { background: #141414; border: 1px solid #1E1E1E; border-radius: 12px; padding: 10px 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
        .officer-av { width: 34px; height: 34px; background: #1E1E1E; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .officer-name { font-size: 12px; font-weight: 700; }
        .officer-desig { font-size: 10px; color: #555; margin-top: 2px; }
        .addr-wrap { margin-bottom: 10px; }
        .addr-box { background: #141414; border: 1.5px solid #252525; border-radius: 14px; padding: 12px 14px; transition: border-color 0.2s; }
        .addr-box:focus-within { border-color: #FF6B00; }
        .addr-lbl { font-size: 9px; color: #FF6B00; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
        .addr-input { width: 100%; background: transparent; border: none; color: #ddd; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; resize: none; line-height: 1.6; }
        .addr-input::placeholder { color: #333; }
        .addr-hint { font-size: 10px; color: #3A3A3A; margin-top: 6px; line-height: 1.5; }
        .map-wrap { border-radius: 16px; overflow: hidden; margin-bottom: 10px; }
        .action-btn { width: 100%; padding: 14px; border: none; border-radius: 14px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; background: #FF6B00; color: #fff; }
        .action-btn:hover:not(:disabled) { background: #E55A00; }
        .action-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* ── Profile ── */
        .profile-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 999; display: flex; align-items: flex-end; }
        .profile-sheet { background: #0F0F0F; border-radius: 24px 24px 0 0; padding: 22px 18px 40px; width: 100%; max-height: 88dvh; overflow-y: auto; }
        @media (min-width: 768px) {
          .profile-overlay { align-items: center; justify-content: center; }
          .profile-sheet { border-radius: 20px; max-width: 460px; }
        }
        .profile-hdr { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
        .profile-av { width: 46px; height: 46px; background: #FF6B00; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 800; flex-shrink: 0; }
        .profile-name { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; }
        .profile-meta { font-size: 11px; color: #444; margin-top: 3px; }
        .profile-count { font-size: 11px; color: #FF6B00; margin-top: 3px; font-weight: 600; }
        .trusted-badge-block { margin-top: 8px; background: #1A1A1A; border: 1px solid #252525; border-radius: 10px; padding: 9px 12px; }
        .trusted-badge-block.earned { background: #34C75912; border-color: #34C75935; }
        .trusted-badge-title { font-size: 12px; font-weight: 700; color: #555; display: flex; align-items: center; gap: 5px; }
        .trusted-badge-title.earned { color: #34C759; }
        .trusted-badge-sub { font-size: 10px; color: #34C75990; margin-top: 3px; }
        .trusted-badge-progress { margin-top: 7px; }
        .trusted-badge-bar { height: 3px; border-radius: 2px; background: #2A2A2A; overflow: hidden; }
        .trusted-badge-fill { height: 100%; border-radius: 2px; background: #34C759; transition: width 0.4s; }
        .trusted-badge-hint { font-size: 10px; color: #444; margin-top: 3px; }
        .profile-close { margin-left: auto; background: #1A1A1A; border: none; color: #666; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .c-card { background: #161616; border: 1px solid #1E1E1E; border-radius: 14px; padding: 12px 13px; margin-bottom: 8px; }
        .c-card-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
        .c-ico { font-size: 18px; }
        .c-type { font-size: 13px; font-weight: 700; flex: 1; }
        .c-sev { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; }
        .c-id { font-size: 10px; color: #3A3A3A; font-family: monospace; margin-bottom: 5px; }
        .c-address { font-size: 11px; color: #666; margin-bottom: 4px; }
        .c-desc { font-size: 11px; color: #555; line-height: 1.5; margin-bottom: 5px; }
        .c-meta { font-size: 10px; color: #3A3A3A; display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 5px; }
        .c-status { display: inline-block; background: #FF6B0015; color: #FF6B00; padding: 2px 8px; border-radius: 5px; font-size: 10px; font-weight: 600; }
        .c-track { font-size: 10px; color: #FF6B00; cursor: pointer; margin-top: 3px; }
        .c-track:hover { text-decoration: underline; }
        .empty-state { text-align: center; padding: 40px 20px; color: #333; }
        .logout-btn { width: 100%; margin-top: 14px; padding: 12px; background: transparent; border: 1px solid #1E1E1E; color: #444; border-radius: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; transition: all 0.2s; }
        .logout-btn:hover { border-color: #FF3B30; color: #FF3B30; }
      `}</style>

      <div className="app-shell">
        <div className="app">

          {/* Header */}
          <div className="hdr">
            <div className="logo">Nagrik<span>AI</span></div>
            <div className="hdr-right">
              <div className="step-dots">
                <div className={`sd ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`} />
                <div className={`sd ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`} />
                <div className={`sd ${step >= 3 ? 'active' : ''}`} />
              </div>
              <LangToggle />
              <div className={`user-chip ${trusted ? 'trusted-chip' : ''}`} onClick={openProfile}>
                <div className="user-av">{user.firstName[0]}</div>
                <div className="user-nm">{user.firstName}</div>
              </div>
              {trusted && <span className="trusted-pill">✓ Trusted</span>}
            </div>
          </div>

          {/* Welcome */}
          {step === 1 && <div className="welcome">{t('welcome', user.firstName)}</div>}

          {/* Location */}
          <div className="loc-bar">
            <div className={`loc-dot ${!location ? 'detecting' : ''}`} />
            <div className="loc-text">
              {location ? <><strong>{location.ward.name}</strong>, Mumbai</> : t('locationDetecting')}
            </div>
            {location && <div className="ward-pill">{t('ward')} {location.ward.ward}</div>}
          </div>

          {/* Step 1 — Upload */}
          {step === 1 && (
            <div className="upload-wrap">
              <div className="upload-card">
                <span className="upload-icon">📸</span>
                <div className="upload-title">{t('reportIssue')}</div>
                <div className="upload-sub">{t('uploadSub')}</div>
                <label className="cam-label">
                  {t('openCamera')}
                  <input className="cam-input" type="file" accept="image/*" capture="environment" onChange={handlePhoto} />
                </label>
                {preview && <img src={preview} className="preview-img" alt="Preview" />}
                {loading && (
                  <div style={{ textAlign: 'center', paddingTop: 14 }}>
                    <div className="ai-loading">
                      <div className="spin" />
                      <span className="ai-txt">{t('aiAnalyzing')}</span>
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

          {/* Step 2 — Result */}
          {step === 2 && result && location && (
            <div className="result-wrap">
              <div className="sec-label">{t('aiDetection')}</div>
              <div className="issue-card">
                <div className="issue-hdr">
                  <div className="issue-ico">{issueIcon(result.issueType)}</div>
                  <div className="issue-info">
                    <div className="issue-type">{result.issueType}</div>
                    <div className="issue-desc">{result.description}</div>
                    <div className="sev-tag" style={{ background: severityBg(result.severity), color: severityColor(result.severity) }}>
                      ● {result.severity} {t('severity')}
                    </div>
                  </div>
                </div>
                <div className="divider" />
                <div className="loc-info">
                  <div className="loc-info-ico">📍</div>
                  <div className="loc-info-det">
                    <div className="loc-area">{location.ward.name}, Mumbai</div>
                    <div className="loc-ward">BMC {t('ward')} {location.ward.ward}</div>
                    <div className="loc-covers">{location.ward.areas.slice(0, 4).join(' · ')}</div>
                  </div>
                </div>
              </div>

              <div className="sec-label">{t('wardOfficer')}</div>
              <div className="officer-bar">
                <div className="officer-av">👮</div>
                <div>
                  <div className="officer-name">{location.ward.wardOfficerName}</div>
                  <div className="officer-desig">{location.ward.wardOfficerDesignation}</div>
                </div>
              </div>

              <div className="sec-label">{t('exactLocation')}</div>
              <div className="addr-wrap">
                <div className="addr-box">
                  <div className="addr-lbl">📍 Address Details</div>
                  <textarea className="addr-input" rows={2} placeholder={t('addressPlaceholder')} value={addressInput} onChange={e => setAddressInput(e.target.value)} />
                  <div className="addr-hint">{t('addressHint')}</div>
                </div>
              </div>

              <div className="sec-label">{t('locationOnMap')}</div>
              <div className="map-wrap">
                <MapView location={location} result={result} />
              </div>

              {checkingDuplicate ? (
                <div style={{ textAlign: 'center', paddingTop: 8 }}>
                  <div className="ai-loading" style={{ width: '100%', justifyContent: 'center', borderRadius: 14, padding: 13 }}>
                    <div className="spin" />
                    <span className="ai-txt">{t('checkingDuplicate')}</span>
                  </div>
                </div>
              ) : supported && existingComplaint ? (
                <div style={{ background: '#34C75918', border: '1px solid #34C75935', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#34C759', lineHeight: 1.6 }}>
                    {t('supportedMsg', existingComplaint.complaintId)}
                  </div>
                  <button className="action-btn" style={{ marginTop: 10, background: '#34C759' }}
                    onClick={() => window.open(`${window.location.origin}/complaint/${existingComplaint.complaintId}`, '_blank')}>
                    {t('openTrackingLink')}
                  </button>
                </div>
              ) : existingComplaint && !supported ? (
                <div style={{ background: '#FF950018', border: '1px solid #FF950035', borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#FF9500', marginBottom: 5 }}>
                    {t('duplicateTitle', location.ward.ward)}
                  </div>
                  <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>{t('duplicateSub')}</div>
                  <div style={{ fontSize: 11, color: '#FF9500', fontFamily: 'monospace', marginBottom: 12 }}>
                    {t('complaintId')}: {existingComplaint.complaintId}
                  </div>
                  <button className="action-btn" onClick={supportExisting} disabled={saving}>
                    {saving ? <><div className="spin" style={{ borderColor: '#ffffff30', borderTopColor: '#fff' }} />{t('saving')}</> : t('supportBtn')}
                  </button>
                  <button className="action-btn" style={{ marginTop: 8, background: 'transparent', color: '#FF9500', border: '1px solid #FF950035' }}
                    onClick={() => setExistingComplaint(null)}>
                    {t('differentLocation')}
                  </button>
                </div>
              ) : (
                <button className="action-btn" onClick={handleProceed} disabled={saving}>
                  {saving ? <><div className="spin" style={{ borderColor: '#ffffff30', borderTopColor: '#fff' }} />{t('saving')}</> : t('submitBtn')}
                </button>
              )}
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && result && location && complaintId && (
            <Step3 result={result} location={location} preview={preview} photoDataUrl={photoBase64} user={user} complaintId={complaintId} />
          )}

        </div>
      </div>

      {/* Profile sheet */}
      {showProfile && (
        <div className="profile-overlay" onClick={() => setShowProfile(false)}>
          <div className="profile-sheet" onClick={e => e.stopPropagation()}>
            <div className="profile-hdr">
              <div className="profile-av">{user.firstName[0]}</div>
              <div style={{ flex: 1 }}>
                <div className="profile-name">{user.firstName} {user.lastName}</div>
                <div className="profile-meta">{user.mobile} • {user.email}</div>
                <div className="profile-count">{t('complaints', complaints.length)}</div>
                {!loadingComplaints && (
                  <div className={`trusted-badge-block ${trusted ? 'earned' : ''}`}>
                    {trusted ? (
                      <>
                        <div className="trusted-badge-title earned">✅ Trusted Nagrik</div>
                        <div className="trusted-badge-sub">{resolvedCount} complaints resolved by BMC</div>
                      </>
                    ) : (
                      <>
                        <div className="trusted-badge-title">⬜ Trusted Nagrik</div>
                        <div className="trusted-badge-progress">
                          <div className="trusted-badge-bar">
                            <div className="trusted-badge-fill" style={{ width: `${(resolvedCount / TRUSTED_THRESHOLD) * 100}%` }} />
                          </div>
                          <div className="trusted-badge-hint">
                            {resolvedCount}/{TRUSTED_THRESHOLD} resolved — {remaining} more needed
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button className="profile-close" onClick={() => setShowProfile(false)}>✕</button>
            </div>

            <div className="sec-label">{t('myComplaints')}</div>

            {loadingComplaints && (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#333' }}>
                <div className="spin" style={{ borderColor: '#1E1E1E', borderTopColor: '#FF6B00', margin: '0 auto 10px', width: 22, height: 22 }} />
                Loading...
              </div>
            )}

            {!loadingComplaints && complaints.length === 0 && (
              <div className="empty-state">
                <div style={{ fontSize: 34, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 13 }}>{t('noComplaints')}</div>
                <div style={{ fontSize: 11, marginTop: 5, color: '#2A2A2A' }}>{t('noComplaintsSub')}</div>
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
                  <span>🏙 {t('ward')} {c.ward} — {c.wardName}</span>
                  <span>🕐 {new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
                  <span className="c-status">{c.status}</span>
                </div>
                <div className="c-track" onClick={() => window.open(`${window.location.origin}/complaint/${c.complaintId}`, '_blank')}>
                  🔗 {t('track')}: /complaint/{c.complaintId}
                </div>
              </div>
            ))}

            <button className="logout-btn" onClick={() => { localStorage.removeItem('nagrik_user'); setUser(null); setShowProfile(false) }}>
              {t('logout')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}