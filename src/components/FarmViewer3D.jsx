import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FarmSceneController from '../three/FarmSceneController'
import { DISEASE_ZONES } from '../three/config'

/** Format a world position for the marker info readout (virtual units). */
const formatPosition = (p) => `x ${p.x.toFixed(1)} · z ${p.z.toFixed(1)}`

/**
 * React shell around the Three.js farm scene. All WebGL work lives in
 * src/three/; this component owns the mount node, the capability badge and the
 * HUD overlay.
 *
 * `detections` (normalised AI scan results) become 3D markers; without them the
 * demo disease zones remain as the fallback visualisation.
 */
export default function FarmViewer3D({ detections = null, selectedDetectionId: selectedDetectionIdProp = null, onSelectionChange = null, scrollProgress = 0 }) {
  const mountRef = useRef(null)
  const controllerRef = useRef(null)
  const [webgpu, setWebgpu] = useState(null)
  const [scanning, setScanning] = useState(true)
  const [droneSpeed, setDroneSpeed] = useState(0.004)
  const [selectedMeta, setSelectedMeta] = useState(null)
  const [selectedDetectionId, setSelectedDetectionId] = useState(null)
  const [mission, setMission] = useState(null)
  const [cameraMode, setCameraMode] = useState('overview')
  const [autoRotate, setAutoRotate] = useState(false)

  // Computed once per detections change: the HUD reads it in several places and
  // re-renders on every mission tick.
  const diseaseCount = useMemo(
    () => (detections || []).filter(d => d.severity !== 'healthy').length,
    [detections],
  )

  // Click-to-inspect: raycast to the ground, snap to the nearest AI marker.
  const handleCanvasClick = useCallback((event) => {
    const controller = controllerRef.current
    if (!controller) return
    const idx = controller.findNearestMarker(controller.pickGroundPoint(event))
    const meta = idx === null ? null : controller.aiMarkerGroup.children[idx]?.userData.aiMeta || null
    setSelectedMeta(meta)
    // Propagate upward so the scanner report highlights the same row.
    const id = meta ? meta.detectionId ?? null : null
    setSelectedDetectionId(id)
    if (typeof onSelectionChange === 'function') onSelectionChange(id)
  }, [onSelectionChange])

  /** Focus + highlight the marker for a detection id (list → scene). */
  const focusAiMarker = useCallback((detectionId) => {
    const controller = controllerRef.current
    if (!controller) return
    const matched = controller.highlightAiMarker(detectionId)
    if (matched) {
      setSelectedDetectionId(detectionId)
      const marker = controller.aiMarkerGroup.children.find(
        m => m.userData.aiMeta && m.userData.aiMeta.detectionId === detectionId,
      )
      setSelectedMeta(marker ? marker.userData.aiMeta : null)
    } else {
      setSelectedDetectionId(null)
      setSelectedMeta(null)
    }
  }, [])

  // Clear the highlight when the marker set is replaced by a new scan.
  useEffect(() => {
    setSelectedDetectionId(null)
    setSelectedMeta(null)
  }, [detections])

  // External selection (e.g. Prediction History) drives focus.
  useEffect(() => {
    if (selectedDetectionIdProp !== null) {
      focusAiMarker(selectedDetectionIdProp)
    }
  }, [selectedDetectionIdProp, focusAiMarker])

  // WebGPU capability badge (informational — renderer is WebGL).
  useEffect(() => {
    setWebgpu('gpu' in navigator)
  }, [])

  // Create the scene controller once; dispose fully on unmount.
  useEffect(() => {
    if (!mountRef.current) return
    const controller = new FarmSceneController(mountRef.current)
    controllerRef.current = controller

    controller.container.addEventListener('click', handleCanvasClick)

    return () => {
      controller.container.removeEventListener('click', handleCanvasClick)
      controller.dispose()
      controllerRef.current = null
    }
  }, [handleCanvasClick])

  // Mirror UI state into the controller without re-creating the scene.
  useEffect(() => {
    controllerRef.current?.setScanning(scanning)
  }, [scanning])

  useEffect(() => {
    controllerRef.current?.setDroneSpeed(droneSpeed)
  }, [droneSpeed])

  useEffect(() => {
    controllerRef.current?.setScrollProgress(scrollProgress)
  }, [scrollProgress])

  // HUD-only mission sampling at 4 Hz, never a scene rebuild. ALT renders to
  // one decimal place, so a tick that would not change that text (paused, or a
  // sub-0.05 m change) returns the previous state and React skips the render.
  useEffect(() => {
    const id = setInterval(() => {
      const controller = controllerRef.current
      if (!controller) return
      const next = controller.getMissionState()
      setMission(prev => (
        prev
        && prev.scanning === next.scanning
        && Math.abs(prev.altitude - next.altitude) < 0.05
          ? prev
          : next
      ))
    }, 250)
    return () => clearInterval(id)
  }, [])

  // Detections → 3D markers. The controller disposes and rebuilds its marker
  // group; an empty list clears AI markers so the demo zones stay visible.
  useEffect(() => {
    if (controllerRef.current) {
      // Projected through the drone's nadir camera; aiMarkers falls back to
      // the survey grid without a position.
      const pos = controllerRef.current.getDroneLivePosition()
      controllerRef.current.setAiMarkers(detections || [], pos)
      setSelectedMeta(null)
    }
  }, [detections])

  return (
    <div className="relative w-full h-full" id="overview">
      <div ref={mountRef} className="w-full h-full" />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,255,20,0.012) 2px, rgba(57,255,20,0.012) 4px)',
        }}
      />

      {[['top-3 left-3', 'border-t border-l'], ['top-3 right-3', 'border-t border-r'], ['bottom-3 left-3', 'border-b border-l'], ['bottom-3 right-3', 'border-b border-r']].map(([pos, brd], i) => (
        <div key={i} className={`absolute ${pos} w-8 h-8 ${brd} pointer-events-none`} style={{ borderColor: '#39ff14', opacity: 0.6 }} />
      ))}

      {/* Top Status Bar: Responsive Flex */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:gap-3 flex-wrap justify-center px-2 pointer-events-none z-10">
        <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full animate-blink shrink-0" style={{ background: scanning ? 'var(--primary)' : '#666' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--primary)', letterSpacing: '0.08em' }}>
            {scanning ? 'SCANNING ACTIVE' : 'PAUSED'}
          </span>
        </div>
        <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 pointer-events-auto">
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
            ALT: <span style={{ color: 'var(--foreground)' }}>{mission ? `${mission.altitude.toFixed(1)}m` : '10.2m'}</span>
          </span>
        </div>
        {diseaseCount > 0 && (
          <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden sm:flex items-center pointer-events-auto">
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--primary)', letterSpacing: '0.06em' }}>
              {diseaseCount} DISEASE MAPPED
            </span>
          </div>
        )}
      </div>

      {/* Top Right: WebGPU capability */}
      <div className="absolute top-3 right-2 md:right-4 z-10">
        <div className="glass-panel px-2 py-1 md:px-2.5 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: webgpu ? 'var(--primary)' : 'var(--muted-foreground)' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: webgpu ? 'var(--primary)' : 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
            {webgpu === null ? 'DETECTING...' : webgpu ? 'WEBGPU' : 'WEBGL'}
          </span>
        </div>
      </div>

      {/* 3D Camera & View Controls: Responsive Glass Toolbar */}
      <div className="absolute top-12 right-2 md:top-14 md:right-4 flex items-center gap-1.5 z-10">
        <div className="glass-panel p-1 flex items-center gap-1 md:gap-1.5 shadow-lg">
          <button
            onClick={() => {
              const next = cameraMode === 'overview' ? 'drone' : 'overview'
              setCameraMode(next)
              controllerRef.current?.setCameraMode(next)
            }}
            className="px-2 py-1 md:px-2.5 text-xs font-mono rounded transition-colors flex items-center gap-1"
            style={{
              background: cameraMode === 'drone' ? 'rgba(57,255,20,0.18)' : 'transparent',
              color: cameraMode === 'drone' ? 'var(--primary)' : 'var(--muted-foreground)',
              border: `1px solid ${cameraMode === 'drone' ? 'var(--primary)' : 'transparent'}`,
            }}
            title="Toggle between field overview and tracking the drone"
          >
            <span className="hidden sm:inline">{cameraMode === 'drone' ? '🎯 TRACK DRONE' : '🌐 FIELD VIEW'}</span>
            <span className="sm:hidden">{cameraMode === 'drone' ? '🎯' : '🌐'}</span>
          </button>
          <button
            onClick={() => {
              controllerRef.current?.resetCamera()
              setCameraMode('overview')
            }}
            className="px-1.5 py-1 md:px-2 text-xs font-mono rounded border border-transparent hover:border-green-500/30 transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            title="Reset camera angle to default overview"
          >
            <span className="hidden sm:inline">↺ RESET</span>
            <span className="sm:hidden">↺</span>
          </button>
          <button
            onClick={() => {
              const active = controllerRef.current?.toggleAutoRotate()
              setAutoRotate(!!active)
            }}
            className="px-1.5 py-1 md:px-2 text-xs font-mono rounded transition-colors"
            style={{
              color: autoRotate ? 'var(--primary)' : 'var(--muted-foreground)',
              border: `1px solid ${autoRotate ? 'var(--primary)' : 'transparent'}`,
            }}
            title="Toggle subtle cinematic auto-rotation"
          >
            <span className="hidden sm:inline">↻ AUTO</span>
            <span className="sm:hidden">↻</span>
          </button>
        </div>
      </div>

      {/* OrbitControls Hint: Hidden on mobile touchscreens */}
      <div className="hidden sm:block absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none opacity-60 z-10">
        <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
          🖱️ Rotate: Drag · Zoom: Scroll · Pan: Right-Click
        </span>
      </div>

      {/* Bottom Left Legend: Compact on mobile */}
      <div className="absolute bottom-3 left-2 md:bottom-4 md:left-4 flex flex-col gap-1 z-10">
        {[{ color: '#ff2020', label: 'High Severity' }, { color: '#ff6020', label: 'Medium' }, { color: '#ffaa20', label: 'Low Severity' }].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: item.color, background: item.color + '44' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom Right Controls: Speed Slider & Pause */}
      <div className="absolute bottom-3 right-2 md:bottom-4 md:right-4 flex items-center gap-2 z-10">
        <button
          onClick={() => setScanning(s => !s)}
          className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 text-xs font-semibold transition-all duration-200"
          style={{ fontFamily: 'sans-serif', letterSpacing: '0.06em', color: scanning ? 'var(--primary)' : 'var(--muted-foreground)' }}
        >
          {scanning ? '⏸ PAUSE' : '▶ RESUME'}
        </button>
        <div className="glass-panel px-2 py-1 md:px-2.5 md:py-1.5 flex items-center gap-1.5">
          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)' }}>SPD</span>
          <input
            type="range"
            min={0.001}
            max={0.012}
            step={0.001}
            value={droneSpeed}
            onChange={e => setDroneSpeed(Number(e.target.value))}
            className="w-14 md:w-20 accent-green-400"
            style={{ accentColor: 'var(--primary)' }}
          />
        </div>
      </div>

      {selectedMeta && (
        <div className="absolute top-16 left-2 md:top-20 md:left-4 glass-panel p-2.5 md:p-3 max-w-48 md:max-w-56 z-10" style={{ borderColor: 'rgba(255,32,32,0.4)' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2 h-2 rounded-full animate-blink shrink-0" style={{ background: '#ff3030' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff3030', letterSpacing: '0.08em' }}>
              DISEASE DETECTED
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--foreground)', marginBottom: 2 }}>
            {String(selectedMeta.label || 'Unknown').replace(/_/g, ' ')}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)' }}>
            CONF: <span style={{ color: 'var(--primary)' }}>{((selectedMeta.confidence || 0) * 100).toFixed(1)}%</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)' }}>
            POS: <span style={{ color: 'var(--foreground)' }}>{selectedMeta.position ? formatPosition(selectedMeta.position) : '—'}</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)', marginTop: 4, opacity: 0.8 }}>
            virtual camera projection · not GPS
          </div>
        </div>
      )}

      {/* Top Left Disease Zones Indicator */}
      <div className="absolute top-16 left-2 md:top-4 md:left-4 glass-panel p-2 md:p-2.5 max-w-36 md:max-w-44 z-10">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full animate-blink shrink-0" style={{ background: '#ff3030' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#ff3030', letterSpacing: '0.06em' }}>4 ZONES DETECTED</span>
        </div>
        {DISEASE_ZONES.slice(0, 2).map(z => (
          <div key={z.label} className="flex items-center justify-between mt-0.5">
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)' }}>{z.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: z.severity === 'high' ? '#ff2020' : '#ff6020', letterSpacing: '0.04em' }}>{z.severity.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
