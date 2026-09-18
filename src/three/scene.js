/**
 * Scene graph builders for the AgriScan 3D farm viewer.
 *
 * Responsibilities are split so the Phase 2 drone system can reuse or extend
 * each layer independently (e.g. adding flight-path markers next to crops, or
 * a drone camera rig next to the drone body). The produced scene is visually
 * identical to the previous single-file implementation.
 */
import * as THREE from 'three'
import { DISEASE_ZONES, SEVERITY_HEX, FIELD_SIZE } from './config'

/**
 * Scene, atmosphere and lighting.
 * @returns {{ scene: THREE.Scene, droneLight: THREE.PointLight }}
 */
export function createScene() {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x060d06, 0.018)
  scene.background = new THREE.Color(0x060d06)

  scene.add(new THREE.AmbientLight(0x224422, 0.8))
  const sun = new THREE.DirectionalLight(0x88ff66, 1.2)
  sun.position.set(30, 50, 20)
  sun.castShadow = true
  scene.add(sun)

  const droneLight = new THREE.PointLight(0x39ff14, 1.5, 30)
  droneLight.position.set(0, 8, 0)
  scene.add(droneLight)

  return { scene, droneLight }
}

/**
 * Ground plane + reference grid.
 * @returns {{ ground: THREE.Mesh, grid: THREE.GridHelper }}
 */
export function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE, 60, 60),
    new THREE.MeshLambertMaterial({ color: 0x0a1a0a, wireframe: false })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true

  const grid = new THREE.GridHelper(FIELD_SIZE, 30, 0x1a3a1a, 0x112211)
  grid.position.y = 0.02

  return { ground, grid }
}

/**
 * Crop field stalk rows built from two shared geometries/materials.
 * @returns {THREE.Group}
 */
export function createCrops() {
  const cropGroup = new THREE.Group()
  const stalkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6)
  const stalkMat = new THREE.MeshLambertMaterial({ color: 0x1a6a18 })
  const stalkMatHealthy = new THREE.MeshLambertMaterial({ color: 0x22a018 })

  for (let row = -25; row <= 25; row += 3) {
    for (let col = -25; col <= 25; col += 2) {
      const isHealthy = Math.random() > 0.15
      const stalk = new THREE.Mesh(stalkGeo, isHealthy ? stalkMatHealthy : stalkMat)
      stalk.position.set(
        col + (Math.random() - 0.5) * 0.4,
        0.7,
        row + (Math.random() - 0.5) * 0.4
      )
      stalk.rotation.y = Math.random() * Math.PI
      cropGroup.add(stalk)
    }
  }

  return cropGroup
}

/**
 * Disease zone markers: border ring, translucent fill and animated pulse ring.
 * Pulse rings carry `userData.isPulse` / `userData.baseRadius`, which the
 * controller animates each frame (same behaviour as the original code).
 * @returns {THREE.Group}
 */
export function createDiseaseZones() {
  const diseaseGroup = new THREE.Group()

  DISEASE_ZONES.forEach(zone => {
    const color = SEVERITY_HEX[zone.severity]

    const ringGeo = new THREE.RingGeometry(zone.radius - 0.3, zone.radius + 0.3, 48)
    const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(zone.x, 0.15, zone.z)
    diseaseGroup.add(ring)

    const fillGeo = new THREE.CircleGeometry(zone.radius - 0.3, 48)
    const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
    const fill = new THREE.Mesh(fillGeo, fillMat)
    fill.rotation.x = -Math.PI / 2
    fill.position.set(zone.x, 0.1, zone.z)
    diseaseGroup.add(fill)

    const pulseGeo = new THREE.RingGeometry(zone.radius + 0.5, zone.radius + 1.2, 48)
    const pulseMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    const pulse = new THREE.Mesh(pulseGeo, pulseMat)
    pulse.rotation.x = -Math.PI / 2
    pulse.position.set(zone.x, 0.2, zone.z)
    pulse.userData.isPulse = true
    pulse.userData.baseRadius = zone.radius
    diseaseGroup.add(pulse)
  })

  return diseaseGroup
}

