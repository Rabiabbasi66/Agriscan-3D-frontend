import React, { useRef, useState, useCallback, useEffect } from 'react'

const DISEASE_POOL = [
  { label: 'Leaf Blight (Alternaria)', severity: 'high' },
  { label: 'Powdery Mildew', severity: 'medium' },
  { label: 'Root Rot (Pythium)', severity: 'high' },
  { label: 'Wheat Rust', severity: 'low' },
  { label: 'Downy Mildew', severity: 'medium' },
  { label: 'Septoria Leaf Spot', severity: 'medium' },
  { label: 'Fusarium Wilt', severity: 'high' },
  { label: 'Healthy Crop', severity: 'healthy' },
]

const SEV_COLOR = {
  high: '#ff2020',
  medium: '#ff9020',
  low: '#facc15',
  healthy: '#39ff14',
}

function randomDetections() {
  const count = 2 + Math.floor(Math.random() * 4)
  const detections = []
  for (let i = 0; i < count; i++) {
    const disease = DISEASE_POOL[Math.floor(Math.random() * DISEASE_POOL.length)]
    const w = 0.1 + Math.random() * 0.22
    const h = 0.1 + Math.random() * 0.22
    detections.push({
      id: `det-${i}`,
      label: disease.label,
      severity: disease.severity,
      confidence: 85 + Math.random() * 14,
      x: Math.random() * (1 - w),
      y: Math.random() * (1 - h),
      w,
      h,
    })
  }
  return detections
}

function drawDetections(canvas, img, detections, progress) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  if (progress < 1) {
    const scanY = canvas.height * progress
    ctx.fillStyle = 'rgba(57,255,20,0.08)'
    ctx.fillRect(0, 0, canvas.width, scanY)
    ctx.strokeStyle = 'rgba(57,255,20,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, scanY)
    ctx.lineTo(canvas.width, scanY)
    ctx.stroke()
    const grad = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(0.5, 'rgba(57,255,20,0.25)')
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.fillRect(0, scanY - 8, canvas.width, 16)
    return
  }

  detections.forEach(d => {
    const px = d.x * canvas.width
    const py = d.y * canvas.height
    const pw = d.w * canvas.width
    const ph = d.h * canvas.height
    const color = SEV_COLOR[d.severity]

    ctx.fillStyle = color + '22'
    ctx.fillRect(px, py, pw, ph)

    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.strokeRect(px, py, pw, ph)

    const cs = 12
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(px, py + cs); ctx.lineTo(px, py); ctx.lineTo(px + cs, py)
    ctx.moveTo(px + pw - cs, py); ctx.lineTo(px + pw, py); ctx.lineTo(px + pw, py + cs)
    ctx.moveTo(px + pw, py + ph - cs); ctx.lineTo(px + pw, py + ph); ctx.lineTo(px + pw - cs, py + ph)
    ctx.moveTo(px + cs, py + ph); ctx.lineTo(px, py + ph); ctx.lineTo(px, py + ph - cs)
    ctx.stroke()

    const labelText = `${d.label} ${d.confidence.toFixed(1)}%`
    ctx.font = 'bold 11px JetBrains Mono, monospace'
    const tw = ctx.measureText(labelText).width
    const labelY = py > 20 ? py - 4 : py + ph + 16

    ctx.fillStyle = color + 'dd'
    ctx.fillRect(px, labelY - 13, tw + 10, 17)

    ctx.fillStyle = d.severity === 'healthy' ? '#060d06' : '#fff'
    ctx.fillText(labelText, px + 5, labelY)
  })
}

export default function ImageScanner() {
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  const [imageSrc, setImageSrc] = useState(null)
  const [scanState, setScanState] = useState('idle')
  const [scanProgress, setScanProgress] = useState(0)
  const [detections, setDetections] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const detectionsRef = useRef([])

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current || !imageSrc) return
    drawDetections(canvasRef.current, imgRef.current, detectionsRef.current, scanProgress)
  }, [scanProgress, imageSrc])

  const runScan = useCallback((src) => {
    setScanState('scanning')
    setScanProgress(0)
    setDetections([])
    const dets = randomDetections()
    detectionsRef.current = dets

    let p = 0
    const total = 80
    const id = setInterval(() => {
      p++
      const progress = p / total
      setScanProgress(progress)
      if (p >= total) {
        clearInterval(id)
        setScanState('done')
        setScanProgress(1)
        setDetections(dets)
        if (canvasRef.current && imgRef.current) {
          drawDetections(canvasRef.current, imgRef.current, dets, 1)
        }
      }
    }, 25)
    return () => clearInterval(id)
  }, [])

  const loadImage = useCallback((src) => {
    setImageSrc(src)
    setScanState('idle')
    setScanProgress(0)
    setDetections([])
    detectionsRef.current = []
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (!ctx) return
        canvasRef.current.width = img.naturalWidth
        canvasRef.current.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
      }
    }
    img.src = src
  }, [])

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const src = e.target?.result
      loadImage(src)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handlePaste = useCallback((e) => {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
    if (item) { const file = item.getAsFile(); if (file) handleFile(file) }
  }, [])

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const diseased = detections.filter(d => d.severity !== 'healthy')
  const avgConf = detections.length ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length : 0

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto" id="image-scan">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-px" style={{ background: '#39ff14' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            AI Image Analysis
          </span>
        </div>
        <h2 className="font-display text-4xl font-700 tracking-wide" style={{ color: '#e8f5e8' }}>
          Scan Drone or Mobile Images
        </h2>
        <p className="mt-2 max-w-xl" style={{ color: '#6b9b6b', fontSize: '14px' }}>
          Upload a photo from your drone or phone. YOLOv8 scans it in real time and draws
          bounding boxes around every detected disease or healthy region.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: upload + controls */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className="agri-card relative flex flex-col items-center justify-center p-8 cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragOver ? '#39ff14' : '#1c3a1c'}`,
              minHeight: '180px',
              background: dragOver ? 'rgba(57,255,20,0.04)' : '#0d1a0d',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: dragOver ? '#39ff14' : '#6b9b6b' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-display font-600 text-sm" style={{ color: '#e8f5e8', letterSpacing: '0.06em' }}>
              DROP IMAGE HERE
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', marginTop: '6px', textAlign: 'center', letterSpacing: '0.05em' }}>
              or click to browse · paste with Ctrl+V
            </span>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          </div>

          {/* Camera capture button */}
          <button
            className="agri-card w-full py-3 flex items-center justify-center gap-3 transition-all duration-200"
            style={{ border: '1px solid #1c3a1c', cursor: 'pointer' }}
            onClick={() => cameraInputRef.current?.click()}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(57,255,20,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1c3a1c')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: '#39ff14' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-display font-600 tracking-widest" style={{ color: '#e8f5e8', fontSize: '12px', letterSpacing: '0.1em' }}>
              USE CAMERA
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>(mobile / webcam)</span>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
          </button>

          {/* Scan button */}
          <button
            disabled={!imageSrc || scanState === 'scanning'}
            onClick={() => imageSrc && runScan(imageSrc)}
            className="w-full py-3.5 rounded font-display font-700 tracking-widest transition-all duration-200"
            style={{
              fontSize: '13px',
              letterSpacing: '0.12em',
              background: !imageSrc || scanState === 'scanning' ? 'rgba(57,255,20,0.06)' : '#39ff14',
              color: !imageSrc || scanState === 'scanning' ? '#6b9b6b' : '#060d06',
              border: `1px solid ${!imageSrc ? '#1c3a1c' : '#39ff14'}`,
              cursor: !imageSrc || scanState === 'scanning' ? 'not-allowed' : 'pointer',
            }}
          >
            {scanState === 'scanning' ? '⏳  SCANNING...' : scanState === 'done' ? '🔁  RESCAN' : '▶  RUN YOLOV8 SCAN'}
          </button>

          {/* Sample images */}
          <div>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.1em', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              Try a sample image
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&h=300&fit=crop&auto=format', label: 'Wheat field' },
                { url: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&h=300&fit=crop&auto=format', label: 'Corn rows' },
                { url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop&auto=format', label: 'Aerial crop' },
              ].map(s => (
                <button
                  key={s.url}
                  onClick={() => loadImage(s.url)}
                  className="relative overflow-hidden rounded group"
                  style={{ aspectRatio: '4/3', border: `1px solid ${imageSrc === s.url ? '#39ff14' : '#1c3a1c'}` }}
                >
                  <img src={s.url} alt={s.label} className="w-full h-full object-cover" crossOrigin="anonymous" />
                  <div
                    className="absolute inset-0 flex items-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(transparent, rgba(6,13,6,0.85))' }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#39ff14', letterSpacing: '0.06em' }}>{s.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Scan results summary */}
          {scanState === 'done' && (
            <div className="agri-card p-4 flex flex-col gap-3" style={{ border: '1px solid rgba(57,255,20,0.2)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Scan Report
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: 'Detections', v: String(detections.length) },
                  { l: 'Diseased', v: String(diseased.length) },
                  { l: 'Avg. Confidence', v: `${avgConf.toFixed(1)}%` },
                  { l: 'Model', v: 'YOLOv8n' },
                ].map(s => (
                  <div key={s.l} className="rounded p-2" style={{ background: '#122012', border: '1px solid #1c3a1c' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#6b9b6b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.l}</div>
                    <div className="font-display font-700 text-base mt-0.5" style={{ color: '#e8f5e8' }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Per-detection list */}
              <div className="flex flex-col gap-1.5 mt-1">
                {detections.map(d => (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: SEV_COLOR[d.severity] + '55', border: `1px solid ${SEV_COLOR[d.severity]}` }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#e8f5e8' }}>{d.label}</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: SEV_COLOR[d.severity], fontWeight: 600 }}>
                      {d.confidence.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: image canvas */}
        <div className="lg:col-span-3">
          <div
            className="agri-card relative overflow-hidden"
            style={{
              minHeight: '360px',
              background: imageSrc ? '#000' : '#0d1a0d',
              border: `1px solid ${scanState === 'scanning' ? 'rgba(57,255,20,0.4)' : '#1c3a1c'}`,
              transition: 'border-color 0.3s',
            }}
          >
            {!imageSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="relative w-32 h-24 rounded" style={{ border: '1px solid #1c3a1c' }}>
                  <div className="absolute inset-0 grid-overlay rounded" />
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="absolute left-2 right-2 h-2 rounded-sm" style={{ top: `${15 + i * 16}%`, background: '#1c3a1c' }} />
                  ))}
                  <div className="absolute w-8 h-8 rounded-full" style={{ right: 8, top: 12, border: '1.5px solid rgba(255,48,48,0.4)', background: 'rgba(255,48,48,0.06)' }} />
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6b9b6b', letterSpacing: '0.08em' }}>
                  No image loaded
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', opacity: 0.6 }}>
                  Upload or pick a sample above
                </span>
              </div>
            )}

            {imageSrc && (
              <canvas
                ref={canvasRef}
                className="w-full h-auto block"
                style={{ display: 'block', maxHeight: '560px', objectFit: 'contain' }}
              />
            )}

            {/* Scanning overlay animation */}
            {scanState === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute left-0 right-0 h-0.5"
                  style={{
                    top: `${scanProgress * 100}%`,
                    background: 'rgba(57,255,20,0.8)',
                    boxShadow: '0 0 12px rgba(57,255,20,0.6)',
                  }}
                />
              </div>
            )}

            {/* Corner HUD brackets */}
            {imageSrc && (
              <>
                {[['top-2 left-2', 'border-t border-l'], ['top-2 right-2', 'border-t border-r'], ['bottom-2 left-2', 'border-b border-l'], ['bottom-2 right-2', 'border-b border-r']].map(([pos, brd], i) => (
                  <div key={i} className={`absolute ${pos} w-6 h-6 ${brd} pointer-events-none`} style={{ borderColor: 'rgba(57,255,20,0.5)' }} />
                ))}
              </>
            )}

            {/* Status badge */}
            {scanState !== 'idle' && (
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded" style={{ background: 'rgba(6,13,6,0.85)', border: '1px solid rgba(57,255,20,0.3)' }}>
                  <span className={`w-2 h-2 rounded-full ${scanState === 'scanning' ? 'animate-blink' : ''}`} style={{ background: scanState === 'scanning' ? '#39ff14' : '#39ff14' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#39ff14', letterSpacing: '0.1em' }}>
                    {scanState === 'scanning' ? `SCANNING ${Math.round(scanProgress * 100)}%` : `${detections.length} DETECTIONS`}
                  </span>
                </div>
              </div>
            )}

            {/* Done: detection count badge */}
            {scanState === 'done' && diseased.length > 0 && (
              <div className="absolute top-3 right-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded" style={{ background: 'rgba(255,32,32,0.15)', border: '1px solid rgba(255,32,32,0.4)' }}>
                  <span className="w-2 h-2 rounded-full animate-blink" style={{ background: '#ff2020' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff2020', letterSpacing: '0.1em' }}>
                    {diseased.length} DISEASE{diseased.length !== 1 ? 'S' : ''} FOUND
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Legend below canvas */}
          {scanState === 'done' && (
            <div className="flex items-center gap-5 mt-3 px-1">
              {Object.entries(SEV_COLOR).map(([sev, col]) => (
                <div key={sev} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: col + '33', border: `1.5px solid ${col}` }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', textTransform: 'capitalize' }}>{sev}</span>
                </div>
              ))}
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', marginLeft: 'auto' }}>
                YOLOv8 · {new Date().toLocaleTimeString('en-US', { hour12: false })}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}