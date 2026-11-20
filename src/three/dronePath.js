/**
 * Virtual drone flight path. The controller only asks this module where the
 * drone is at time t, so a waypoint route can replace the patrol without
 * touching the scene code.
 *
 * Supported patterns (thesis Mission Control): 'lissajous' (default patrol),
 * 'grid' (boustrophedon lawnmower), 'spiral' (expanding survey), 'crosshatch'
 * (diagonal passes). Each returns a closed loop over tt in [0,1).
 */
import * as THREE from 'three'

const ALT = 10
const BOB = (t) => Math.sin(t * 3) * 1.2

/**
 * Lissajous patrol around the field centre (original behaviour).
 * @param {number} t flight time
 * @param {THREE.Vector3} out target vector
 * @returns {THREE.Vector3} out
 */
export function getDronePositionInto(t, out) {
  const scale = 22
  return out.set(
    Math.sin(t) * scale,
    ALT + Math.sin(t * 3) * 1.5,
    Math.sin(t * 2) * scale * 0.5,
  )
}

/**
 * Pattern-based survey path. `t` advances continuously; the path loops with
 * period 2π like the original patrol.
 * @param {number} t flight time
 * @param {THREE.Vector3} out target vector
 * @param {string} pattern 'lissajous' | 'grid' | 'spiral' | 'crosshatch'
 * @returns {THREE.Vector3} out
 */
export function getDronePositionForPattern(t, out, pattern = 'lissajous') {
  const period = Math.PI * 2
  const tt = (((t % period) + period) % period) / period // 0..1 loop position

  switch (pattern) {
    case 'grid': {
      // Boustrophedon lawnmower: 6 rows, alternating sweep direction.
      const rows = 6
      const rowFloat = tt * rows
      const row = Math.floor(rowFloat)
      const f = rowFloat - row
      const dir = row % 2 === 0 ? 1 : -1
      out.set(
        dir * (f * 2 - 1) * 22,
        ALT + BOB(t),
        -22 + (row / (rows - 1)) * 44,
      )
      return out
    }
    case 'spiral': {
      // Archimedean survey spiral expanding to the field edge.
      const maxR = 24
      const turns = 3
      const ang = tt * turns * Math.PI * 2
      const r = tt * maxR
      out.set(Math.cos(ang) * r, ALT + BOB(t), Math.sin(ang) * r)
      return out
    }
    case 'crosshatch': {
      // Diagonal passes alternating slope direction each lane.
      const passes = 8
      const pf = tt * passes
      const p = Math.floor(pf)
      const f = pf - p
      const x = (f * 2 - 1) * 24
      const zCenter = -20 + ((p % passes) / (passes - 1)) * 40
      const slope = p % 2 === 0 ? 1 : -1
      out.set(x, ALT + BOB(t), THREE.MathUtils.clamp(zCenter + x * 0.45 * slope, -26, 26))
      return out
    }
    default:
      return getDronePositionInto(t, out)
  }
}
