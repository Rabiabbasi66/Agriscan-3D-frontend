import React, { useEffect, useRef, useState } from 'react'

/**
 * Vegetation greenness heatmap computed client-side from the uploaded RGB
 * image using the Excess Green index (ExG = 2G - R - B). This is an RGB
 * approximation of vegetation health — true NDVI requires a near-infrared
 * band that consumer images do not have. The mean ExG is reported so it can
 * be cited in the thesis results section.
 */
export default function GreennessHeatmap({ src }) {
  const canvasRef = useRef(null)
  const [mean, setMean] = useState(null)

  useEffect(() => {
    if (!src || !canvasRef.current) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const W = 256
      const H = Math.max(1, Math.round((W * img.height) / img.width))
      const c = canvasRef.current
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, W, H)
      const d = ctx.getImageData(0, 0, W, H)
      const px = d.data
      let sum = 0
      let n = 0
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i] / 255
        const g = px[i + 1] / 255
        const b = px[i + 2] / 255
        const exg = 2 * g - r - b // Excess Green, range ~[-1, 1]
        sum += exg
        n++
        // map [-0.3, 0.5] -> red..yellow..green
        const t = Math.min(1, Math.max(0, (exg + 0.3) / 0.8))
        let R, G, B
        if (t < 0.5) {
          const u = t * 2
          R = 1; G = u; B = 0.15
        } else {
          const u = (t - 0.5) * 2
          R = 1 - u; G = 1; B = 0.15
        }
        px[i] = R * 255
        px[i + 1] = G * 255
        px[i + 2] = B * 255
        px[i + 3] = 255
      }
      ctx.putImageData(d, 0, 0)
      setMean(sum / n)
    }
    img.src = src
    return () => { cancelled = true }
  }, [src])

  if (!src) return null
  return (
    <div className="agri-card p-4 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Vegetation Greenness Index (ExG)
        </span>
        {mean != null && (
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14' }}>
            mean {mean.toFixed(3)}
          </span>
        )}
      </div>
      <canvas ref={canvasRef} className="w-full h-auto block rounded" style={{ border: '1px solid var(--border)' }} />
      <div className="flex items-center gap-2 mt-2">
        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)' }}>low</span>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(90deg,#ff3333,#ffcc33,#39ff14)' }} />
        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)' }}>high</span>
      </div>
      <p style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)', marginTop: 6, lineHeight: 1.5 }}>
        RGB-based greenness approximation — true NDVI needs near-infrared imaging.
      </p>
    </div>
  )
}
