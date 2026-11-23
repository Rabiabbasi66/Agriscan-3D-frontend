import { useEffect, useRef } from 'react'

function neonGreen() {
  return getComputedStyle(document.documentElement).getPropertyValue('--neon-green').trim() || '#39ff14'
}

/**
 * Simulated 2D mission minimap. Draws the survey field boundary, a faint grid,
 * the flown-path trail and the live drone position (green dot, matching the
 * Field Map convention). Reads position via `getPosition()` each frame — no
 * React state churn.
 */
export default function Minimap({ getPosition, size = 104 }) {
  const canvasRef = useRef(null)
  const trailRef = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    let raf
    const draw = () => {
      ctx.clearRect(0, 0, size, size)

      // Field boundary: world coords span roughly [-28, 28] on both axes.
      const half = 28
      const toPx = (v) => ((v + half) / (half * 2)) * size

      // Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
      ctx.fillRect(0, 0, size, size)

      // Grid lines every 10 world units
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.08)'
      ctx.lineWidth = 1
      for (let g = -20; g <= 20; g += 10) {
        ctx.beginPath(); ctx.moveTo(toPx(g), 0); ctx.lineTo(toPx(g), size); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, toPx(g)); ctx.lineTo(size, toPx(g)); ctx.stroke()
      }

      // Field boundary
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)'
      ctx.lineWidth = 1.5
      ctx.strokeRect(toPx(-24), toPx(-24), toPx(24) - toPx(-24), toPx(24) - toPx(-24))

      // Drone position + trail
      const pos = getPosition?.()
      if (pos) {
        const px = toPx(pos.x)
        const py = toPx(pos.z)
        const trail = trailRef.current
        trail.push({ x: px, y: py })
        if (trail.length > 60) trail.shift()

        if (trail.length > 1) {
          ctx.strokeStyle = 'rgba(57, 255, 20, 0.5)'
          ctx.lineWidth = 1.2
          ctx.beginPath()
          trail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
          ctx.stroke()
        }

        // Drone dot with glow
        ctx.fillStyle = neonGreen()
        ctx.shadowColor = neonGreen()
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [getPosition, size])

  return (
    <div
      className="glass-panel p-1 pointer-events-none"
      title="Simulated mission minimap — drone position and flown path"
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, display: 'block', borderRadius: '4px' }}
        aria-label="Drone minimap"
      />
      <div style={{ fontFamily: 'monospace', fontSize: '8px', color: 'var(--muted-foreground)', textAlign: 'center', letterSpacing: '0.08em', marginTop: 2 }}>
        MINIMAP · SIM
      </div>
    </div>
  )
}
