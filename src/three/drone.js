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
 * Per-material PBR tuning for the GLB: brings out high-end aerospace composite,
 * carbon fiber, and polished alloy reflections in realistic lighting.
 */
const MATERIAL_TUNING = {
  shell: { roughness: 0.28, metalness: 0.12, envMapIntensity: 1.6 },
  graphite: { roughness: 0.38, metalness: 0.65, envMapIntensity: 1.3 },
  steel: { roughness: 0.18, metalness: 0.95, envMapIntensity: 2.0 },
  orange: { roughness: 0.42, metalness: 0.05, envMapIntensity: 1.2 },
  rubber: { roughness: 0.9, metalness: 0.02, envMapIntensity: 0.5 },
  glass: { roughness: 0.05, metalness: 0.3, envMapIntensity: 2.2 },
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
      m.envMapIntensity = 1.3
    }

    // High-tech status LEDs and nav lights
    if (/glow/i.test(m.name) && m.emissive) {
      m.emissive = new THREE.Color(0x38bdf8)
      m.emissiveIntensity = 2.8
      m.toneMapped = false
    }

    if (/glass/i.test(m.name)) {
      m.metalness = 0.25
      m.roughness = 0.04
      m.transparent = true
      m.opacity = 0.85
    }

    m.needsUpdate = true
  })
}

/**
 * Build the drone: body, arms, four rotors, gimbal camera and nav lights.
 * @param {THREE.PointLight} droneLight light that follows the drone
 * @returns {{ droneGroup: THREE.Group, rotors: THREE.Mesh[] }}
 */
/**
 * Persistent detail layer added on top of whatever body renders (GLB model
 * or procedural fallback): gimbal lens glow, wingtip nav lights, translucent
 * rotor-blur discs and a belly status LED. Kept outside the placeholder so
 * the GLB swap never removes it.
 */
function buildDroneExtras() {
  const extras = new THREE.Group()
  extras.name = 'drone-extras'

  // --- Gimbal camera lens: dark housing ring + emissive glass element ---
  const lensRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.025, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a0f0a, roughness: 0.4, metalness: 0.8 }),
  )
  lensRing.rotation.x = Math.PI / 2
  lensRing.position.set(0, -0.3, 0.34)

  const lensGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20),
    new THREE.MeshStandardMaterial({
      color: 0x0b1f3a, roughness: 0.15, metalness: 0.4,
      emissive: 0x2266ff, emissiveIntensity: 0.9,
    }),
  )
  lensGlass.rotation.x = Math.PI / 2
  lensGlass.position.set(0, -0.3, 0.345)
  extras.add(lensRing, lensGlass)

  // --- Wingtip navigation lights (emissive, visible in daylight) ---
  const navGeo = new THREE.SphereGeometry(0.045, 10, 10)
  const navMatL = new THREE.MeshBasicMaterial({ color: 0xff3333 })
  const navMatR = new THREE.MeshBasicMaterial({ color: 0x33ff66 })
  const navMatT = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const navL = new THREE.Mesh(navGeo, navMatL)
  navL.position.set(-1.25, 0.32, 0)
  const navR = new THREE.Mesh(navGeo, navMatR)
  navR.position.set(1.25, 0.32, 0)
  const navT = new THREE.Mesh(navGeo, navMatT)
  navT.position.set(0, 0.5, 0)
  extras.add(navL, navR, navT)

  // --- Rotor blur discs: translucent rings that sell the spin at speed ---
  const blurGeo = new THREE.RingGeometry(0.12, 0.52, 32)
  const blurMat = new THREE.MeshBasicMaterial({
    color: 0x9aa5b1, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  })
  const rotorXZ = [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]
  rotorXZ.forEach(([x, z]) => {
    const disc = new THREE.Mesh(blurGeo, blurMat)
    disc.rotation.x = -Math.PI / 2
    disc.position.set(x, 0.21, z)
    extras.add(disc)
  })

  // --- Belly status LED strip ---
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.02, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x22ff88 }),
  )
  led.position.set(0, -0.34, 0)
  extras.add(led)

  return extras
}

export function createDrone(droneLight) {
  const droneGroup = new THREE.Group()

  // Built at its original footprint inside a group scaled to the final drone
  // size, so the swap to the GLB does not jump in scale.
  const placeholder = new THREE.Group()
  placeholder.scale.setScalar(DRONE_SIZE / PLACEHOLDER_SPAN)
  droneGroup.add(placeholder)

  // Detail layer that survives the GLB swap (lens, nav lights, rotor blur).
  const extras = buildDroneExtras()
  droneGroup.add(extras)

  // Sleek composite titanium-white shell
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xedf2f7,
    roughness: 0.28,
    metalness: 0.12,
    envMapIntensity: 1.5,
  })
  const bodyGeo = new THREE.BoxGeometry(1.4, 0.35, 1.4)
  const body = new THREE.Mesh(bodyGeo, shellMat)
  placeholder.add(body)

  // Graphite / carbon fiber arms
  const armGeo = new THREE.BoxGeometry(2.4, 0.1, 0.18)
  const armGeo2 = new THREE.BoxGeometry(0.18, 0.1, 2.4)
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.38,
    metalness: 0.65,
    envMapIntensity: 1.2,
  })
  const arm1 = new THREE.Mesh(armGeo, armMat)
  const arm2 = new THREE.Mesh(armGeo2, armMat)
  placeholder.add(arm1, arm2)

  const rotorGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.06, 20)
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.6,
    roughness: 0.25,
    metalness: 0.15,
    envMapIntensity: 1.4,
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

  // Anodized gimbal sensor housing
  const gimbalGeo = new THREE.BoxGeometry(0.3, 0.3, 0.35)
  const gimbalMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.18,
    metalness: 0.85,
    envMapIntensity: 1.8,
  })
  const gimbal = new THREE.Mesh(gimbalGeo, gimbalMat)
  gimbal.position.set(0, -0.22, 0.3)
  placeholder.add(gimbal)

  const greenLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  )
  greenLight.position.set(1.0, 0, 1.0)
  placeholder.add(greenLight)

  const redLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  )
  redLight.position.set(-1.0, 0, -1.0)
  placeholder.add(redLight)

  body.castShadow = true
  arm1.castShadow = true
  arm2.castShadow = true

  droneGroup.position.set(0, 12, 0)
  droneGroup.userData.rotors = rotors
  droneGroup.userData.light = droneLight
  droneGroup.userData.mixer = null
  droneGroup.userData.action = null

  loadModel('drone')
    .then((droneModel) => {
      // Memory safety: if the scene or droneGroup was destroyed while loading, abort and dispose
      if (!droneGroup.parent) {
        droneModel.traverse((node) => {
          if (node.geometry) node.geometry.dispose()
          if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material]
            mats.forEach((m) => m.dispose())
          }
        })
        return
      }

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
        if (child === extras) return
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
        const action = mixer.clipAction(clips[0])
        action.play()
        droneGroup.userData.mixer = mixer
        droneGroup.userData.action = action
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
