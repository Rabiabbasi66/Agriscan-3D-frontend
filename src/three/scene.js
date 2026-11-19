/**
 * Scene graph builders for the farm viewer: lighting/environment, ground,
 * crop field and disease zones, kept separate so each layer can be changed
 * without touching the others.
 */
import * as THREE from 'three'
import { DISEASE_ZONES, SEVERITY_HEX, FIELD_SIZE } from './config'
import { loadModel } from './modelLoader'

/** Height the GLB corn stalk is normalised to (procedural stalk is 1.4). */
const CORN_HEIGHT = 1.9

/** Height the GLB leaf is normalised to inside a disease zone. */
const LEAF_HEIGHT = 0.9

/**
 * Scene, atmosphere and lighting.
 *
 * Professional 3-point lighting + aerial inspection rig:
 * - Hemisphere fill (daylight sky tone + ground foliage bounce)
 * - Key light (warm golden-white sun with soft PCF shadow maps)
 * - Cool rim/accent light (opposing angle, defines metallic edges and carbon-fiber silhouette)
 * - Downward sensor spotlight (cone of inspection light projecting onto crops)
 * - Local drone fill lights
 *
 * @returns {{ scene: THREE.Scene, droneLight: THREE.PointLight, droneFillLight: THREE.PointLight, droneSpotLight: THREE.SpotLight, sun: THREE.DirectionalLight, rimLight: THREE.DirectionalLight, hemiLight: THREE.HemisphereLight, ambientLight: THREE.AmbientLight }}
 */
export function createScene() {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0a140d, 0.0075)
  scene.background = new THREE.Color(0x080f0a)

  // 1. Natural daylight sky + deep foliage ground bounce
  const hemiLight = new THREE.HemisphereLight(0xcde3f7, 0x182a16, 0.75)
  scene.add(hemiLight)

  // 2. Subtle neutral ambient light to lift dark crevices without washing out contrast
  const ambientLight = new THREE.AmbientLight(0x223326, 0.35)
  scene.add(ambientLight)

  // 3. Key Light (Sun): Warm golden-white directional light casting soft, realistic shadows
  const sun = new THREE.DirectionalLight(0xfff6e5, 2.8)
  sun.position.set(32, 48, 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 15
  sun.shadow.camera.far = 140
  sun.shadow.camera.left = -40
  sun.shadow.camera.right = 40
  sun.shadow.camera.top = 40
  sun.shadow.camera.bottom = -40
  sun.shadow.bias = -0.00015
  sun.shadow.normalBias = 0.008
  sun.shadow.radius = 1.6
  scene.add(sun)
  scene.add(sun.target)

  // 4. Rim / Silhouette Light: Cool cyan/sky tint from opposing angle to give the drone 3D pop
  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 1.2)
  rimLight.position.set(-28, 24, -24)
  scene.add(rimLight)

  // 5. Downward Inspection Scanner (SpotLight): Active multispectral sensor cone
  const droneSpotLight = new THREE.SpotLight(0x39ff14, 4.0, 35, Math.PI / 5, 0.5, 2)
  droneSpotLight.position.set(0, 10, 0)
  scene.add(droneSpotLight)
  scene.add(droneSpotLight.target)

  // 6. Drone airframe fill: subtle top/side illumination
  const droneFillLight = new THREE.PointLight(0xdcfce7, 1.8, 14, 2)
  droneFillLight.position.set(0, 12, 0)
  scene.add(droneFillLight)

  // 7. Green beacon / sensor point light
  const droneLight = new THREE.PointLight(0x39ff14, 1.6, 20, 2)
  droneLight.position.set(0, 8, 0)
  scene.add(droneLight)

  return { scene, droneLight, droneFillLight, droneSpotLight, sun, rimLight, hemiLight, ambientLight }
}

/**
 * Reflection environment for the drone's PBR materials.
 * Generates an equirectangular sky map with a bright sun disc and cool horizon
 * gradients, giving carbon fiber, polished alloys, and glass crisp realistic reflections.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @returns {THREE.Texture} pre-filtered environment map (dispose on teardown)
 */
export function createEnvironment(renderer) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  // Smooth atmospheric sky dome gradient
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height)
  sky.addColorStop(0.0, '#0a1628')   // Deep aerospace twilight zenith
  sky.addColorStop(0.35, '#1e385c')  // Mid sky cool tone
  sky.addColorStop(0.48, '#38bdf8')  // Horizon luminous atmospheric glow
  sky.addColorStop(0.50, '#93c5fd')  // Sharp horizon line
  sky.addColorStop(0.52, '#1e2920')  // Ground terrain horizon
  sky.addColorStop(0.70, '#102213')  // Agricultural field bounce
  sky.addColorStop(1.0, '#050c06')   // Deep ground nadir
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Primary Sun reflection (bright, high-intensity HDR-style sun disk with corona)
  const sunX = Math.round(canvas.width * 0.65)
  const sunY = Math.round(canvas.height * 0.28)
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 1, sunX, sunY, 70)
  sunGlow.addColorStop(0.0, '#ffffff')
  sunGlow.addColorStop(0.15, 'rgba(255, 250, 230, 0.95)')
  sunGlow.addColorStop(0.4, 'rgba(254, 215, 170, 0.45)')
  sunGlow.addColorStop(0.75, 'rgba(56, 189, 248, 0.15)')
  sunGlow.addColorStop(1.0, 'rgba(56, 189, 248, 0)')
  ctx.fillStyle = sunGlow
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Secondary soft sky highlight on the opposite side (studio fill bounce)
  const fillX = Math.round(canvas.width * 0.2)
  const fillY = Math.round(canvas.height * 0.35)
  const fillGlow = ctx.createRadialGradient(fillX, fillY, 2, fillX, fillY, 60)
  fillGlow.addColorStop(0.0, 'rgba(186, 230, 253, 0.4)')
  fillGlow.addColorStop(0.5, 'rgba(125, 211, 252, 0.15)')
  fillGlow.addColorStop(1.0, 'rgba(125, 211, 252, 0)')
  ctx.fillStyle = fillGlow
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const equirect = new THREE.CanvasTexture(canvas)
  equirect.mapping = THREE.EquirectangularReflectionMapping
  equirect.colorSpace = THREE.SRGBColorSpace

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const envMap = pmrem.fromEquirectangular(equirect).texture

  equirect.dispose()
  pmrem.dispose()

  return envMap
}

/**
 * Ground plane + reference grid.
 * @returns {{ ground: THREE.Mesh, grid: THREE.GridHelper }}
 */
export function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE, 60, 60),
    new THREE.MeshLambertMaterial({ color: 0x0c200c, wireframe: false })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true

  const grid = new THREE.GridHelper(FIELD_SIZE, 30, 0x1a3a1a, 0x112211)
  grid.position.y = 0.02

  return { ground, grid }
}

/** Every mesh inside a loaded model (usually one, but GLB exports vary). */
function collectMeshes(root) {
  const meshes = []
  root.traverse((child) => {
    if (child.isMesh && child.geometry) meshes.push(child)
  })
  return meshes
}

/**
 * Crop field stalk rows.
 *
 * Procedural instanced stalks are built immediately so the field is never
 * empty while the GLB downloads. When corn.glb arrives the field is rebuilt
 * from its geometry as two InstancedMeshes (healthy / standard), so 400+ plants
 * still cost two draw calls.
 *
 * @returns {THREE.Group}
 */
export function createCrops() {
  const cropGroup = new THREE.Group()

  const rows = []
  for (let row = -25; row <= 25; row += 3) {
    for (let col = -25; col <= 25; col += 2) {
      rows.push({
        col: col + (Math.random() - 0.5) * 0.4,
        row: row + (Math.random() - 0.5) * 0.4,
        rotY: Math.random() * Math.PI,
        healthy: Math.random() > 0.15,
      })
    }
  }

  const healthy = rows.filter(r => r.healthy)
  const standard = rows.filter(r => !r.healthy)

  const stalkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6)
  const stalkMat = new THREE.MeshLambertMaterial({ color: 0x1a6a18 })
  const stalkMatHealthy = new THREE.MeshLambertMaterial({ color: 0x22a018 })

  const buildStalks = (list, material, y) => {
    if (list.length === 0) return null
    const mesh = new THREE.InstancedMesh(stalkGeo, material, list.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scale = new THREE.Vector3(1, 1, 1)
    const euler = new THREE.Euler()
    list.forEach((stalk, i) => {
      euler.set(0, stalk.rotY, 0)
      q.setFromEuler(euler)
      pos.set(stalk.col, y, stalk.row)
      m.compose(pos, q, scale)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    // The whole field is two instances, so casting shadows costs two extra
    // draw calls in the shadow pass and gives the rows real depth.
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  const healthyMesh = buildStalks(healthy, stalkMatHealthy, 0.7)
  const standardMesh = buildStalks(standard, stalkMat, 0.7)
  if (healthyMesh) cropGroup.add(healthyMesh)
  if (standardMesh) cropGroup.add(standardMesh)

  loadModel('corn')
    .then((cornModel) => {
      // Memory safety: if the scene or cropGroup was unmounted while loading, abort and dispose
      if (!cropGroup.parent) {
        cornModel.traverse((node) => {
          if (node.geometry) node.geometry.dispose()
          if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material]
            mats.forEach((m) => m.dispose())
          }
        })
        return
      }

      const sources = collectMeshes(cornModel)
      if (sources.length === 0) return

      // GLB exports use their own units: normalise the stalk height and drop
      // it so its base sits on the ground plane.
      const box = new THREE.Box3().setFromObject(cornModel)
      const size = box.getSize(new THREE.Vector3())
      const factor = CORN_HEIGHT / (size.y || 1)
      const baseY = -box.min.y * factor

      const buildCorn = (list, hex) => {
        if (list.length === 0) return null
        const group = new THREE.Group()
        const m = new THREE.Matrix4()
        const q = new THREE.Quaternion()
        const pos = new THREE.Vector3()
        const scale = new THREE.Vector3(factor, factor, factor)
        const euler = new THREE.Euler()

        sources.forEach((source) => {
          const material = source.material.clone()
          if (material.color) material.color.setHex(hex)
          const mesh = new THREE.InstancedMesh(source.geometry, material, list.length)
          mesh.castShadow = true
          mesh.receiveShadow = true
          list.forEach((stalk, i) => {
            euler.set(0, stalk.rotY, 0)
            q.setFromEuler(euler)
            pos.set(stalk.col, baseY, stalk.row)
            m.compose(pos, q, scale)
            mesh.setMatrixAt(i, m)
          })
          mesh.instanceMatrix.needsUpdate = true
          group.add(mesh)
        })

        return group
      }

      const healthyCorn = buildCorn(healthy, 0x22a018)
      const standardCorn = buildCorn(standard, 0x1a6a18)

      // Swap only after the replacement exists, so the field is never empty.
      if (healthyCorn) cropGroup.add(healthyCorn)
      if (standardCorn) cropGroup.add(standardCorn)
      if (healthyMesh) { cropGroup.remove(healthyMesh); healthyMesh.dispose() }
      if (standardMesh) { cropGroup.remove(standardMesh); standardMesh.dispose() }
      stalkGeo.dispose()
      stalkMat.dispose()
      stalkMatHealthy.dispose()
    })
    .catch((error) => {
      console.warn('Corn model unavailable, keeping procedural stalks:', error)
    })

  return cropGroup
}

/**
 * Disease zone markers: border ring, translucent fill and animated pulse ring.
 * Pulse rings carry `userData.isPulse` / `userData.baseRadius`, which the
 * controller animates each frame. Leaf models are added once the GLB arrives.
 *
 * @returns {THREE.Group}
 */
export function createDiseaseZones() {
  const diseaseGroup = new THREE.Group()
  const colourByZone = []

  DISEASE_ZONES.forEach(zone => {
    const color = SEVERITY_HEX[zone.severity]
    colourByZone.push(color)

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

  // One shared leaf download for every zone.
  loadModel('leaf')
    .then((leafModel) => {
      // Memory safety: if the scene or diseaseGroup was unmounted while loading, abort and dispose
      if (!diseaseGroup.parent) {
        leafModel.traverse((node) => {
          if (node.geometry) node.geometry.dispose()
          if (node.material) {
            const mats = Array.isArray(node.material) ? node.material : [node.material]
            mats.forEach((m) => m.dispose())
          }
        })
        return
      }

      const sources = collectMeshes(leafModel)
      if (sources.length === 0) return

      const box = new THREE.Box3().setFromObject(leafModel)
      const size = box.getSize(new THREE.Vector3())
      const factor = LEAF_HEIGHT / (size.y || 1)
      const baseY = -box.min.y * factor

      DISEASE_ZONES.forEach((zone, zoneIndex) => {
        const color = colourByZone[zoneIndex]
        const leavesPerZone = 5

        sources.forEach((source) => {
          const material = source.material.clone()
          if (material.color) {
            material.color.setHex(color)
            material.color.multiplyScalar(0.7) // darken slightly
          }

          for (let i = 0; i < leavesPerZone; i++) {
            const leaf = new THREE.Mesh(source.geometry, material)
            const angle = (i / leavesPerZone) * Math.PI * 2
            const radius = (zone.radius - 1) * Math.sqrt(Math.random())
            leaf.position.set(
              zone.x + Math.cos(angle) * radius,
              baseY,
              zone.z + Math.sin(angle) * radius,
            )
            leaf.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, 0)
            leaf.scale.setScalar(factor * (0.8 + Math.random() * 0.4))
            diseaseGroup.add(leaf)
          }
        })
      })
    })
    .catch((error) => {
      console.warn('Leaf model unavailable, disease zones keep the ring markers:', error)
    })

  return diseaseGroup
}
