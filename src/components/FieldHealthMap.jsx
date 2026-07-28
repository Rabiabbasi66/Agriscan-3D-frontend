import React, { useEffect, useRef, useState } from 'react'

const FIELD_ROWS = 18
const FIELD_COLS = 28

function generateField() {
  const rows = []
  const diseasedPatches = [
    { cx: 5, cy: 4, r: 3 },
    { cx: 20, cy: 10, r: 2.5 },
    { cx: 8, cy: 13, r: 2 },
    { cx: 24, cy: 6, r: 1.8 },
  ]
  const diseaseNames = ['Leaf Blight', 'Powdery Mildew', 'Root Rot', 'Wheat Rust']

  for (let row = 0; row < FIELD_ROWS; row++) {
    const cols = []
    for (let col = 0; col < FIELD_COLS; col++) {
      let health = 0.75 + Math.random() * 0.25
      let disease = undefined
      diseasedPatches.forEach((p, i) => {
        const dist = Math.sqrt((col - p.cx) ** 2 + (row - p.cy) ** 2)
        if (dist < p.r) {
          health = Math.max(0.05, health - (1 - dist / p.r) * 0.85)
          if (dist < p.r * 0.6) disease = diseaseNames[i]
        }
      })
      cols.push({ x: col, y: row, health, disease })
    }
    rows.push(cols)
  }
  return rows
}

function healthColor(h) {
  if (h > 0.7) {
    const t = (h - 0.7) / 0.3
    const r = Math.round(10 + t * 10)
    const g = Math.round(80 + t * 120)
    const b = Math.round(10 + t * 10)
    return `rgb(${r},${g},${b})`
  } else if (h > 0.35) {
    const t = (h - 0.35) / 0.35
    const r = Math.round(255 - t * 200)
    const g = Math.round(60 + t * 60)
    return `rgb(${r},${g},10)`
  } else {
    const t = h / 0.35
    const r = Math.round(180 + t * 75)
    return `rgb(${r},20,20)`
  }
}

export default function FieldHealthMap() {
  const canvasRef = useRef(null)
  const [field] = useState(generateField)
  const [hovered, setHovered] = useState(null)
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 })
  const [dronePos, setDronePos] = useState({ col: 0, row: 0 })
  const tRef = useRef(0)

  useEffect(() => {
    let raf
    const animate = () => {
      tRef.current += 0.018
      const t = tRef.current
      const col = Math.round(((Math.sin(t) * 0.5 + 0.5) * (FIELD_COLS - 2)) + 0.5)
      const row = Math.round(((Math.sin(t * 2) * 0.25 + 0.5) * (FIELD_ROWS - 2)) + 0.5)
      setDronePos({ col, row })
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const cellW = W / FIELD_COLS
    const cellH = H / FIELD_ROWS

    // Draw cells
    field.forEach(row => {
      row.forEach(cell => {
        ctx.fillStyle = healthColor(cell.health)
        ctx.fillRect(cell.x * cellW + 0.5, cell.y * cellH + 0.5, cellW - 1, cellH - 1)
      })
    })

    // Draw disease circles overlay
    const patches = [
      { cx: 5, cy: 4, r: 3, color: '#ff2020' },
      { cx: 20, cy: 10, r: 2.5, color: '#ff6020' },
      { cx: 8, cy: 13, r: 2, color: '#ff2020' },
      { cx: 24, cy: 6, r: 1.8, color: '#ffaa20' },
    ]
    patches.forEach(p => {
      const px = (p.cx + 0.5) * cellW
      const py = (p.cy + 0.5) * cellH
      const rx = p.r * cellW
      const ry = p.r * cellH

      ctx.strokeStyle = p.color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()

      // Dashed outer ring
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.ellipse(px, py, rx * 1.35, ry * 1.35, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    })

    // Draw drone marker
    const dx = (dronePos.col + 0.5) * cellW
    const dy = (dronePos.row + 0.5) * cellH

    ctx.globalAlpha = 1
    // Drone scan radius
    ctx.strokeStyle = 'rgba(57,255,20,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(dx, dy, cellW * 2.5, 0, Math.PI * 2)
    ctx.stroke()

    // Drone dot
    ctx.fillStyle = '#39ff14'
    ctx.beginPath()
    ctx.arc(dx, dy, 4, 0, Math.PI * 2)
    ctx.fill()

    // Cross hairs
    ctx.strokeStyle = '#39ff14'
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.moveTo(dx - 8, dy); ctx.lineTo(dx + 8, dy)
    ctx.moveTo(dx, dy - 8); ctx.lineTo(dx, dy + 8)
    ctx.stroke()

    // Grid lines
    ctx.globalAlpha = 0.06
    ctx.strokeStyle = '#39ff14'
    ctx.lineWidth = 0.5
    for (let c = 0; c <= FIELD_COLS; c++) {
      ctx.beginPath()
      ctx.moveTo(c * cellW, 0)
      ctx.lineTo(c * cellW, H)
      ctx.stroke()
    }
    for (let r = 0; r <= FIELD_ROWS; r++) {
      ctx.beginPath()
      ctx.moveTo(0, r * cellH)
      ctx.lineTo(W, r * cellH)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }, [field, dronePos])

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const col = Math.floor((mx / rect.width) * FIELD_COLS)
    const row = Math.floor((my / rect.height) * FIELD_ROWS)
    if (col >= 0 && col < FIELD_COLS && row >= 0 && row < FIELD_ROWS) {
      setHovered(field[row][col])
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto" id="field-map">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-px" style={{ background: '#39ff14' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Field Map</span>
        </div>
        <h2 className="font-display text-4xl font-700 tracking-wide" style={{ color: '#e8f5e8' }}>
          2D Crop Health Overview
        </h2>
        <p className="mt-2" style={{ color: '#6b9b6b', fontSize: '14px' }}>
          Top-down thermal health map — hover cells to inspect. Green dot tracks live drone position.
        </p>
      </div>

      <div className="agri-card p-1 relative overflow-hidden" style={{ border: '1px solid #1c3a1c' }}>
        {/* Canvas */}
        <div className="relative" style={{ height: '340px' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-full block rounded cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          />

          {/* Tooltip */}
          {hovered && (
            <div
              className="absolute pointer-events-none agri-card px-3 py-2 z-10"
              style={{
                left: Math.min(tooltip.x + 12, 300),
                top: Math.max(tooltip.y - 60, 4),
                minWidth: '160px',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: healthColor(hovered.health) }} />
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#e8f5e8', fontWeight: 600 }}>
                  {hovered.disease ?? 'Healthy'}
                </span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>
                Health: <span style={{ color: hovered.health > 0.6 ? '#39ff14' : '#ff3030' }}>{(hovered.health * 100).toFixed(1)}%</span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>
                Cell: ({hovered.x}, {hovered.y})
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #1c3a1c' }}>
          <div className="flex items-center gap-4">
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.06em' }}>HEALTH INDEX</span>
            <div className="flex items-center gap-1.5">
              {['#ff2020', '#ff6020', '#ffaa20', '#1a6a18', '#22a018'].map((c, i) => (
                <div key={i} className="w-5 h-2.5 rounded-sm" style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-4">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff2020' }}>Critical</span>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#22a018' }}>Healthy</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: '#39ff14', background: '#39ff14' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>Drone position</span>
          </div>
        </div>
      </div>
    </section>
  )
}