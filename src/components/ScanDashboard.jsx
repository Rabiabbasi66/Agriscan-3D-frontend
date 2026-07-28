import { useState, useEffect } from 'react'
import AlertFeed from './AlertFeed'

const CROP_TYPES = ['Wheat', 'Corn', 'Rice', 'Soybean', 'Cotton', 'Sugarcane']
const DISEASE_TYPES = [
  { name: 'Leaf Blight', count: 3, pct: 4.2 },
  { name: 'Powdery Mildew', count: 2, pct: 2.8 },
  { name: 'Root Rot', count: 3, pct: 3.9 },
  { name: 'Wheat Rust', count: 1, pct: 1.1 },
  { name: 'Healthy', count: 0, pct: 88.0 },
]

export default function ScanDashboard() {
  const [config, setConfig] = useState({
    altitude: 10,
    speed: 4,
    pattern: 'grid',
    frequency: 8,
  })
  const [selectedCrop, setSelectedCrop] = useState('Wheat')
  const [scanProgress, setScanProgress] = useState(73)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) { setRunning(false); return 100 }
        return Math.min(100, p + 0.08)
      })
    }, 200)
    return () => clearInterval(id)
  }, [running])

  return (
    <section className="py-8 px-6 max-w-7xl mx-auto" id="detections">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-px" style={{ background: 'var(--primary)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--primary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Mission Control</span>
        </div>
        <h2 className="font-display text-4xl font-700 tracking-wide" style={{ color: 'var(--foreground)' }}>
          Scan Configuration & Detections
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Scan controls */}
        <div className="agri-card p-5 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="font-display font-600 tracking-wider" style={{ color: 'var(--foreground)', fontSize: '14px', letterSpacing: '0.08em' }}>DRONE CONFIG</span>
          </div>

          {/* Altitude slider */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>ALTITUDE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--primary)' }}>{config.altitude}m</span>
            </div>
            <input
              type="range" min={5} max={30} step={1} value={config.altitude}
              onChange={e => setConfig(c => ({ ...c, altitude: Number(e.target.value) }))}
              className="w-full" style={{ accentColor: 'var(--primary)' }}
            />
            <div className="flex justify-between mt-0.5">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--muted-foreground)' }}>5m</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--muted-foreground)' }}>30m</span>
            </div>
          </div>

          {/* Speed slider */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>SPEED</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--primary)' }}>{config.speed} m/s</span>
            </div>
            <input
              type="range" min={1} max={12} step={0.5} value={config.speed}
              onChange={e => setConfig(c => ({ ...c, speed: Number(e.target.value) }))}
              className="w-full" style={{ accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Image frequency */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>CAPTURE / 10m</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--primary)' }}>{config.frequency} fps</span>
            </div>
            <input
              type="range" min={2} max={30} step={1} value={config.frequency}
              onChange={e => setConfig(c => ({ ...c, frequency: Number(e.target.value) }))}
              className="w-full" style={{ accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Pattern selector */}
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>FLIGHT PATTERN</span>
            <div className="grid grid-cols-3 gap-2">
              {['grid', 'spiral', 'crosshatch'].map(p => (
                <button
                  key={p}
                  onClick={() => setConfig(c => ({ ...c, pattern: p }))}
                  className="py-2 rounded text-center transition-all duration-200"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: config.pattern === p ? 'rgba(57,255,20,0.15)' : 'var(--secondary)',
                    border: `1px solid ${config.pattern === p ? 'rgba(57,255,20,0.4)' : 'var(--border)'}`,
                    color: config.pattern === p ? 'var(--primary)' : 'var(--muted-foreground)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Crop type */}
          <div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em', display: 'block', marginBottom: '8px' }}>CROP TYPE</span>
            <div className="flex flex-wrap gap-2">
              {CROP_TYPES.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCrop(c)}
                  className="px-2.5 py-1 rounded-sm text-xs transition-all duration-200"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    background: selectedCrop === c ? 'rgba(57,255,20,0.15)' : 'var(--secondary)',
                    border: `1px solid ${selectedCrop === c ? 'rgba(57,255,20,0.4)' : 'var(--border)'}`,
                    color: selectedCrop === c ? 'var(--primary)' : 'var(--muted-foreground)',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Launch button */}
          <button
            className="w-full py-3 rounded font-display font-700 tracking-widest transition-all duration-200"
            style={{
              background: running ? 'rgba(57,255,20,0.1)' : 'var(--primary)',
              border: `1px solid ${running ? 'rgba(57,255,20,0.3)' : 'var(--primary)'}`,
              color: running ? 'var(--primary)' : 'var(--primary-foreground)',
              fontSize: '13px',
              letterSpacing: '0.12em',
            }}
            onClick={() => setRunning(r => !r)}
          >
            {running ? '⏸  PAUSE SCAN' : '▶  LAUNCH SCAN'}
          </button>
        </div>

        {/* Scan progress + disease breakdown */}
        <div className="agri-card p-5 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--primary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="font-display font-600 tracking-wider" style={{ color: 'var(--foreground)', fontSize: '14px', letterSpacing: '0.08em' }}>SCAN PROGRESS</span>
          </div>

          {/* Circular progress */}
          <div className="flex items-center justify-center py-4">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--secondary)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="#39ff14" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 42 * scanProgress / 100} ${2 * Math.PI * 42}`}
                  style={{ transition: 'stroke-dasharray 0.3s ease', filter: 'drop-shadow(0 0 6px rgba(57,255,20,0.5))' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-4xl font-700" style={{ color: 'var(--foreground)', lineHeight: 1 }}>
                  {Math.round(scanProgress)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>% scanned</span>
              </div>
            </div>
          </div>

          {/* Disease breakdown */}
          <div className="flex flex-col gap-2">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Detection Breakdown
            </span>
            {DISEASE_TYPES.map(dt => (
              <div key={dt.name}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: dt.name === 'Healthy' ? 'var(--primary)' : 'var(--foreground)' }}>
                    {dt.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted-foreground)' }}>
                    {dt.pct}%
                  </span>
                </div>
                <div className="health-bar">
                  <div
                    className={`health-bar-fill ${dt.name !== 'Healthy' && dt.pct < 50 ? 'diseased' : ''}`}
                    style={{
                      width: `${dt.pct}%`,
                      background: dt.name === 'Healthy' ? 'linear-gradient(90deg, #39ff14, #22c55e)' : 'linear-gradient(90deg, #ff3030, #ef4444)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 mt-auto">
            {[
              { l: 'Images / session', v: '1,204' },
              { l: 'Processing time', v: '0.34s' },
              { l: 'Model', v: 'YOLOv8n' },
              { l: 'Classes trained', v: '28' },
            ].map(s => (
              <div key={s.l} className="rounded p-2.5" style={{ background: 'var(--secondary)', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--muted-foreground)', letterSpacing: '0.06em', marginBottom: '3px' }}>{s.l.toUpperCase()}</div>
                <div className="font-display font-700" style={{ color: 'var(--foreground)', fontSize: '16px' }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert feed */}
        <AlertFeed />
      </div>
    </section>
  )
}
