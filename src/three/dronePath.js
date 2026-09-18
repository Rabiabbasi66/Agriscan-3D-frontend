/**
 * Virtual drone flight path.
 *
 * The controller only depends on this module to know where the drone is at a
 * given time t. Phase 2 will extend this file with waypoint / survey-grid
 * flight paths and a drone-camera target without touching the scene code.
 */
import * as THREE from 'three'

/**
 * Lissajous-style patrol path around the field centre.
 * @param {number} t flight time (advanced by the controller each frame)
 * @returns {THREE.Vector3} world-space drone position
 */
export function getDronePosition(t) {
  const scale = 22
  const x = Math.sin(t) * scale
  const z = Math.sin(t * 2) * scale * 0.5
  const y = 10 + Math.sin(t * 3) * 1.5
  return new THREE.Vector3(x, y, z)
}

/**
 * Phase 10: allocation-free variant used by the render loop. Writes the
 * patrol position into `out` instead of allocating a new Vector3 per frame
 * (the loop ran at ~60fps; the old path allocated one Vector3 each frame).
 * Same math as getDronePosition — the visual path is unchanged.
 * @param {number} t flight time
 * @param {THREE.Vector3} out target vector
 * @returns {THREE.Vector3} out
 */
export function getDronePositionInto(t, out) {
  const scale = 22
  out.set(
    Math.sin(t) * scale,
    10 + Math.sin(t * 3) * 1.5,
    Math.sin(t * 2) * scale * 0.5,
  )
  return out
}
