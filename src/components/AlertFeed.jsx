import React, { useEffect, useRef, useState } from 'react'

const INITIAL_ALERTS = [
  { id: 'a1', time: '14:32:18', disease: 'Leaf Blight (Alternaria)', sector: 'Field A — Row 12–18', severity: 'high', confidence: 97.4, lat: '28.6°N', lon: '77.1°E' },
  { id: 'a2', time: '14:29:04', disease: 'Powdery Mildew', sector: 'Field B — Row 4–7', severity: 'medium', confidence: 94.1, lat: '28.6°N', lon: '77.2°E' },
  { id: 'a3', time: '14:22:51', disease: 'Root Rot (Pythium)', sector: 'Field C — Row 21–26', severity: 'high', confidence: 96.8, lat: '28.7°N', lon: '77.1°E' },
  { id: 'a4', time: '14:18:33', disease: 'Wheat Rust', sector: 'Field A — Row 31–34', severity: 'low', confidence: 89.2, lat: '28.6°N', lon: '77.0°E' },
  { id: 'a5', time: '14:12:07', disease: 'Downy Mildew', sector: 'Field D — Row 8–10', severity: 'medium', confidence: 91.5, lat: '28.5°N', lon: '77.2°E' },
  { id: 'a6', time: '14:06:44', disease: 'Healthy Crops', sector: 'Field B — Row 14–20', severity: 'low', confidence: 99.1, lat: '28.6°N', lon: '77.1°E' },
]

const NEW_ALERTS = [
  { time: '', disease: 'Septoria Leaf Spot', sector: 'Field A — Row 5–9', severity: 'medium', confidence: 93.7, lat: '28.6°N', lon: '77.0°E' },
  { time: '', disease: 'Fusarium Wilt', sector: 'Field C — Row 14–17', severity: 'high', confidence: 98.2, lat: '28.7°N', lon: '77.2°E' },
]

const SEVERITY_CONFIG = {
  high: { color: '#ff3030', bg: 'rgba(255,48,48,0.1)', label: 'HIGH' },
  medium: { color: '#ff9020', bg: 'rgba(255,144,32,0.1)', label: 'MED' },
  low: { color: '#39ff14', bg: 'rgba(57,255,20,0.1)', label: 'LOW' },
}

function getNow() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AlertFeed() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS)
  const [newIdx, setNewIdx] = useState(0)
  const [flash, setFlash] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      const template = NEW_ALERTS[newIdx % NEW_ALERTS.length]
      const newAlert = {
        ...template,
        id: `auto-${Date.now()}`,
        time: getNow(),
      }
      setAlerts(prev => [newAlert, ...prev.slice(0, 14)])
      setFlash(newAlert.id)
      setNewIdx(n => n + 1)
      setTimeout(() => setFlash(null), 1500)
    }, 8000)
    return () => clearInterval(interval)
  }, [newIdx])

  return (
    <div className="agri-card h-full flex flex-col" id="detections">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1c3a1c' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full animate-blink" style={{ background: '#ff3030' }} />
          <span className="font-display text-base font-600 tracking-wider" style={{ color: '#e8f5e8' }}>
            DETECTION FEED
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.08em' }}>
            YOLOv8
          </span>
          <div className="px-2 py-0.5 rounded-sm" style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#39ff14', letterSpacing: '0.08em' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Alert list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2" style={{ maxHeight: '420px' }}>
        {alerts.map((alert, i) => {
          const cfg = SEVERITY_CONFIG[alert.severity]
          const isNew = alert.id === flash
          return (
            <div
              key={alert.id}
              className="rounded p-3 transition-all duration-500"
              style={{
                background: isNew ? 'rgba(57,255,20,0.06)' : '#122012',
                border: `1px solid ${isNew ? 'rgba(57,255,20,0.3)' : '#1c3a1c'}`,
                transform: i === 0 && isNew ? 'scale(1.01)' : 'scale(1)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="px-1.5 py-0.5 rounded-sm text-xs font-bold shrink-0"
                    style={{ background: cfg.bg, color: cfg.color, fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.06em' }}
                  >
                    {cfg.label}
                  </span>
                  <span className="font-semibold truncate" style={{ color: alert.disease === 'Healthy Crops' ? '#39ff14' : '#e8f5e8', fontSize: '13px' }}>
                    {alert.disease}
                  </span>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.05em', flexShrink: 0 }}>
                  {alert.time}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>
                  {alert.sector}
                </span>
                <div className="flex items-center gap-1">
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>conf.</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: alert.confidence > 95 ? '#39ff14' : '#e8f5e8', fontWeight: 600 }}>
                    {alert.confidence}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer summary */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #1c3a1c' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.06em' }}>
          {alerts.length} events logged
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#39ff14', letterSpacing: '0.06em' }}>
          avg confidence {(alerts.reduce((s, a) => s + a.confidence, 0) / alerts.length).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}