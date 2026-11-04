/**
 * Shared configuration for the 3D farm scene: the demo disease zones, the
 * severity palette and the drone flight constants. The scene builders and the
 * HUD both read from here so they cannot drift apart.
 */

/** Size of the square ground plane in world units. */
export const FIELD_SIZE = 120

/**
 * Demo disease zones shown when no AI scan is active.
 * x/z are world coordinates on the ground plane, radius in world units.
 */
export const DISEASE_ZONES = [
  { x: -18, z: -12, radius: 6, label: 'Leaf Blight', severity: 'high' },
  { x: 22, z: 8, radius: 4.5, label: 'Powdery Mildew', severity: 'medium' },
  { x: 5, z: 20, radius: 5, label: 'Root Rot', severity: 'high' },
  { x: -8, z: 16, radius: 3.5, label: 'Rust', severity: 'low' },
]

/** Material colours (hex numbers) per severity, used by the 3D markers. */
export const SEVERITY_HEX = {
  high: 0xff2020,
  medium: 0xff6020,
  low: 0xffaa20,
}

export const DRONE = {
  /** Vertical offset of the drone's downward spotlight below the body. */
  lightOffsetY: -3,
  /** Per-frame rotor spin while scanning. */
  rotorSpinActive: 0.5,
  /** Per-frame rotor spin while paused (slow idle). */
  rotorSpinIdle: 0.05,
}
