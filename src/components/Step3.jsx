import { useEffect, useRef, useState } from 'react'
import emailjs from '@emailjs/browser'
import { db } from '../firebase'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'

const ROASTS = {
  Pothole: [
    "BMC ne road nahi banaya, swimming pool banaya hai 🕳️ @mybmc #FixMumbai #{ward} #NagrikAI",
    "Ye pothole itna bada hai, usme BMC ka kaam bhi samaaye 😤 @mybmc #MumbaiRoads #{ward} #NagrikAI",
    "Moonh maango daam, pothole maango aur bhi zyada 🙃 @mybmc #MumbaiRoads #{ward} #NagrikAI",
  ],
  Garbage: [
    "BMC ka dustbin? Poori sadak hai bhai 🗑️ @mybmc #SwachhMumbai #{ward} #NagrikAI",
    "Ye garbage nahin, BMC ki achievements ka collection hai 🤮 @mybmc #FixMumbai #{ward} #NagrikAI",
    "Smell toh aata hai, BMC ka number nahi aata 😷 @mybmc #CleanMumbai #{ward} #NagrikAI",
  ],
  'Broken Streetlight': [
    "BMC ka andhere mein raaj — literally 💡 @mybmc #FixMumbai #{ward} #NagrikAI",
    "Light nahin hai, BMC ka kaam bhi dikha nahi 🔦 @mybmc #MumbaiNights #{ward} #NagrikAI",
    "Andhera kaayam rahega jab tak BMC so raha hai 😴 @mybmc #{ward} #NagrikAI",
  ],
  Waterlogging: [
    "Mumbai nahi, Venice ho gaya 🌊 BMC shukriya! @mybmc #MumbaiFloods #{ward} #NagrikAI",
    "Baarish nahi hui thi, lekin drain bhi clean nahi hua tha 💧 @mybmc #{ward} #NagrikAI",
    "Hamare tax ka paani hi hamare ghar aata hai 😒 @mybmc #FixDrains #{ward} #NagrikAI",
  ],
  Other: [
    "Ek aur cheez toot gaya Mumbai mein — BMC ki zimmedari 🤦 @mybmc #FixMumbai #{ward} #NagrikAI",
    "BMC: Ye hamara kaam nahin. Mumbai: Tab kiska hai? 😤 @mybmc #{ward} #NagrikAI",
    "Issue report kiya, BMC ne ignore kiya — baar baar ka story 🙄 @mybmc #{ward} #NagrikAI",
  ]
}

const getRoast = (issueType, wardName) => {
  const list = ROASTS[issueType] || ROASTS.Other
  const pick = list[Math.floor(Math.random() * list.length)]
  return pick.replace(/{ward}/g, wardName.replace(/ /g, ''))
}

export default function Step3({ result, location, preview, user, complaintId }) {
  const canvasRef = useRef(null)
  const [roast] = useState(() => getRoast(result.issueType, location.ward.name))
  const [storyReady, setStoryReady] = useState(false)
  const [storyDataUrl, setStoryDataUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [editableEmailBody, setEditableEmailBody] = useState('')
  const [photoBase64, setPhotoBase64] = useState('')

  const trackingUrl = `${window.location.origin}/complaint/${complaintId}`

  useEffect(() => {
    if (preview) {
      fetch(preview)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader()
          reader.onload = () => setPhotoBase64(reader.result)
          reader.readAsDataURL(blob)
        })
        .catch(e => console.error('Photo base64 convert error:', e))
    }
    if (preview) drawStory()
  }, [])

  const buildDefaultEmailBody = () =>
`To      : ${location.ward.wardOfficerName}
Position: ${location.ward.wardOfficerDesignation}
Email   : ${location.ward.wardOfficeEmail}

━━━━━━━━━━━━━━━━━━━━━━━━
COMPLAINT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━
Complaint ID : ${complaintId}
Issue Type   : ${result.issueType}
Severity     : ${result.severity}
Ward         : ${location.ward.ward} — ${location.ward.name}
Address      : ${result.addressDetail || 'Not specified'}
GPS          : ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}
Date & Time  : ${new Date().toLocaleString('en-IN')}
━━━━━━━━━━━━━━━━━━━━━━━━

Description  : ${result.description}

Reported By  : ${user.firstName} ${user.lastName}
Mobile       : ${user.mobile}
Email        : ${user.email}

Track publicly: ${trackingUrl}

Please acknowledge and take action within 48 hours.

Regards,
NagrikAI Platform`

  const openEmailModal = () => {
    setEditableEmailBody(buildDefaultEmailBody())
    setShowEmailPreview(true)
  }

  const drawStory = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = 1080; canvas.height = 1920

    const img = new Image()
    img.src = preview
    img.onload = () => {
      ctx.fillStyle = '#0D0D0D'
      ctx.fillRect(0, 0, 1080, 1920)

      const imgAspect = img.width / img.height
      const drawW = 1080, drawH = drawW / imgAspect
      ctx.drawImage(img, 0, (1920 - drawH) / 2, drawW, drawH)

      const topGrad = ctx.createLinearGradient(0, 0, 0, 500)
      topGrad.addColorStop(0, 'rgba(0,0,0,0.92)')
      topGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = topGrad; ctx.fillRect(0, 0, 1080, 500)

      const botGrad = ctx.createLinearGradient(0, 1200, 0, 1920)
      botGrad.addColorStop(0, 'rgba(0,0,0,0)')
      botGrad.addColorStop(1, 'rgba(0,0,0,0.97)')
      ctx.fillStyle = botGrad; ctx.fillRect(0, 0, 1080, 1920)

      ctx.fillStyle = '#FF6B00'; ctx.font = 'bold 82px Arial'; ctx.textAlign = 'left'
      ctx.fillText('Nagrik', 60, 110)
      ctx.fillStyle = '#ffffff'; ctx.fillText('AI', 348, 110)
      ctx.fillStyle = '#ffffff66'; ctx.font = '30px Arial'
      ctx.fillText('Mumbai Civic Report • ' + new Date().toLocaleDateString('en-IN'), 60, 155)

      ctx.fillStyle = '#ffffff15'; ctx.beginPath()
      ctx.roundRect(60, 172, 520, 52, 10); ctx.fill()
      ctx.fillStyle = '#FF6B00'; ctx.font = 'bold 26px Arial'
      ctx.fillText(`ID: ${complaintId}`, 75, 206)

      const badgeColor = result.severity === 'High' ? '#FF3B30' : result.severity === 'Medium' ? '#FF9500' : '#34C759'
      ctx.fillStyle = badgeColor; ctx.beginPath()
      ctx.roundRect(60, 242, 520, 88, 44); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center'
      ctx.fillText(`${result.issueType}`, 320, 298)
      ctx.fillStyle = '#ffffff20'; ctx.beginPath()
      ctx.roundRect(600, 242, 260, 88, 44); ctx.fill()
      ctx.fillStyle = badgeColor; ctx.font = 'bold 40px Arial'
      ctx.fillText(`${result.severity}`, 730, 298)

      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 52px Arial'; ctx.textAlign = 'left'
      ctx.fillText(`${location.ward.name}`, 60, 1500)
      ctx.fillStyle = '#ffcc00'; ctx.font = '38px Arial'
      ctx.fillText(`BMC Ward ${location.ward.ward} - Mumbai`, 60, 1556)
      if (result.addressDetail) {
        ctx.fillStyle = '#cccccc'; ctx.font = '32px Arial'
        ctx.fillText(result.addressDetail.substring(0, 46), 60, 1602)
      }

      ctx.fillStyle = '#ffffff'; ctx.font = '40px Arial'; ctx.textAlign = 'center'
      wrapText(ctx, roast, 540, 1660, 960, 56)

      ctx.fillStyle = '#FF6B00'; ctx.fillRect(0, 1860, 1080, 60)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center'
      ctx.fillText(`Track: ${window.location.host}/complaint/${complaintId}`, 540, 1898)

      setStoryDataUrl(canvas.toDataURL('image/jpeg', 0.95))
      setStoryReady(true)
    }
  }

  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(' ')
    let line = ''
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + ' '
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, x, y); line = words[i] + ' '; y += lineHeight
      } else line = test
    }
    ctx.fillText(line, x, y)
  }

  const downloadStory = () => {
    const a = document.createElement('a')
    a.href = storyDataUrl
    a.download = `NagrikAI-${complaintId}.jpg`
    a.click()
  }

  const copyCaption = () => {
    navigator.clipboard.writeText(roast + '\n\nTrack complaint: ' + trackingUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  const shareOnX = () => {
    if (storyReady && storyDataUrl) {
      const a = document.createElement('a')
      a.href = storyDataUrl
      a.download = `NagrikAI-${complaintId}.jpg`
      a.click()
    }
    setTimeout(() => {
      const text = encodeURIComponent(
        `Civic Issue Reported - ${location.ward.name}, Mumbai!\n` +
        `Issue: ${result.issueType} | Severity: ${result.severity}\n` +
        (result.addressDetail ? `${result.addressDetail}\n` : '') +
        `\n${roast}\n\n` +
        `Track complaint: ${trackingUrl}\n\n` +
        `@mybmc #FixMumbai #${location.ward.name.replace(/ /g, '')} #NagrikAI`
      )
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
    }, 600)
  }

  const sendEmail = async () => {
    setEmailSending(true)
    setEmailError('')
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          to_email: location.ward.wardOfficeEmail,
          complaint_id: complaintId,
          issue_type: result.issueType,
          severity: result.severity,
          ward: location.ward.ward,
          ward_name: location.ward.name,
          officer_name: location.ward.wardOfficerName,
          address_detail: result.addressDetail || 'Not specified',
          gps: `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
          description: result.description,
          user_name: `${user.firstName} ${user.lastName}`,
          user_mobile: user.mobile,
          user_email: user.email,
          tracking_url: trackingUrl,
          email_body: editableEmailBody,
          photo_base64: photoBase64,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      )

      // Update Firestore status to Reported after email sent
      const q = query(collection(db, 'complaints'), where('complaintId', '==', complaintId))
      const snap = await getDocs(q)
      if (!snap.empty) {
        await updateDoc(doc(db, 'complaints', snap.docs[0].id), {
          status: 'Reported',
          emailSentAt: new Date().toISOString()
        })
      }

      setEmailSent(true)
      setShowEmailPreview(false)
    } catch (err) {
      console.error('EmailJS error:', err)
      setEmailError('Email send nahi hua — dobara try karo')
    }
    setEmailSending(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .s3-wrap { padding: 0 20px 48px; font-family: 'DM Sans', sans-serif; }
        .s3-section-label { font-size: 11px; color: #555; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; font-weight: 600; }
        .s3-id-card { background: #FF6B0012; border: 1px solid #FF6B0035; border-radius: 16px; padding: 14px 16px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .s3-id-label { font-size: 10px; color: #FF6B00; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; font-weight: 700; }
        .s3-id-value { font-size: 15px; font-weight: 700; color: #fff; font-family: monospace; letter-spacing: 1px; }
        .s3-id-url { font-size: 11px; color: #555; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .s3-copy-btn { background: transparent; border: 1px solid #2A2A2A; border-radius: 10px; color: #777; padding: 8px 13px; cursor: pointer; font-size: 12px; font-family: 'DM Sans', sans-serif; font-weight: 600; white-space: nowrap; transition: all 0.2s; }
        .s3-copy-btn:hover { border-color: #FF6B00; color: #FF6B00; }
        .s3-copy-btn.done { border-color: #34C759; color: #34C759; }
        .s3-officer-card { background: #1A1A1A; border: 1px solid #252525; border-radius: 16px; padding: 14px 16px; margin-bottom: 12px; display: flex; gap: 12px; align-items: flex-start; }
        .s3-officer-avatar { width: 42px; height: 42px; border-radius: 50%; background: #252525; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .s3-officer-name { font-size: 14px; font-weight: 700; color: #fff; }
        .s3-officer-desig { font-size: 11px; color: #555; margin-top: 2px; line-height: 1.4; }
        .s3-officer-email { font-size: 11px; color: #FF6B00; margin-top: 5px; }
        .s3-story-wrap { border-radius: 20px; overflow: hidden; margin-bottom: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); }
        .s3-story-wrap img { width: 100%; display: block; }
        .s3-loading-story { background: #1A1A1A; border-radius: 20px; padding: 32px; text-align: center; margin-bottom: 12px; }
        .s3-loading-spinner { width: 32px; height: 32px; border: 3px solid #252525; border-top-color: #FF6B00; border-radius: 50%; animation: s3spin 0.8s linear infinite; margin: 0 auto 10px; }
        @keyframes s3spin { to { transform: rotate(360deg); } }
        .s3-roast-box { background: #1A1A1A; border: 1px solid #252525; border-radius: 16px; padding: 14px 16px; margin-bottom: 12px; }
        .s3-roast-text { color: #bbb; font-size: 13px; line-height: 1.75; }
        .s3-btn { width: 100%; padding: 15px; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        .s3-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .s3-btn-orange { background: #FF6B00; color: #fff; }
        .s3-btn-orange:hover:not(:disabled) { background: #E55A00; transform: translateY(-1px); }
        .s3-btn-x { background: #000; color: #fff; border: 1px solid #2A2A2A; }
        .s3-btn-x:hover { background: #111; border-color: #888; }
        .s3-btn-dark { background: #1A1A1A; color: #fff; border: 1px solid #2A2A2A; }
        .s3-btn-dark:hover:not(:disabled) { border-color: #FF6B00; color: #FF6B00; }
        .s3-btn-ghost { background: transparent; color: #444; border: 1px solid #1E1E1E; }
        .s3-btn-ghost:hover { color: #888; border-color: #333; }
        .s3-btn-success { background: #0D2E1A; color: #34C759; border: 1px solid #34C75930; }
        .s3-x-hint { font-size: 11px; color: #3A3A3A; text-align: center; margin-top: -6px; margin-bottom: 10px; line-height: 1.5; }
        .s3-error-msg { background: #FF3B3012; border: 1px solid #FF3B3035; color: #FF3B30; padding: 11px 15px; border-radius: 12px; font-size: 13px; margin-bottom: 10px; }
        .s3-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 999; display: flex; align-items: flex-end; }
        .s3-modal-sheet { background: #111; border-radius: 26px 26px 0 0; padding: 24px 20px 36px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .s3-modal-title { font-family: 'Syne', sans-serif; font-size: 19px; font-weight: 800; margin-bottom: 4px; color: #fff; }
        .s3-modal-sub { font-size: 13px; color: #555; margin-bottom: 16px; line-height: 1.7; }
        .s3-modal-to { color: #FF6B00; font-weight: 600; }
        .s3-modal-photo { width: 100%; border-radius: 12px; margin-bottom: 14px; display: block; max-height: 220px; object-fit: cover; border: 1px solid #252525; }
        .s3-email-edit-label { font-size: 10px; color: #FF6B00; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
        .s3-edit-badge { background: #FF6B0018; border: 1px solid #FF6B0030; color: #FF6B00; font-size: 10px; padding: 2px 8px; border-radius: 6px; }
        .s3-email-textarea { width: 100%; background: #161616; border: 1.5px solid #252525; border-radius: 12px; padding: 14px 16px; font-size: 11.5px; color: #bbb; line-height: 1.9; font-family: 'Courier New', monospace; margin-bottom: 12px; min-height: 260px; resize: vertical; outline: none; transition: border-color 0.2s; }
        .s3-email-textarea:focus { border-color: #FF6B00; }
        .s3-photo-note { font-size: 11px; color: #3A3A3A; margin-bottom: 14px; padding: 9px 12px; background: #161616; border-radius: 10px; border: 1px solid #1E1E1E; line-height: 1.6; }
        .s3-modal-actions { display: flex; gap: 10px; }
        .s3-modal-actions .s3-btn { flex: 1; margin-bottom: 0; }
        .s3-spinner-sm { width: 15px; height: 15px; border: 2px solid #ffffff30; border-top-color: #fff; border-radius: 50%; animation: s3spin 0.7s linear infinite; }
      `}</style>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="s3-wrap">
        <div className="s3-id-card">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="s3-id-label">Complaint ID</div>
            <div className="s3-id-value">{complaintId}</div>
            <div className="s3-id-url">🔗 {trackingUrl}</div>
          </div>
          <button className={`s3-copy-btn ${copied ? 'done' : ''}`} onClick={() => { navigator.clipboard.writeText(trackingUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) }}>
            {copied ? '✅ Copied' : '📋 Copy Link'}
          </button>
        </div>

        <div className="s3-section-label">Ward Officer</div>
        <div className="s3-officer-card">
          <div className="s3-officer-avatar">👮</div>
          <div>
            <div className="s3-officer-name">{location.ward.wardOfficerName}</div>
            <div className="s3-officer-desig">{location.ward.wardOfficerDesignation}</div>
            <div className="s3-officer-email">{location.ward.wardOfficeEmail}</div>
          </div>
        </div>

        <div className="s3-section-label">Instagram Story</div>
        {!storyReady && (
          <div className="s3-loading-story">
            <div className="s3-loading-spinner" />
            <div style={{ color: '#555', fontSize: 13 }}>Story generate ho rahi hai...</div>
          </div>
        )}
        {storyReady && storyDataUrl && (
          <div className="s3-story-wrap">
            <img src={storyDataUrl} alt="Story Preview" />
          </div>
        )}

        <div className="s3-roast-box">
          <div className="s3-roast-text">{roast}</div>
        </div>

        {storyReady && (
          <button className="s3-btn s3-btn-orange" onClick={downloadStory}>⬇️ Story Download Karo</button>
        )}

        <button className="s3-btn s3-btn-x" onClick={shareOnX}>𝕏 &nbsp;X pe Share Karo</button>
        <div className="s3-x-hint">📥 Story auto download hogi → phir tweet window khulega → image attach karo</div>

        {emailSent ? (
          <button className="s3-btn s3-btn-success" disabled>✅ Email Bhej Diya — {location.ward.wardOfficerName} ko</button>
        ) : (
          <button className="s3-btn s3-btn-dark" onClick={openEmailModal}>📧 Ward Officer ko Email Bhejo</button>
        )}

        {emailError && <div className="s3-error-msg">⚠️ {emailError}</div>}

        <button className="s3-btn s3-btn-ghost" onClick={copyCaption}>
          {copied ? '✅ Caption Copied!' : '📋 Caption Copy Karo'}
        </button>

        <button className="s3-btn s3-btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent('restartApp'))}>
          🔄 Naya Issue Report Karo
        </button>
      </div>

      {showEmailPreview && (
        <div className="s3-modal-overlay" onClick={() => !emailSending && setShowEmailPreview(false)}>
          <div className="s3-modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="s3-modal-title">📧 Email Preview</div>
            <div className="s3-modal-sub">
              Jayegi → <span className="s3-modal-to">{location.ward.wardOfficeEmail}</span>
              <br /><span style={{ fontSize: 11, color: '#3A3A3A' }}>✅ Directly background mein send hogi</span>
            </div>
            {preview && (
              <>
                <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>📷 Attached Photo</div>
                <img src={preview} className="s3-modal-photo" alt="Issue Photo" />
              </>
            )}
            <div className="s3-email-edit-label">
              ✏️ Email Body
              <span className="s3-edit-badge">EDITABLE</span>
            </div>
            <textarea className="s3-email-textarea" value={editableEmailBody} onChange={e => setEditableEmailBody(e.target.value)} disabled={emailSending} spellCheck={false} />
            <div className="s3-photo-note">📎 Photo automatically email mein inline attach hogi.</div>
            <div className="s3-modal-actions">
              <button className="s3-btn s3-btn-ghost" onClick={() => setShowEmailPreview(false)} disabled={emailSending}>Cancel</button>
              <button className="s3-btn s3-btn-orange" onClick={sendEmail} disabled={emailSending}>
                {emailSending ? <><div className="s3-spinner-sm" /> Bhej raha hai...</> : '🚀 Bhejo Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}