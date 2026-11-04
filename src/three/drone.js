/**
 * Virtual drone mesh builder, kept separate from scene.js so a camera rig or
 * flight-path tracer can hang off the returned group.
 *
 * The procedural drone renders immediately; once drone.glb arrives it replaces
 * the placeholder and its rotor-spin clip plays through an AnimationMixer owned
 * by the drone group.
 *
 * The model is normalised to DRONE_SIZE so it reads clearly from the fixed
 * orbit camera. GLB materials are tuned by name (roughness/metalness/env
 * intensity) and the nav-light material is made emissive so it stays visible
 * against the dark field.
 */
import * as THREE from 'three'
import { loadModel } from './modelLoader'

/**
 * Longest edge of the drone in world units. At 2.6 the orbit camera (~57 units
 * away) rendered it as a ~44 px smudge; 5.0 keeps the silhouette but reads
 * clearly on screen.
 */
const DRONE_SIZE = 5.0

/** Longest edge of the procedural placeholder, used to match the GLB size. */
const PLACEHOLDER_SPAN = 3.3

/**
 * Per-material PBR tuning for the GLB: close to the authored values, adding
 * environment response without changing the model's look.
 */
const MATERIAL_TUNING = {
  shell: { roughness: 0.32, metalness: 0.08, envMapIntensity: 1.7 },
  graphite: { roughness: 0.42, metalness: 0.72, envMapIntensity: 1.1 },
  steel: { roughness: 0.22, metalness: 1.0, envMapIntensity: 1.5 },
  orange: { roughness: 0.48, metalness: 0.05, envMapIntensity: 1.1 },
  rubber: { roughness: 0.95, metalness: 0.0, envMapIntensity: 0.6 },
  glass: { roughness: 0.06, metalness: 0.6, envMapIntensity: 1.7 },
}

/**
 * Add environment response to a loaded material. Materials are cloned per mesh
 * by modelLoader, so mutating them here cannot leak into other scene copies.
 * @param {THREE.Material} material
 */
function tuneMaterial(material) {
  if (!material) return
  const materials = Array.isArray(material) ? material : [material]

  materials.forEach((m) => {
    const tuning = MATERIAL_TUNING[m.name]
    if (tuning) {
      if (tuning.roughness !== undefined) m.roughness = tuning.roughness
      if (tuning.metalness !== undefined) m.metalness = tuning.metalness
      m.envMapIntensity = tuning.envMapIntensity
    } else {
      m.envMapIntensity = 1.1
    }

    // Nav lights glow so the drone stays readable against the dark field.
    if (/glow/i.test(m.name) && m.emissive) {
      m.emissive.copy(m.color)
      m.emissiveIntensity = 1.8
      m.toneMapped = false
    }

    if (/glass/i.test(m.name)) {
      m.metalness = 0.6
      m.roughness = 0.06
    }

    m.needsUpdate = true
  })
}

/**
 * Build the drone: body, arms, four rotors, gimbal camera and nav lights.
 * @param {THREE.PointLight} droneLight light that follows the drone
 * @returns {{ droneGroup: THREE.Group, rotors: THREE.Mesh[] }}
 */
export function createDrone(droneLight) {
  const droneGroup = new THREE.Group()

  // Built at its original footprint inside a group scaled to the final drone
  // size, so the swap to the GLB does not jump in scale.
  const placeholder = new THREE.Group()
  placeholder.scale.setScalar(DRONE_SIZE / PLACEHOLDER_SPAN)
  droneGroup.add(placeholder)

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x2b3a2d,
    roughness: 0.34,
    metalness: 0.12,
    envMapIntensity: 1.2,
  })
  const bodyGeo = new THREE.BoxGeometry(1.4, 0.35, 1.4)
  const body = new THREE.Mesh(bodyGeo, shellMat)
  placeholder.add(body)

  const armGeo = new THREE.BoxGeometry(2.4, 0.1, 0.18)
  const armGeo2 = new THREE.BoxGeometry(0.18, 0.1, 2.4)
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x3c4a3e,
    roughness: 0.45,
    metalness: 0.65,
    envMapIntensity: 1.1,
  })
  const arm1 = new THREE.Mesh(armGeo, armMat)
  const arm2 = new THREE.Mesh(armGeo2, armMat)
  placeholder.add(arm1, arm2)

  const rotorGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20)
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x39ff14,
    transparent: true,
    opacity: 0.55,
    roughness: 0.3,
    metalness: 0.1,
    envMapIntensity: 1.3,
    side: THREE.DoubleSide,
  })
  const rotorPositions = [[-1.1, 0.18, -1.1], [1.1, 0.18, -1.1], [-1.1, 0.18, 1.1], [1.1, 0.18, 1.1]]
  const rotors = []
  rotorPositions.forEach(([x, y, z]) => {
    const rotor = new THREE.Mesh(rotorGeo, rotorMat)
    rotor.position.set(x, y, z)
    rotor.castShadow = true
    placeholder.add(rotor)
    rotors.push(rotor)
  })

  const gimbalGeo = new THREE.BoxGeometry(0.3, 0.3, 0.35)
  const gimbalMat = new THREE.MeshStandardMaterial({
    color: 0x1c2a1e,
    roughness: 0.12,
    metalness: 0.7,
    envMapIntensity: 1.5,
  })
  const gimbal = new THREE.Mesh(gimbalGeo, gimbalMat)
  gimbal.position.set(0, -0.22, 0.3)
  placeholder.add(gimbal)

  const greenLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x39ff14 })
  )
  greenLight.position.set(1.0, 0, 1.0)
  placeholder.add(greenLight)

  const redLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff3030 })
  )
  redLight.position.set(-1.0, 0, -1.0)
  placeholder.add(redLight)

  body.castShadow = true
  arm1.castShadow = true
  arm2.castShadow = true

  droneGroup.position.set(0, 12, 0)
  droneGroup.userData.rotors = rotors
  droneGroup.userData.light = droneLight
  // Set to an AnimationMixer once the GLB clip plays; the controller stops
  // spinning the procedural rotors when it is present.
  droneGroup.userData.mixer = null

  loadModel('drone')
    .then((droneModel) => {
      // Assets arrive in different units: normalise by bounding box and centre
      // on the group origin.
      const box = new THREE.Box3().setFromObject(droneModel)
      const size = box.getSize(new THREE.Vector3())
      const centre = box.getCenter(new THREE.Vector3())
      const longestEdge = Math.max(size.x, size.y, size.z) || 1
      const factor = DRONE_SIZE / longestEdge
      droneModel.scale.setScalar(factor)
      droneModel.position.set(
        -centre.x * factor,
        -centre.y * factor,
        -centre.z * factor,
      )

      droneModel.traverse((child) => {
        if (!child.isMesh) return
        child.castShadow = true
        child.receiveShadow = true
        tuneMaterial(child.material)
      })

      // Replace the placeholder only once the model is in hand.
      droneGroup.children.slice().forEach((child) => {
        droneGroup.remove(child)
        child.traverse((node) => {
          if (node.geometry) node.geometry.dispose()
          if (node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material]
            materials.forEach((material) => material.dispose())
          }
        })
      })

      droneGroup.add(droneModel)

      const clips = droneModel.userData.animations || []
      if (clips.length > 0) {
        const mixer = new THREE.AnimationMixer(droneModel)
        mixer.clipAction(clips[0]).play()
        droneGroup.userData.mixer = mixer
      } else {
        console.warn('drone.glb has no animation clip; using a static model')
      }

      droneGroup.userData.light = droneLight
    })
    .catch((error) => {
      console.warn('Drone model unavailable, keeping the procedural drone:', error)
    })

  return { droneGroup, rotors }
}
