/**
 * Shared configuration for the AgriScan 3D farm scene.
 *
 * Single source of truth for the disease marker data and severity colours.
 * The 3D field markers and the HUD overlay both read from here so they can
 * never drift apart. (Phase 2: real AI detections will feed the same shapes.)
 */

/** Size of the square ground plane in world units. */
export const FIELD_SIZE = 120

/**
 * Demo disease zones currently visualised in the field.
 * x/z are world coordinates on the ground plane, radius in world units.
 */
export const DISEASE_ZONES = [
  { x: -18, z: -12, radius: 6, label: 'Leaf Blight', severity: 'high' },
  { x: 22, z: 8, radius: 4.5, label: 'Powdery Mildew', severity: 'medium' },
  { x: 5, z: 20, radius: 5, label: 'Root Rot', severity: 'high' },
  { x: -8, z: 16, radius: 3.5, label: 'Rust', severity: 'low' },
]

/** Material colours (hex numbers) per severity — used by the 3D markers. */
export const SEVERITY_HEX = {
  high: 0xff2020,
  medium: 0xff6020,
  low: 0xffaa20,
}

/** Flight constants for the virtual drone (unchanged from Phase 1 baseline). */
export const DRONE = {
  /** Initial spawn height. */
  spawnY: 12,
  /** Vertical offset of the drone's downward spotlight below the body. */
  lightOffsetY: -3,
  /** Per-frame rotation increment applied to each rotor while scanning. */
  rotorSpinActive: 0.5,
  /** Per-frame rotor spin while paused (slow idle). */
  rotorSpinIdle: 0.05,
}
