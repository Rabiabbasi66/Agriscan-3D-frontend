import React, { useCallback, useEffect, useRef, useState } from 'react'
import FarmSceneController from '../three/FarmSceneController'
import { DISEASE_ZONES } from '../three/config'

/** Format a world position for the marker info readout (virtual units). */
const formatPosition = (p) => `x ${p.x.toFixed(1)} · z ${p.z.toFixed(1)}`

/**
 * FarmViewer3D — React shell around the Three.js farm scene.
 *
 * All WebGL/scene logic lives in src/three/ (FarmSceneController + builders);
 * this component only owns the mount node, the WebGPU capability badge and
 * the HUD overlay. Visual output and all HUD text are unchanged.
 *
 * Phase 2: accepts an optional `detections` prop (normalised AI scan result,
 * see normalizePrediction() in src/services/api.js). When present, each
 * detection becomes a marker in the 3D farm; when absent/empty the existing
 * demo disease zones remain as the fallback visualisation.
 */
export default function FarmViewer3D({ detections = null, selectedDetectionId: selectedDetectionIdProp = null, onSelectionChange = null, capturing = false }) {
  const mountRef = useRef(null)
  const controllerRef = useRef(null)
  const [webgpu, setWebgpu] = useState(null)
  const [scanning, setScanning] = useState(true)
  const [droneSpeed, setDroneSpeed] = useState(0.004)
  // Phase 3: metadata of the currently selected AI marker (or null).
  const [selectedMeta, setSelectedMeta] = useState(null)
  // Phase 7: id of the detection whose marker is highlighted (list ↔ scene).
  const [selectedDetectionId, setSelectedDetectionId] = useState(null)
  // Phase 8: live mission readout (altitude/loop position from the real
  // drone mesh state; sampled on the existing animation clock — no new loop).
  const [mission, setMission] = useState(null)

  // Click-to-inspect: raycast to the ground, snap to the nearest AI marker.
  const handleCanvasClick = useCallback((event) => {
    const controller = controllerRef.current
    if (!controller) return
    const idx = controller.findNearestMarker(controller.pickGroundPoint(event))
    const meta = idx === null ? null : controller.aiMarkerGroup.children[idx]?.userData.aiMeta || null
    setSelectedMeta(meta)
    // Keep the list↔scene selection in sync (Phase 7), upward as well so
    // the scanner report highlights the same row.
    const id = meta ? meta.detectionId ?? null : null
    setSelectedDetectionId(id)
    if (typeof onSelectionChange === 'function') onSelectionChange(id)
  }, [onSelectionChange])

  /**
   * Phase 7: focus + highlight the marker for a detection id (list → scene).
   * Selection only exists when a real association exists — unknown ids are
   * ignored and null clears the highlight.
   */
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

  // Phase 7: external selection (e.g. Prediction History) drives focus.
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

    // Phase 3: marker inspection clicks on the canvas.
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

  // Phase 8: sample the controller's real mission state on a slow cadence
  // (250 ms) — HUD-only updates, never a scene rebuild.
  useEffect(() => {
    const id = setInterval(() => {
      const controller = controllerRef.current
      if (controller) setMission(controller.getMissionState())
    }, 250)
    return () => clearInterval(id)
  }, [])

  // Phase 2: AI scan detections → 3D markers. The controller rebuilds and
  // disposes its AI marker group; an empty list clears AI markers so the
  // demo disease zones remain the fallback visualisation.
  useEffect(() => {
    if (controllerRef.current) {
      // Phase 3: project through the drone's nadir camera at the live
      // position; aiMarkers falls back to the survey grid without one.
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

      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="agri-card px-3 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-blink" style={{ background: scanning ? '#39ff14' : '#666' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.1em' }}>
            {scanning ? 'SCANNING ACTIVE' : 'PAUSED'}
          </span>
        </div>
        <div className="agri-card px-3 py-1.5">
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6b9b6b', letterSpacing: '0.08em' }}>
            ALT: <span style={{ color: '#e8f5e8' }}>{mission ? `${mission.altitude.toFixed(1)}m` : '10.2m'}</span>
          </span>
        </div>
        {capturing && (
          <div className="agri-card px-3 py-1.5">
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.08em' }}>
              CAPTURING
            </span>
          </div>
        )}
        {(detections || []).filter(d => d.severity !== 'healthy').length > 0 && (
          <div className="agri-card px-3 py-1.5">
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.08em' }}>
              {(detections || []).filter(d => d.severity !== 'healthy').length} DISEASE MAPPED
            </span>
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4">
        <div className="agri-card px-2.5 py-1 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: webgpu ? '#39ff14' : '#6b9b6b' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: webgpu ? '#39ff14' : '#6b9b6b', letterSpacing: '0.08em' }}>
            {webgpu === null ? 'DETECTING...' : webgpu ? 'WEBGPU ON' : 'WEBGL MODE'}
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
        {[{ color: '#ff2020', label: 'High Severity' }, { color: '#ff6020', label: 'Medium' }, { color: '#ffaa20', label: 'Low Severity' }].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: item.color, background: item.color + '33' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.06em' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-3">
        <button
          onClick={() => setScanning(s => !s)}
          className="agri-card px-3 py-1.5 text-xs font-semibold transition-all duration-200"
          style={{ fontFamily: 'sans-serif', letterSpacing: '0.08em', color: scanning ? '#39ff14' : '#6b9b6b', fontSize: '12px' }}
        >
          {scanning ? '⏸ PAUSE' : '▶ RESUME'}
        </button>
        <div className="agri-card px-3 py-1.5 flex items-center gap-2">
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>SPEED</span>
          <input
            type="range"
            min={0.001}
            max={0.012}
            step={0.001}
            value={droneSpeed}
            onChange={e => setDroneSpeed(Number(e.target.value))}
            className="w-20 accent-green-400"
            style={{ accentColor: '#39ff14' }}
          />
        </div>
      </div>

      {selectedMeta && (
        <div className="absolute top-20 left-4 agri-card p-3 max-w-52" style={{ borderColor: 'rgba(255,32,32,0.4)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full animate-blink" style={{ background: '#ff3030' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff3030', letterSpacing: '0.08em' }}>
              DISEASE DETECTED
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#e8f5e8', marginBottom: 2 }}>
            {String(selectedMeta.label || 'Unknown').replace(/_/g, ' ')}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>
            CONF: <span style={{ color: '#39ff14' }}>{((selectedMeta.confidence || 0) * 100).toFixed(1)}%</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>
            POS: <span style={{ color: '#e8f5e8' }}>{selectedMeta.position ? formatPosition(selectedMeta.position) : '—'}</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#6b9b6b', marginTop: 4, opacity: 0.8 }}>
            virtual camera projection · not GPS
          </div>
        </div>
      )}

      <div className="absolute top-4 left-4 agri-card p-3 max-w-44">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full animate-blink" style={{ background: '#ff3030' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff3030', letterSpacing: '0.08em' }}>4 ZONES DETECTED</span>
        </div>
        {DISEASE_ZONES.slice(0, 2).map(z => (
          <div key={z.label} className="flex items-center justify-between mt-1">
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>{z.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: z.severity === 'high' ? '#ff2020' : '#ff6020', letterSpacing: '0.05em' }}>{z.severity.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
