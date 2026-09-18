/**
 * Virtual drone camera → farm-ground projection (Phase 3).
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────
 * The detection pipeline is a CLASSIFIER over a photo taken by the virtual
 * drone; the backend provides no telemetry. To place disease markers in the
 * 3D farm consistently with the drone's flight, this module models the
 * drone's downward-looking camera as a NADIR PINHOLE CAMERA:
 *
 *   drone position (x, y, z)            camera centre
 *   optical axis         straight down (−Y)
 *   image (nx, ny)       normalised [0..1]², origin top-left
 *
 * A pixel is un-projected through the pinhole and intersected with the
 * ground plane y=0, yielding the farm location the camera was looking at.
 * The mapping is DETERMINISTIC (same drone position + pixel ⇒ same point)
 * and mathematically consistent with the flight path — but it is a VIRTUAL
 * camera model, NOT GPS and NOT geospatial ground truth. When real drone
 * telemetry becomes available, replace this file's model only; the marker
 * API (`setAiMarkers`) stays unchanged.
 * ────────────────────────────────────────────────────────────────────────
 */
import * as THREE from 'three'

/** Virtual camera constants (normalised sensor model). */
export const DRONE_CAM = {
  /** Sensor width in model units; height follows the aspect ratio. */
  sensorWidth: 1,
  /** Focal length in the same units (≈ 35° horizontal FOV with width 1). */
  focalLength: 1.1,
  /** Reference image size used by the capture pipeline (4:3). */
  imageWidth: 1280,
  imageHeight: 960,
  /** Ground intersections beyond this distance are rejected. */
  maxRayDistance: 60,
}

/**
 * Camera state for a drone position, nadir-pointing (optical axis −Y).
 * @param {THREE.Vector3} dronePosition current drone world position
 * @returns {{ position: THREE.Vector3, fovRad: number }}
 */
export function computeNadirCameraState(dronePosition) {
  const sensorHeight = DRONE_CAM.sensorWidth * (DRONE_CAM.imageHeight / DRONE_CAM.imageWidth)
  return {
    position: dronePosition.clone(),
    fovRad: 2 * Math.atan(sensorHeight / (2 * DRONE_CAM.focalLength)),
  }
}

/**
 * Un-project a normalised image point through the nadir pinhole and
 * intersect with the ground plane y=0.
 *
 * @param {number} nx image x, normalised 0..1 (0 = left edge)
 * @param {number} ny image y, normalised 0..1 (0 = top edge)
 * @param {{ position: THREE.Vector3 }} camState camera state
 * @returns {THREE.Vector3|null} ground point, or null when the ray never
 *   hits the ground (impossible geometry / out-of-range)
 */
export function projectImagePointToGround(nx, ny, camState) {
  if (!camState || !camState.position) return null
  if (![nx, ny].every(v => Number.isFinite(v))) return null

  // Pinhole model, gimbal-stabilised nadir frame: image axes world-aligned —
  // image left → −X, image right → +X, image top → −Z, image bottom → +Z.
  const px = (nx - 0.5) * DRONE_CAM.sensorWidth
  const py = (0.5 - ny) * DRONE_CAM.sensorWidth
  const dir = new THREE.Vector3(px / DRONE_CAM.focalLength, -1, -py / DRONE_CAM.focalLength)
  if (Math.abs(dir.y) < 1e-6) return null
  dir.normalize()

  // Ground plane y=0: t = -p.y / d.y must be a real distance below the
  // drone (rejects degenerate at-ground/under-ground poses) and in range.
  const t = -camState.position.y / dir.y
  if (t < 0.1 || t > DRONE_CAM.maxRayDistance) return null

  return camState.position.clone().addScaledVector(dir, t)
}
