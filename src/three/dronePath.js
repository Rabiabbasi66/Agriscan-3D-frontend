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
