/**
 * Virtual drone flight path. The controller only asks this module where the
 * drone is at time t, so a waypoint route can replace the patrol without
 * touching the scene code.
 */
import * as THREE from 'three'

/**
 * Lissajous patrol around the field centre, written into `out` to keep the
 * render loop allocation-free.
 * @param {number} t flight time (advanced by the controller each frame)
 * @param {THREE.Vector3} out target vector
 * @returns {THREE.Vector3} out
 */
export function getDronePositionInto(t, out) {
  const scale = 22
  return out.set(
    Math.sin(t) * scale,
    10 + Math.sin(t * 3) * 1.5,
    Math.sin(t * 2) * scale * 0.5,
  )
}
