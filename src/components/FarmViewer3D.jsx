import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FarmSceneController from '../three/FarmSceneController'
import Minimap from './Minimap'
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
export default function FarmViewer3D({ detections = null, selectedDetectionId: selectedDetectionIdProp = null, onSelectionChange = null, scrollProgress = 0, flightPattern = 'lissajous', missionSpeed = null, missionRunning = null }) {
  const mountRef = useRef(null)
  const controllerRef = useRef(null)
  const [webgpu, setWebgpu] = useState(null)
  const [scanning, setScanning] = useState(true)
  const [droneSpeed, setDroneSpeed] = useState(0.004)
  const [selectedMeta, setSelectedMeta] = useState(null)
  const [selectedDetectionId, setSelectedDetectionId] = useState(null)
  const [mission, setMission] = useState(null)
  const [cameraMode, setCameraMode] = useState('overview')
  const [cameraModeLabel, setCameraModeLabel] = useState('FIELD VIEW')
  const [cameraModeIcon, setCameraModeIcon] = useState('🌐')
  const [autoRotate, setAutoRotate] = useState(false)
  const [heading, setHeading] = useState(0)
  const prevPosRef = useRef(null)

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
  const [webglError, setWebglError] = useState(false)
  useEffect(() => {
    setWebgpu('gpu' in navigator)
  }, [])

  // Honour OS-level reduced-motion preference for sway/pulse/wind effects.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => controllerRef.current?.setReducedMotion?.(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  // Create the scene controller once; dispose fully on unmount.
  useEffect(() => {
    if (!mountRef.current) return
    let controller
    try {
      controller = new FarmSceneController(mountRef.current)
    } catch (err) {
      console.error('WebGL scene failed to initialise:', err)
      setWebglError(true)
      return
    }
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

  useEffect(() => {
    controllerRef.current?.setFlightPattern?.(flightPattern)
  }, [flightPattern])

  useEffect(() => {
    if (missionSpeed != null) controllerRef.current?.setDroneSpeed(missionSpeed * 0.001)
  }, [missionSpeed])

  useEffect(() => {
    if (missionRunning != null) setScanning(missionRunning)
  }, [missionRunning])

  // Heading derived from real drone position deltas between mission ticks.
  useEffect(() => {
    const p = mission?.position
    if (!p) return
    const prev = prevPosRef.current
    if (prev) {
      const dx = p.x - prev.x
      const dz = p.z - prev.z
      if (dx * dx + dz * dz > 1e-8) {
        setHeading((Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360)
      }
    }
    prevPosRef.current = { x: p.x, z: p.z }
  }, [mission])

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

  if (webglError) {
    return (
      <div className="relative w-full h-full flex items-center justify-center" id="overview">
        <div className="agri-card p-8 text-center max-w-sm" role="alert">
          <div style={{ fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em', color: '#ff6020', textTransform: 'uppercase', marginBottom: 8 }}>
            WebGL unavailable
          </div>
          <div style={{ color: 'var(--foreground)', fontSize: '14px', marginBottom: 6 }}>
            The 3D farm view could not start on this device.
          </div>
          <div style={{ color: 'var(--muted-foreground)', fontSize: '12px' }}>
            Please try a recent desktop browser with hardware acceleration enabled. Upload, history and analytics still work.
          </div>
        </div>
      </div>
    )
  }

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
        <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden sm:block pointer-events-auto">
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
            HDG: <span style={{ color: 'var(--foreground)' }}>{heading.toFixed(0).padStart(3, '0')}°</span>
          </span>
        </div>
        <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden sm:block pointer-events-auto">
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
            SPD: <span style={{ color: 'var(--foreground)' }}>{(droneSpeed * 1000).toFixed(1)} m/s</span>
          </span>
        </div>
        {mission && (
          <>
            <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden md:block pointer-events-auto">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                BAT: <span style={{ color: mission.battery > 30 ? 'var(--foreground)' : '#ff6020' }}>{mission.battery.toFixed(0)}%</span>
              </span>
            </div>
            <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden md:block pointer-events-auto">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                T: <span style={{ color: 'var(--foreground)' }}>{Math.floor(mission.elapsed / 60)}:{String(Math.floor(mission.elapsed % 60)).padStart(2, '0')}</span>
              </span>
            </div>
            <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden md:block pointer-events-auto">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                CAPT: <span style={{ color: 'var(--foreground)' }}>{mission.captures}</span>
              </span>
            </div>
            <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden md:block pointer-events-auto">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                COV: <span style={{ color: 'var(--primary)' }}>{((mission.coverage || 0) * 100).toFixed(0)}%</span>
              </span>
            </div>
            <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden lg:block pointer-events-auto" title="Simulated wind strength">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                WND: <span style={{ color: 'var(--foreground)' }}>{(mission.wind ?? 0).toFixed(1)}</span>
              </span>
            </div>
            <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden lg:block pointer-events-auto">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
                LAP: <span style={{ color: 'var(--foreground)' }}>{(mission.loopProgress * 100).toFixed(0)}%</span>
              </span>
            </div>
            <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 hidden lg:block pointer-events-auto">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--primary)', letterSpacing: '0.06em' }}>
                {String(mission.pattern || 'lissajous').toUpperCase()}
              </span>
            </div>
            {mission.rtk && (
              <div className="glass-panel px-2.5 py-1 md:px-3 md:py-1.5 pointer-events-auto" style={{ borderColor: 'rgba(255,96,32,0.5)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff6020', letterSpacing: '0.06em' }}>
                  ⏏ RTK
                </span>
              </div>
            )}
          </>
        )}
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
      <div className="absolute top-[6.5rem] right-2 sm:top-14 sm:right-4 md:top-14 md:right-4 flex items-center gap-1.5 z-10">
        <div className="glass-panel p-1 flex items-center gap-1 md:gap-1.5 shadow-lg">
          <button
            onClick={() => {
              const modes = ['overview', 'drone', 'fpv', 'topdown']
              const labels = { overview: 'FIELD VIEW', drone: 'CHASE', fpv: 'DRONE CAM', topdown: 'TOP-DOWN' }
              const icons = { overview: '🌐', drone: '🎯', fpv: '📷', topdown: '⬇' }
              const next = modes[(modes.indexOf(cameraMode) + 1) % modes.length]
              setCameraMode(next)
              controllerRef.current?.setCameraMode(next)
              setCameraModeLabel(labels[next])
              setCameraModeIcon(icons[next])
            }}
            className="px-2 py-1 md:px-2.5 text-xs font-mono rounded transition-colors flex items-center gap-1"
            style={{
              background: cameraMode !== 'overview' ? 'rgba(57,255,20,0.18)' : 'transparent',
              color: cameraMode !== 'overview' ? 'var(--primary)' : 'var(--muted-foreground)',
              border: `1px solid ${cameraMode !== 'overview' ? 'var(--primary)' : 'transparent'}`,
            }}
            title="Cycle camera: field orbit → chase drone → drone camera → top-down map"
          >
            <span className="hidden sm:inline">{cameraModeIcon} {cameraModeLabel}</span>
            <span className="sm:hidden">{cameraModeIcon}</span>
          </button>
          <button
            onClick={() => {
              controllerRef.current?.resetCamera()
              setCameraMode('overview')
              setCameraModeLabel('FIELD VIEW')
              setCameraModeIcon('🌐')
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

      {/* Capture log: last simulated captures with virtual position/altitude */}
      {mission && mission.captureLog && mission.captureLog.length > 0 && (
        <div className="absolute bottom-28 left-2 md:bottom-32 md:left-4 glass-panel px-2.5 py-2 z-10 hidden sm:block" style={{ maxWidth: '210px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)', letterSpacing: '0.1em', marginBottom: 4 }}>
            CAPTURE LOG · SIM
          </div>
          {mission.captureLog.slice(-4).reverse().map((c, i) => (
            <div key={i} style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--foreground)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--primary)' }}>#{String(mission.captureLog.length - i).padStart(2, '0')}</span>
              {' '}t+{c.t}s · alt {c.alt}m · x{c.x} z{c.z}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Left Legend: Compact on mobile */}
      <div className="absolute bottom-3 left-2 md:bottom-4 md:left-4 flex flex-col gap-1 z-10">
        {[{ color: '#ff2020', label: 'High Severity' }, { color: '#ff6020', label: 'Medium' }, { color: '#ffaa20', label: 'Low Severity' }].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: item.color, background: item.color + '44' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)', letterSpacing: '0.05em' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom Right: mission minimap (above speed controls) */}
      <div className="absolute bottom-16 right-2 md:bottom-20 md:right-4 z-10 hidden sm:block">
        <Minimap getPosition={() => controllerRef.current?.getDroneLivePosition()} />
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
          {selectedMeta.severity && (
            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)' }}>
              TIER: <span style={{ color: selectedMeta.severity === 'high' ? '#ff3030' : selectedMeta.severity === 'medium' ? '#ff9020' : 'var(--primary)' }}>{String(selectedMeta.severity).toUpperCase()}</span>
            </div>
          )}
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)', marginTop: 4, opacity: 0.8 }}>
            virtual camera projection · not GPS · decision support only
          </div>
        </div>
      )}

      {/* Top Left Disease Zones Indicator */}
      <div className="absolute top-[7.5rem] left-2 sm:top-20 md:top-4 md:left-4 glass-panel p-2 md:p-2.5 max-w-36 md:max-w-44 z-10">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full animate-blink shrink-0" style={{ background: '#ff3030' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#ff3030', letterSpacing: '0.06em' }}>{diseaseCount} ZONES DETECTED</span>
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
