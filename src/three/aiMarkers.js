/**
 * AI detection → 3D farm marker mapping (Phase 3).
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────
 * The image scanner's YOLOv8 result carries NO GPS/telemetry — the backend
 * returns only class + confidence (+ bbox for future detection models).
 *
 * Preferred path (Phase 3): un-project detections through the drone's
 * NADIR PINHOLE CAMERA (src/three/droneCamera.js) so each marker lands
 * where the virtual camera was looking when the photo was captured —
 * deterministic and consistent with the flight path.
 *
 * Fallback path: the Phase 2 survey grid, an approximate deterministic
 * demo projection, used only when camera state cannot be derived.
 *
 * These are NOT real GPS/geospatial positions in either case and must
 * never be presented as such. When real drone telemetry becomes available,
 * replace only droneCamera.js / the mapping below — the controller API
 * (`setAiMarkers`) stays the same.
 * ────────────────────────────────────────────────────────────────────────
 */
import * as THREE from 'three'
import { SEVERITY_HEX } from './config'
import { computeNadirCameraState, projectImagePointToGround } from './droneCamera'

/** Fallback survey-grid constants (used only when no camera state exists). */
const AI_AREA_ORIGIN = { x: -12, z: 34 }
const GRID_COLS = 5
const CELL_W = 6
const CELL_D = 6
const MARKER_Y = 0.15

/** Marker geometry constants (Phase 3: pin at cap height, ring on ground). */
const PIN_CAP_Y = 1.6
const PIN_CAP_R = 0.55
const PIN_HEAD_R = 1.0
const PIN_HEAD_H = 1.0
const RING_R = 2
const RING_HALF_W = 0.3
const RING_SEGMENTS = 48
const APPEAR_DURATION = 1.0

/**
 * Map one detection to a 3D position.
 *
 * @param {object} detection normalised detection (bbox, label, confidence…)
 * @param {number} index index in the confidence-ordered detection list
 * @param {object|null} cameraState result of computeNadirCameraState() or null
 * @returns {{ position: THREE.Vector3, source: 'camera'|'grid' }}
 */
export function mapDetectionToPosition(detection, index, cameraState = null) {
  // Preferred: project the detection's image position through the drone's
  // nadir camera onto the ground plane.
  if (cameraState && Array.isArray(detection.bbox) && detection.bbox.length === 4) {
    const nx = (detection.bbox[0] + detection.bbox[2]) / 2
    const ny = (detection.bbox[1] + detection.bbox[3]) / 2
    const hit = projectImagePointToGround(nx, ny, cameraState)
    if (hit) return { position: hit, source: 'camera' }
  }

  // Fallback: Phase 2 survey grid (approximate deterministic demo layout).
  let col
  let row
  if (Array.isArray(detection.bbox) && detection.bbox.length === 4) {
    col = Math.min(GRID_COLS - 1, Math.max(0, Math.round(detection.bbox[0] * (GRID_COLS - 1))))
    row = Math.min(GRID_COLS - 1, Math.max(0, Math.round(detection.bbox[1] * (GRID_COLS - 1))))
  } else {
    col = index % GRID_COLS
    row = Math.floor(index / GRID_COLS)
  }
  return {
    position: new THREE.Vector3(
      AI_AREA_ORIGIN.x + col * CELL_W,
      MARKER_Y,
      AI_AREA_ORIGIN.z + row * CELL_D,
    ),
    source: 'grid',
  }
}

/** Create the persistent AI marker group (added to the scene once). */
export function createAiMarkerGroup() {
  return new THREE.Group()
}

/** Colour for a detection's severity tier (fallback: medium orange). */
function severityColor(severity) {
  return SEVERITY_HEX[severity] || SEVERITY_HEX.medium
}

/**
 * Build one AI marker: a vertical pin (cap + cone + ground ring) in the
 * project's disease-red visual language, with metadata on userData.
 * `appearT` starts at 0; the controller advances it for the appear animation.
 */
function buildAiMarker(detection, mapping) {
  const color = severityColor(detection.severity)
  const { position, source } = mapping

  const marker = new THREE.Group()
  marker.position.copy(position)
  marker.userData.aiMeta = {
    label: detection.label,
    className: detection.className,
    severity: detection.severity,
    confidence: detection.confidence,
    source,
    bbox: detection.bbox || null,
    position: position.clone(), // mapped farm-space location (virtual units)
  }
  marker.userData.appearT = 0

  // Cap: readable head of the pin at drone-scan altitude.
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(PIN_CAP_R, 16, 12),
    new THREE.MeshBasicMaterial({ color }),
  )
  cap.position.y = PIN_CAP_Y - position.y
  marker.add(cap)

  // Cone connecting cap to the ground point.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(PIN_HEAD_R, PIN_HEAD_H, 16, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
  )
  cone.rotation.x = Math.PI
  cone.scale.y = (PIN_CAP_Y - position.y - PIN_CAP_R) / PIN_HEAD_H
  cone.position.y = PIN_CAP_Y - position.y - PIN_CAP_R - cone.scale.y * PIN_HEAD_H / 2
  marker.add(cone)

  // Ground ring marking the mapped location.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(RING_R - RING_HALF_W, RING_R + RING_HALF_W, RING_SEGMENTS),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.02
  marker.add(ring)

  // Pulse ring — same userData contract / pulse clock as the demo zones.
  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(RING_R + 0.5, RING_R + 1.2, RING_SEGMENTS),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  )
  pulse.rotation.x = -Math.PI / 2
  pulse.position.y = 0.05
  pulse.userData.isPulse = true
  marker.add(pulse)

  return marker
}

/** Dispose a marker's geometries and materials, then detach it from the graph. */
function disposeMarker(marker) {
  marker.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach(m => m.dispose())
    }
  })
  if (marker.parent) marker.parent.remove(marker)
}

/**
 * Replace the AI marker group's contents with markers for `detections`.
 *
 * Full teardown-and-rebuild per scan: previous markers are disposed (no
 * leaking geometries/materials), duplicates are impossible by construction,
 * and a zero-length list simply empties the group (demo zones untouched —
 * they live in a separate group owned by the controller).
 *
 * Healthy classifications (`severity: 'healthy'`) are NOT drawn as farm
 * markers — markers mean "disease found here". Healthy results still appear
 * in the scanner's report panel.
 *
 * When `dronePosition` is given, detections are projected through the
 * drone's nadir camera (Phase 3); otherwise the survey-grid fallback applies.
 *
 * @param {THREE.Group} group persistent AI marker group (created once)
 * @param {Array} detections normalised detections from normalizePrediction()
 * @param {THREE.Vector3|null} dronePosition capture position of the scan
 */
export function rebuildAiMarkers(group, detections, dronePosition = null) {
  while (group.children.length > 0) disposeMarker(group.children[0])

  const cameraState = dronePosition ? computeNadirCameraState(dronePosition) : null
  const diseased = (Array.isArray(detections) ? detections : [])
    .filter(d => d && d.severity !== 'healthy')

  diseased.forEach((detection, index) => {
    const mapping = mapDetectionToPosition(detection, index, cameraState)
    const marker = buildAiMarker(detection, mapping)
    marker.userData.appearT = index * 0.15 // staggered, top-confidence first
    group.add(marker)
  })

  return { created: diseased.length, source: cameraState ? 'camera' : 'grid' }
}

/** Advance every marker's appear animation. tMs = milliseconds since rebuild. */
export function updateAppearAnimations(group, tMs) {
  const t = tMs / 1000
  group.children.forEach(marker => {
    const k = Math.min(1, Math.max(0, (t - marker.userData.appearT) / APPEAR_DURATION))
    if (k <= 0) { marker.visible = false; return }
    marker.visible = true
    const ease = 1 - Math.pow(1 - k, 3)
    marker.scale.setScalar(0.6 + 0.4 * ease)
    marker.traverse(obj => {
      if (obj.material && obj.material.transparent && typeof obj.material.opacity === 'number') {
        if (obj.userData.isPulse) return // pulse opacity is driven separately
        obj.material.opacity = (obj.userData.baseOpacity ??= obj.material.opacity) * ease
      }
    })
  })
}
