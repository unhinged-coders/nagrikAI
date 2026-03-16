import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import BmcLogin from './BmcLogin'
import AnalyticsMap from './AnalyticsMap'

const severityColor = (s) => s === 'High' ? '#FF3B30' : s === 'Medium' ? '#FF9500' : '#34C759'
const severityBg   = (s) => s === 'High' ? '#FF3B3018' : s === 'Medium' ? '#FF950018' : '#34C75918'
const issueIcon    = (t) => ({ Pothole: '🕳️', Garbage: '🗑️', 'Broken Streetlight': '💡', Waterlogging: '🌊' }[t] || '⚠️')

const STATUS_OPTIONS = ['Reported', 'Acknowledged', 'In Progress', 'Resolved']

// Same compression as citizen side — 800px max, JPEG 0.6
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

export default function BmcDashboard() {
  const [officer, setOfficer]                   = useState(null)
  const [complaints, setComplaints]             = useState([])
  const [loading, setLoading]                   = useState(false)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [newStatus, setNewStatus]               = useState('')
  const [afterPhotoFile, setAfterPhotoFile]     = useState(null)
  const [afterPhotoPreview, setAfterPhotoPreview] = useState(null)
  const [updating, setUpdating]                 = useState(false)
  const [updateSuccess, setUpdateSuccess]       = useState(false)
  const [filterStatus, setFilterStatus]         = useState('All')

  useEffect(() => {
    const saved = localStorage.getItem('bmc_officer')
    if (saved) setOfficer(JSON.parse(saved))
  }, [])

  useEffect(() => {
    if (officer) loadComplaints()
  }, [officer])

  const loadComplaints = async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'complaints'), where('ward', '==', officer.ward))
      const snap = await getDocs(q)
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.status !== 'Pending')
      list.sort((a, b) => {
        const sevOrder = { High: 0, Medium: 1, Low: 2 }
        if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity]
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
      setComplaints(list)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleAfterPhoto = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAfterPhotoFile(file)
    setAfterPhotoPreview(URL.createObjectURL(file))
  }

  const handleUpdate = async () => {
    if (!selectedComplaint || !newStatus) return
    setUpdating(true)
    setUpdateSuccess(false)
    try {
      let afterPhotoBase64 = selectedComplaint.afterPhoto || null

      if (afterPhotoFile) {
        // Compress before saving — same as citizen side
        afterPhotoBase64 = await compressImage(afterPhotoFile)
      }

      await updateDoc(doc(db, 'complaints', selectedComplaint.id), {
        status:     newStatus,
        afterPhoto: afterPhotoBase64,
        updatedAt:  new Date().toISOString(),
        ...(newStatus === 'Resolved' ? { resolvedAt: new Date().toISOString() } : {})
      })

      setComplaints(prev => prev.map(c =>
        c.id === selectedComplaint.id
          ? { ...c, status: newStatus, afterPhoto: afterPhotoBase64 }
          : c
      ))

      setUpdateSuccess(true)
      setSelectedComplaint(null)
      setAfterPhotoFile(null)
      setAfterPhotoPreview(null)
      setNewStatus('')
    } catch (e) { console.error(e) }
    setUpdating(false)
  }

  const logout = () => {
    localStorage.removeItem('bmc_officer')
    setOfficer(null)
  }

  if (!officer) return <BmcLogin onLogin={setOfficer} />

  const filtered = filterStatus === 'All' ? complaints : complaints.filter(c => c.status === filterStatus)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0D0D; }
        .bd-wrap { max-width: 480px; margin: 0 auto; min-height: 100vh; background: #0D0D0D; color: #fff; font-family: 'DM Sans', sans-serif; padding-bottom: 48px; }
        .bd-hdr { padding: 16px 20px; background: #141414; border-bottom: 1px solid #1E1E1E; display: flex; align-items: center; justify-content: space-between; }
        .bd-logo { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; }
        .bd-logo span { color: #FF6B00; }
        .bd-ward-badge { background: #FF6B0018; border: 1px solid #FF6B0035; color: #FF6B00; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 8px; }
        .bd-logout { background: transparent; border: 1px solid #1E1E1E; color: #555; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: 'DM Sans', sans-serif; }
        .bd-logout:hover { border-color: #FF3B30; color: #FF3B30; }
        .bd-body { padding: 16px 20px; }
        .bd-stats { display: flex; gap: 10px; margin-bottom: 16px; }
        .bd-stat { flex: 1; background: #141414; border: 1px solid #1E1E1E; border-radius: 14px; padding: 14px; text-align: center; }
        .bd-stat-num { font-family: 'Syne', sans-serif; font-size: 24px; font-weight: 800; color: #FF6B00; }
        .bd-stat-label { font-size: 11px; color: #555; margin-top: 4px; }
        .bd-filter { display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
        .bd-filter::-webkit-scrollbar { display: none; }
        .bd-filter-btn { background: #141414; border: 1px solid #1E1E1E; color: #555; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .bd-filter-btn.active { background: #FF6B0018; border-color: #FF6B00; color: #FF6B00; }
        .bd-card { background: #141414; border: 1px solid #1E1E1E; border-radius: 16px; padding: 14px 16px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s; }
        .bd-card:hover { border-color: #FF6B00; }
        .bd-card-hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .bd-card-ico { font-size: 20px; }
        .bd-card-type { font-size: 14px; font-weight: 700; flex: 1; }
        .bd-card-sev { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 6px; }
        .bd-card-id { font-size: 11px; color: #3A3A3A; font-family: monospace; margin-bottom: 6px; }
        .bd-card-addr { font-size: 12px; color: #666; margin-bottom: 5px; }
        .bd-card-desc { font-size: 12px; color: #555; line-height: 1.5; margin-bottom: 8px; }
        .bd-card-meta { display: flex; align-items: center; justify-content: space-between; }
        .bd-status-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; }
        .bd-card-date { font-size: 11px; color: #3A3A3A; }
        .bd-support { font-size: 11px; color: #FF6B00; }
        .bd-empty { text-align: center; padding: 48px 20px; color: #333; }
        .bd-spin { width: 32px; height: 32px; border: 3px solid #1E1E1E; border-top-color: #FF6B00; border-radius: 50%; animation: bdspin 0.8s linear infinite; margin: 32px auto; }
        @keyframes bdspin { to { transform: rotate(360deg); } }
        .bd-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 999; display: flex; align-items: flex-end; }
        .bd-modal { background: #111; border-radius: 26px 26px 0 0; padding: 24px 20px 36px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .bd-modal-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800; margin-bottom: 16px; color: #fff; }
        .bd-modal-label { font-size: 10px; color: #FF6B00; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; display: block; }
        .bd-modal-select { width: 100%; background: #161616; border: 1.5px solid #252525; border-radius: 12px; padding: 13px 16px; color: #fff; font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; margin-bottom: 14px; }
        .bd-modal-select:focus { border-color: #FF6B00; }
        .bd-photo-upload { border: 2px dashed #252525; border-radius: 14px; padding: 20px; text-align: center; cursor: pointer; margin-bottom: 14px; transition: border-color 0.2s; position: relative; }
        .bd-photo-upload:hover { border-color: #FF6B00; }
        .bd-photo-preview { width: 100%; border-radius: 10px; display: block; max-height: 200px; object-fit: cover; margin-bottom: 14px; }
        .bd-before-photo { width: 100%; border-radius: 10px; display: block; max-height: 160px; object-fit: cover; margin-bottom: 14px; border: 1px solid #1E1E1E; }
        .bd-modal-actions { display: flex; gap: 10px; }
        .bd-btn { flex: 1; padding: 14px; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
        .bd-btn-orange { background: #FF6B00; color: #fff; }
        .bd-btn-orange:hover:not(:disabled) { background: #E55A00; }
        .bd-btn-orange:disabled { opacity: 0.5; cursor: not-allowed; }
        .bd-btn-ghost { background: transparent; color: #555; border: 1px solid #1E1E1E; }
        .bd-success { background: #0D2E1A; border: 1px solid #34C75930; color: #34C759; padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; text-align: center; margin-bottom: 12px; }
      `}</style>

      <div className="bd-wrap">
        <div className="bd-hdr">
          <div className="bd-logo">Nagrik<span>AI</span> BMC</div>
          <div className="bd-ward-badge">Ward {officer.ward}</div>
          <button className="bd-logout" onClick={logout}>Logout</button>
        </div>

        <div className="bd-body">
          <div className="bd-stats">
            <div className="bd-stat">
              <div className="bd-stat-num">{complaints.length}</div>
              <div className="bd-stat-label">Total</div>
            </div>
            <div className="bd-stat">
              <div className="bd-stat-num" style={{ color: '#FF3B30' }}>
                {complaints.filter(c => c.severity === 'High').length}
              </div>
              <div className="bd-stat-label">High Priority</div>
            </div>
            <div className="bd-stat">
              <div className="bd-stat-num" style={{ color: '#34C759' }}>
                {complaints.filter(c => c.status === 'Resolved').length}
              </div>
              <div className="bd-stat-label">Resolved</div>
            </div>
          </div>

          <div className="bd-filter">
            {['All', 'Reported', 'Acknowledged', 'In Progress', 'Resolved'].map(s => (
              <button key={s} className={`bd-filter-btn ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
                {s}
              </button>
            ))}
          </div>

          <AnalyticsMap complaints={complaints} />

          {updateSuccess && <div className="bd-success">✅ Complaint updated successfully!</div>}
          {loading && <div className="bd-spin" />}

          {!loading && filtered.length === 0 && (
            <div className="bd-empty">
              <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
              <div>Koi complaint nahi</div>
            </div>
          )}

          {!loading && filtered.map(c => (
            <div className="bd-card" key={c.id} onClick={() => {
              setSelectedComplaint(c)
              setNewStatus(c.status)
              setAfterPhotoPreview(c.afterPhoto || null)
              setUpdateSuccess(false)
            }}>
              <div className="bd-card-hdr">
                <div className="bd-card-ico">{issueIcon(c.issueType)}</div>
                <div className="bd-card-type">{c.issueType}</div>
                <div className="bd-card-sev" style={{ background: severityBg(c.severity), color: severityColor(c.severity) }}>{c.severity}</div>
              </div>
              <div className="bd-card-id">ID: {c.complaintId}</div>
              {c.addressDetail && <div className="bd-card-addr">📍 {c.addressDetail}</div>}
              <div className="bd-card-desc">{c.description}</div>
              <div className="bd-card-meta">
                <span className="bd-status-pill" style={{
                  background: c.status === 'Resolved' ? '#0D2E1A' : '#FF6B0015',
                  color: c.status === 'Resolved' ? '#34C759' : '#FF6B00',
                  border: `1px solid ${c.status === 'Resolved' ? '#34C75930' : '#FF6B0030'}`
                }}>
                  {c.status}
                </span>
                <span className="bd-support">🤝 {c.supportCount || 0} support</span>
                <span className="bd-card-date">{new Date(c.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedComplaint && (
        <div className="bd-modal-overlay" onClick={() => setSelectedComplaint(null)}>
          <div className="bd-modal" onClick={e => e.stopPropagation()}>
            <div className="bd-modal-title">
              {issueIcon(selectedComplaint.issueType)} {selectedComplaint.issueType} — Update
            </div>

            {selectedComplaint.beforePhoto && (
              <>
                <label className="bd-modal-label">📸 Before Photo</label>
                <img src={selectedComplaint.beforePhoto} className="bd-before-photo" alt="Before" />
              </>
            )}

            <label className="bd-modal-label">Update Status</label>
            <select className="bd-modal-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <label className="bd-modal-label">📷 After Photo (optional)</label>
            {afterPhotoPreview ? (
              <>
                <img src={afterPhotoPreview} className="bd-photo-preview" alt="After preview" />
                <button style={{ background: 'transparent', border: '1px solid #2A2A2A', color: '#555', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, marginBottom: 14, display: 'block' }}
                  onClick={() => { setAfterPhotoFile(null); setAfterPhotoPreview(null) }}>
                  ✕ Remove Photo
                </button>
              </>
            ) : (
              <label className="bd-photo-upload">
                <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 13, color: '#555' }}>After photo upload karo</div>
                <input type="file" accept="image/*" capture="environment" onChange={handleAfterPhoto} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              </label>
            )}

            <div className="bd-modal-actions">
              <button className="bd-btn bd-btn-ghost" onClick={() => { setSelectedComplaint(null); setAfterPhotoFile(null); setAfterPhotoPreview(null) }}>
                Cancel
              </button>
              <button className="bd-btn bd-btn-orange" onClick={handleUpdate} disabled={updating}>
                {updating ? 'Updating...' : '✅ Update Karo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}