import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

const severityColor = (s) => s === 'High' ? '#FF3B30' : s === 'Medium' ? '#FF9500' : '#34C759'
const severityBg   = (s) => s === 'High' ? '#FF3B3018' : s === 'Medium' ? '#FF950018' : '#34C75918'
const issueIcon    = (t) => ({ Pothole: '🕳️', Garbage: '🗑️', 'Broken Streetlight': '💡', Waterlogging: '🌊' }[t] || '⚠️')

const STATUS_STEPS = ['Pending', 'Reported', 'Acknowledged', 'In Progress', 'Resolved']

const statusColor = (s) => ({
  Pending:      '#555555',
  Reported:     '#FF9500',
  Acknowledged: '#007AFF',
  'In Progress':'#AF52DE',
  Resolved:     '#34C759'
}[s] || '#FF9500')

export default function ComplaintPage() {
  const { id } = useParams()
  const [complaint, setComplaint]       = useState(null)
  const [loading, setLoading]           = useState(true)
  const [notFound, setNotFound]         = useState(false)
  const [linkCopied, setLinkCopied]     = useState(false)

  useEffect(() => {
    const fetchComplaint = async () => {
      try {
        const q    = query(collection(db, 'complaints'), where('complaintId', '==', id))
        const snap = await getDocs(q)
        if (snap.empty) { setNotFound(true); setLoading(false); return }
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() }
        setComplaint(data)
      } catch (e) {
        console.error(e)
        setNotFound(true)
      }
      setLoading(false)
    }
    fetchComplaint()
  }, [id])

  const currentStep = complaint ? STATUS_STEPS.indexOf(complaint.status) : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0D0D0D; min-height: 100vh; }
        .cp-wrap { max-width: 430px; margin: 0 auto; min-height: 100vh; background: #0D0D0D; color: #fff; font-family: 'DM Sans', sans-serif; padding-bottom: 48px; }
        .cp-hdr { padding: 20px 20px 16px; display: flex; align-items: center; justify-content: space-between; }
        .cp-logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; }
        .cp-logo span { color: #FF6B00; }
        .cp-badge { background: #FF6B0015; border: 1px solid #FF6B0035; color: #FF6B00; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 8px; }
        .cp-body { padding: 0 20px; }
        .cp-label { font-size: 11px; color: #555; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; font-weight: 600; }
        .cp-id-card { background: #FF6B0012; border: 1px solid #FF6B0030; border-radius: 16px; padding: 14px 16px; margin-bottom: 14px; }
        .cp-id-top { font-size: 10px; color: #FF6B00; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 5px; }
        .cp-id-val { font-size: 17px; font-weight: 800; color: #fff; font-family: monospace; letter-spacing: 1px; }
        .cp-id-date { font-size: 12px; color: #555; margin-top: 5px; }
        .cp-status-card { background: #141414; border: 1px solid #1E1E1E; border-radius: 18px; padding: 18px 16px; margin-bottom: 14px; }
        .cp-status-title { font-size: 13px; font-weight: 700; margin-bottom: 16px; color: #bbb; }
        .cp-steps { display: flex; align-items: flex-start; }
        .cp-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
        .cp-step-line { position: absolute; top: 13px; left: 50%; width: 100%; height: 2px; background: #222; z-index: 0; }
        .cp-step:last-child .cp-step-line { display: none; }
        .cp-step-dot { width: 26px; height: 26px; border-radius: 50%; border: 2px solid #222; background: #0D0D0D; display: flex; align-items: center; justify-content: center; font-size: 11px; z-index: 1; position: relative; }
        .cp-step-dot.done { background: #34C759; border-color: #34C759; color: #fff; }
        .cp-step-dot.active { border-color: #FF9500; background: #FF950018; color: #FF9500; }
        .cp-step-label { font-size: 9px; color: #444; margin-top: 7px; text-align: center; line-height: 1.4; }
        .cp-step-label.done { color: #34C759; }
        .cp-step-label.active { color: #FF9500; font-weight: 700; }
        .cp-current-status { margin-top: 14px; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 700; text-align: center; }
        .cp-issue-card { background: #141414; border: 1px solid #1E1E1E; border-radius: 18px; overflow: hidden; margin-bottom: 14px; }
        .cp-issue-hdr { padding: 16px 18px; display: flex; align-items: flex-start; gap: 14px; }
        .cp-issue-ico { width: 48px; height: 48px; border-radius: 14px; background: #1E1E1E; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .cp-issue-type { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; margin-bottom: 4px; }
        .cp-issue-desc { font-size: 13px; color: #777; line-height: 1.55; }
        .cp-sev-tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 700; margin-top: 9px; }
        .cp-divider { height: 1px; background: #1E1E1E; }
        .cp-loc-row { padding: 13px 18px; display: flex; align-items: center; gap: 12px; }
        .cp-loc-area { font-size: 14px; font-weight: 600; }
        .cp-loc-ward { font-size: 12px; color: #555; margin-top: 2px; }
        .cp-address { font-size: 12px; color: #666; margin-top: 3px; }
        .cp-support-card { background: #141414; border: 1px solid #1E1E1E; border-radius: 16px; padding: 16px 18px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
        .cp-support-count { font-size: 28px; font-weight: 800; color: #FF6B00; font-family: 'Syne', sans-serif; }
        .cp-support-label { font-size: 12px; color: #555; margin-top: 2px; }
        .cp-before-after { background: #141414; border: 1px solid #1E1E1E; border-radius: 16px; overflow: hidden; margin-bottom: 14px; }
        .cp-ba-title { padding: 12px 16px; font-size: 12px; font-weight: 700; color: #555; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #1E1E1E; }
        .cp-ba-imgs { display: flex; }
        .cp-ba-side { flex: 1; padding: 12px; }
        .cp-ba-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 700; }
        .cp-ba-img { width: 100%; border-radius: 10px; display: block; aspect-ratio: 1; object-fit: cover; }
        .cp-ba-empty { width: 100%; aspect-ratio: 1; border-radius: 10px; background: #1A1A1A; border: 1px dashed #2A2A2A; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 6px; color: #333; font-size: 11px; }
        .cp-officer { background: #141414; border: 1px solid #1E1E1E; border-radius: 16px; padding: 14px 16px; margin-bottom: 14px; display: flex; gap: 12px; align-items: center; }
        .cp-officer-av { width: 40px; height: 40px; border-radius: 50%; background: #1E1E1E; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .cp-officer-name { font-size: 13px; font-weight: 700; }
        .cp-officer-desig { font-size: 11px; color: #555; margin-top: 2px; }
        .cp-reporter { background: #141414; border: 1px solid #1E1E1E; border-radius: 16px; padding: 14px 16px; margin-bottom: 14px; }
        .cp-reporter-name { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
        .cp-reporter-meta { font-size: 12px; color: #555; }
        .cp-map-btn { width: 100%; padding: 13px; background: #141414; border: 1px solid #1E1E1E; border-radius: 14px; color: #FF6B00; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; transition: border-color 0.2s; }
        .cp-map-btn:hover { border-color: #FF6B00; }
        .cp-share-btn { width: 100%; padding: 13px; background: transparent; border: 1px solid #1E1E1E; border-radius: 14px; color: #555; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; margin-bottom: 10px; }
        .cp-share-btn:hover { border-color: #555; color: #888; }
        .cp-share-btn.copied { border-color: #34C759; color: #34C759; }
        .cp-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 16px; color: #333; }
        .cp-spin { width: 36px; height: 36px; border: 3px solid #1E1E1E; border-top-color: #FF6B00; border-radius: 50%; animation: cpspin 0.8s linear infinite; }
        @keyframes cpspin { to { transform: rotate(360deg); } }
        .cp-404 { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 12px; text-align: center; padding: 0 32px; }
        .cp-404-ico { font-size: 52px; }
        .cp-404-title { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; }
        .cp-404-sub { font-size: 14px; color: #444; line-height: 1.6; }
        .cp-footer { text-align: center; padding: 24px 20px 0; font-size: 11px; color: #2A2A2A; }
        .cp-footer span { color: #FF6B00; }
        .cp-home-btn { margin-top: 16px; padding: 12px 24px; background: #FF6B00; color: #fff; border: none; border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .cp-support-btn { border: none; border-radius: 12px; padding: 10px 16px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div className="cp-wrap">
        <div className="cp-hdr">
          <div className="cp-logo">Nagrik<span>AI</span></div>
          <div className="cp-badge">🔍 TRACKING</div>
        </div>

        {loading && (
          <div className="cp-loading">
            <div className="cp-spin" />
            <div style={{ fontSize: 14 }}>Complaint dhundh raha hai...</div>
          </div>
        )}

        {!loading && notFound && (
          <div className="cp-404">
            <div className="cp-404-ico">🔍</div>
            <div className="cp-404-title">Complaint Nahi Mili</div>
            <div className="cp-404-sub">
              ID <strong style={{ color: '#FF6B00', fontFamily: 'monospace' }}>{id}</strong> se koi complaint nahi mili.
            </div>
            <button className="cp-home-btn" onClick={() => window.location.href = '/'}>🏠 Home Pe Jao</button>
          </div>
        )}

        {!loading && complaint && (
          <div className="cp-body">

            {/* Complaint ID */}
            <div className="cp-id-card">
              <div className="cp-id-top">Complaint ID</div>
              <div className="cp-id-val">{complaint.complaintId}</div>
              <div className="cp-id-date">
                📅 {new Date(complaint.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Status Tracker */}
            <div className="cp-label">Status Tracker</div>
            <div className="cp-status-card">
              <div className="cp-status-title">Complaint Progress</div>
              <div className="cp-steps">
                {STATUS_STEPS.map((step, i) => (
                  <div className="cp-step" key={step}>
                    <div className="cp-step-line" style={{ background: i < currentStep ? '#34C759' : '#222' }} />
                    <div className={`cp-step-dot ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`}>
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <div className={`cp-step-label ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`}>
                      {step}
                    </div>
                  </div>
                ))}
              </div>
              <div className="cp-current-status" style={{ background: severityBg(complaint.severity), color: statusColor(complaint.status), border: `1px solid ${statusColor(complaint.status)}30` }}>
                Current Status: {complaint.status}
              </div>
            </div>

            {/* Community Support */}
            <div className="cp-label">Community Support</div>
            <div className="cp-support-card">
              <div>
                <div className="cp-support-count">{complaint.supportCount || 0}</div>
                <div className="cp-support-label">citizens ne support kiya</div>
              </div>
            </div>

            {/* Before / After */}
            <div className="cp-label">Before / After</div>
            <div className="cp-before-after">
              <div className="cp-ba-title">Visual Proof</div>
              <div className="cp-ba-imgs">
                <div className="cp-ba-side">
                  <div className="cp-ba-label">📸 Before</div>
                  {complaint.beforePhoto ? (
                    <img src={complaint.beforePhoto} className="cp-ba-img" alt="Before" />
                  ) : (
                    <div className="cp-ba-empty">
                      <span style={{ fontSize: 24 }}>📸</span>
                      <span>Photo pending</span>
                    </div>
                  )}
                </div>
                <div style={{ width: 1, background: '#1E1E1E' }} />
                <div className="cp-ba-side">
                  <div className="cp-ba-label">✅ After</div>
                  {complaint.afterPhoto ? (
                    <img src={complaint.afterPhoto} className="cp-ba-img" alt="After" />
                  ) : (
                    <div className="cp-ba-empty">
                      <span style={{ fontSize: 24 }}>⏳</span>
                      <span>BMC ka wait hai</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Issue Details */}
            <div className="cp-label">Issue Details</div>
            <div className="cp-issue-card">
              <div className="cp-issue-hdr">
                <div className="cp-issue-ico">{issueIcon(complaint.issueType)}</div>
                <div style={{ flex: 1 }}>
                  <div className="cp-issue-type">{complaint.issueType}</div>
                  <div className="cp-issue-desc">{complaint.description}</div>
                  <div className="cp-sev-tag" style={{ background: severityBg(complaint.severity), color: severityColor(complaint.severity) }}>
                    ● {complaint.severity} Severity
                  </div>
                </div>
              </div>
              <div className="cp-divider" />
              <div className="cp-loc-row">
                <div style={{ fontSize: 20 }}>📍</div>
                <div>
                  <div className="cp-loc-area">{complaint.wardName}, Mumbai</div>
                  <div className="cp-loc-ward">BMC Ward {complaint.ward}</div>
                  {complaint.addressDetail && <div className="cp-address">{complaint.addressDetail}</div>}
                </div>
              </div>
            </div>

            {/* Ward Officer */}
            <div className="cp-label">Assigned Officer</div>
            <div className="cp-officer">
              <div className="cp-officer-av">👮</div>
              <div>
                <div className="cp-officer-name">Ward {complaint.ward} Officer</div>
                <div className="cp-officer-desig">Assistant Commissioner, {complaint.ward} Ward</div>
              </div>
            </div>

            {/* Reported By — Anonymous */}
            <div className="cp-label">Reported By</div>
            <div className="cp-reporter">
              <div className="cp-reporter-name">👤 Anonymous Citizen</div>
              <div className="cp-reporter-meta">Mumbai Resident • Reported via NagrikAI</div>
            </div>

            {complaint.lat && complaint.lng && (
              <button className="cp-map-btn" onClick={() => window.open(`https://www.google.com/maps?q=${complaint.lat},${complaint.lng}`, '_blank')}>
                🗺️ Google Maps pe Dekho
              </button>
            )}

            <button
              className={`cp-share-btn ${linkCopied ? 'copied' : ''}`}
              onClick={() => { navigator.clipboard.writeText(window.location.href); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500) }}
            >
              {linkCopied ? '✅ Link Copied!' : '🔗 Tracking Link Copy Karo'}
            </button>

            <div className="cp-footer">Powered by <span>NagrikAI</span> — Mumbai ki awaaz</div>
          </div>
        )}
      </div>
    </>
  )
}