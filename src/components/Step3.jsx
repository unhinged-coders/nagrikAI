import { useEffect, useRef, useState } from 'react'

const roastTemplates = [
  (issue, ward) => `Bhai ${ward} wale! Ye ${issue} fix karo warna hum sab cycle pe aayenge! 😤 #FixMumbai @mybmc`,
  (issue, ward) => `${ward} mein ${issue} hai aur BMC so rahi hai. Jago bhai jago! 😴 #NagrikAI @mybmc`,
  (issue, ward) => `Ye ${issue} in ${ward} is older than my dadaji. Fix karo please! 🙏 #MumbaiProblems @mybmc`,
  (issue, ward) => `${ward} ka ${issue} — taxpayer ka paisa gaya kahan? 💸 #BMCUthao @mybmc`,
  (issue, ward) => `Breaking: ${ward} mein ${issue} milaa! Police: shocked. BMC: sleeping 😂 #NagrikAI @mybmc`,
]

export default function Step3({ result, photo, ward, address, complaintId }) {
  const canvasRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [storyReady, setStoryReady] = useState(false)

  const roast = roastTemplates[Math.floor(Math.random() * roastTemplates.length)](
    result?.issueType || 'civic issue',
    ward?.name || 'Mumbai'
  )

  useEffect(() => {
    generateStory()
  }, [])

  const generateStory = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = 1080
    canvas.height = 1920

    // Background
    ctx.fillStyle = '#0D0D0D'
    ctx.fillRect(0, 0, 1080, 1920)

    // Photo background
    if (photo) {
      const img = new Image()
      img.onload = () => {
        // Draw photo centered
        const aspectRatio = img.width / img.height
        let drawW = 1080, drawH = 1080 / aspectRatio
        if (drawH < 1080) { drawH = 1080; drawW = 1080 * aspectRatio }
        ctx.drawImage(img, (1080 - drawW) / 2, 200, drawW, drawH)

        // Dark gradient overlay
        const grad = ctx.createLinearGradient(0, 0, 0, 1920)
        grad.addColorStop(0, 'rgba(13,13,13,0.7)')
        grad.addColorStop(0.4, 'rgba(13,13,13,0.2)')
        grad.addColorStop(0.7, 'rgba(13,13,13,0.8)')
        grad.addColorStop(1, 'rgba(13,13,13,1)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 1080, 1920)

        drawText(ctx, roast, ward, address, complaintId)
        setStoryReady(true)
      }
      img.src = photo
    } else {
      drawText(ctx, roast, ward, address, complaintId)
      setStoryReady(true)
    }
  }

  const drawText = (ctx, roast, ward, address, complaintId) => {
    // NagrikAI header
    ctx.fillStyle = '#FF6B00'
    ctx.font = 'bold 60px Arial'
    ctx.fillText('NagrikAI 🇮🇳', 60, 120)

    ctx.fillStyle = '#ffffff'
    ctx.font = '36px Arial'
    ctx.fillText('Mumbai ki awaaz, AI ki taakat', 60, 175)

    // Issue badge
    ctx.fillStyle = '#FF6B00'
    roundRect(ctx, 60, 1100, 400, 80, 40)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px Arial'
    ctx.fillText(`🚨 ${result?.issueType || 'Civic Issue'}`, 90, 1148)

    // Severity badge
    const sevColor = result?.severity === 'High' ? '#FF3B30' : result?.severity === 'Medium' ? '#FF9500' : '#34C759'
    ctx.fillStyle = sevColor
    roundRect(ctx, 480, 1100, 280, 80, 40)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 36px Arial'
    ctx.fillText(`⚡ ${result?.severity || 'Medium'}`, 510, 1148)

    // Location
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 42px Arial'
    ctx.fillText(`📍 Ward ${ward?.ward || ''} — ${ward?.name || 'Mumbai'}`, 60, 1240)

    if (address) {
      ctx.fillStyle = '#aaaaaa'
      ctx.font = '34px Arial'
      ctx.fillText(address.substring(0, 45) + (address.length > 45 ? '...' : ''), 60, 1295)
    }

    // Description
    ctx.fillStyle = '#dddddd'
    ctx.font = '32px Arial'
    const desc = result?.description || 'Civic issue reported'
    wrapText(ctx, desc, 60, 1360, 960, 42)

    // Roast caption box
    ctx.fillStyle = 'rgba(255,107,0,0.15)'
    roundRect(ctx, 40, 1530, 1000, 200, 20)
    ctx.strokeStyle = '#FF6B00'
    ctx.lineWidth = 3
    roundRectStroke(ctx, 40, 1530, 1000, 200, 20)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'italic 30px Arial'
    wrapText(ctx, roast, 70, 1580, 940, 40)

    // Complaint ID + tracking
    ctx.fillStyle = '#666666'
    ctx.font = '26px Arial'
    ctx.fillText(`Complaint ID: ${complaintId || 'NM-2026-XXXX'}`, 60, 1790)
    ctx.fillStyle = '#FF6B00'
    ctx.fillText('Track: nagrik-ai.vercel.app/c/' + (complaintId || ''), 60, 1830)

    // Hashtags
    ctx.fillStyle = '#FF6B00'
    ctx.font = 'bold 30px Arial'
    ctx.fillText('#NagrikAI #FixMumbai #BMC #MumbaiProblems', 60, 1890)
  }

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.fill()
  }

  const roundRectStroke = (ctx, x, y, w, h, r) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.stroke()
  }

  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(' ')
    let line = ''
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' '
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line, x, y)
        line = words[n] + ' '
        y += lineHeight
      } else {
        line = testLine
      }
    }
    ctx.fillText(line, x, y)
  }

  const downloadStory = () => {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `nagrik-complaint-${complaintId}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  const copyXPost = () => {
    navigator.clipboard.writeText(roast + `\n\nComplaint ID: ${complaintId}\nTrack: nagrik-ai.vercel.app/c/${complaintId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openXPost = () => {
    const tweet = encodeURIComponent(roast + `\n\nComplaint ID: ${complaintId}`)
    window.open(`https://twitter.com/intent/tweet?text=${tweet}`, '_blank')
  }

  return (
    <div className="step3-container">
      <h2 className="section-title">📱 Your Story is Ready!</h2>

      <canvas ref={canvasRef} style={{ width: '100%', borderRadius: '12px', display: 'block' }} />

      <div className="action-buttons">
        <button className="btn-primary" onClick={downloadStory}>
          ⬇️ Download Story
        </button>
        <button className="btn-secondary" onClick={openXPost}>
          🐦 Post on X
        </button>
        <button className="btn-outline" onClick={copyXPost}>
          {copied ? '✅ Copied!' : '📋 Copy Caption'}
        </button>
      </div>

      <div className="roast-box">
        <p className="roast-label">Your Caption:</p>
        <p className="roast-text">{roast}</p>
      </div>
    </div>
  )
}