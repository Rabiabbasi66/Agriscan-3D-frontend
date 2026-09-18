/**
 * Virtual drone mesh builder.
 *
 * Kept separate from scene.js so Phase 2 can attach a camera rig, flight-path
 * tracer and disease markers directly to the returned group without touching
 * the rest of the scene code.
 */
import * as THREE from 'three'

/**
 * Build the drone: body, arms, four rotors, gimbal camera and nav lights.
 * @param {THREE.PointLight} droneLight spotlight that follows the drone
 * @returns {{ droneGroup: THREE.Group, rotors: THREE.Mesh[] }}
 */
export function createDrone(droneLight) {
  const droneGroup = new THREE.Group()

  const bodyGeo = new THREE.BoxGeometry(1.4, 0.35, 1.4)
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a1a })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  droneGroup.add(body)

  const armGeo = new THREE.BoxGeometry(2.4, 0.1, 0.18)
  const armGeo2 = new THREE.BoxGeometry(0.18, 0.1, 2.4)
  const armMat = new THREE.MeshLambertMaterial({ color: 0x223322 })
  const arm1 = new THREE.Mesh(armGeo, armMat)
  const arm2 = new THREE.Mesh(armGeo2, armMat)
  droneGroup.add(arm1, arm2)

  const rotorGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 16)
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x39ff14, transparent: true, opacity: 0.7 })
  const rotorPositions = [[-1.1, 0.18, -1.1], [1.1, 0.18, -1.1], [-1.1, 0.18, 1.1], [1.1, 0.18, 1.1]]
  const rotors = []
  rotorPositions.forEach(([x, y, z]) => {
    const rotor = new THREE.Mesh(rotorGeo, rotorMat)
    rotor.position.set(x, y, z)
    droneGroup.add(rotor)
    rotors.push(rotor)
  })

  const gimbalGeo = new THREE.BoxGeometry(0.3, 0.3, 0.35)
  const gimbalMat = new THREE.MeshLambertMaterial({ color: 0x39ff14 })
  const gimbal = new THREE.Mesh(gimbalGeo, gimbalMat)
  gimbal.position.set(0, -0.22, 0.3)
  droneGroup.add(gimbal)

  const greenLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x39ff14 })
  )
  greenLight.position.set(1.0, 0, 1.0)
  droneGroup.add(greenLight)

  const redLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3030 })
  )
  redLight.position.set(-1.0, 0, -1.0)
  droneGroup.add(redLight)

  droneGroup.position.set(0, 12, 0)
  droneGroup.userData.rotors = rotors
  droneGroup.userData.light = droneLight

  return { droneGroup, rotors }
}
