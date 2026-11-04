/**
 * GLB loader for the low-poly models in public/models/.
 *
 * Every scene controller asks for the same models at once (hero viewer plus
 * StrictMode remounts), so in-flight requests are de-duplicated rather than
 * only completed downloads being cached.
 *
 * Copies must not share GPU resources: Object3D.clone() reuses geometry and
 * materials, so disposing one viewer would release buffers another one is
 * still rendering. Each copy therefore clones its geometry and materials.
 *
 * Animations live on `userData.animations` because a cloned Object3D carries
 * no `animations` property of its own.
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const modelCache = new Map()
const inFlight = new Map()
const MODELS_BASE_URL = '/models/'

/**
 * Fetch and parse a GLB, resolving with the raw glTF payload.
 * @param {string} modelName
 * @returns {Promise<{ scene: THREE.Group, animations: THREE.AnimationClip[] }>}
 */
function fetchModel(modelName) {
  const url = `${MODELS_BASE_URL}${modelName}.glb`
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations || [] }),
      undefined,
      (error) => reject(error),
    )
  })
}

/**
 * Independent copy of a cached model: own geometry, materials and animations.
 * @param {{ scene: THREE.Group, animations: THREE.AnimationClip[] }} entry
 * @returns {THREE.Group}
 */
function copyModel(entry) {
  const root = entry.scene.clone(true)

  root.traverse((child) => {
    if (!child.isMesh) return
    if (child.geometry) child.geometry = child.geometry.clone()
    if (child.material) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone()
    }
    child.castShadow = false
    child.receiveShadow = true
    child.visible = true
  })

  root.visible = true
  root.userData.animations = entry.animations
  return root
}

/**
 * Load a GLB model from public/models.
 * @param {string} modelName model file name without the .glb extension
 * @returns {Promise<THREE.Group>} an independent copy of the model
 */
export async function loadModel(modelName) {
  const cached = modelCache.get(modelName)
  if (cached) return copyModel(cached)

  let pending = inFlight.get(modelName)
  if (!pending) {
    pending = fetchModel(modelName)
      .then((entry) => {
        modelCache.set(modelName, entry)
        return entry
      })
      .finally(() => {
        inFlight.delete(modelName)
      })
    inFlight.set(modelName, pending)
  }

  return copyModel(await pending)
}

/** Preload several models in parallel; failures are reported, not fatal. */
export async function preloadModels(modelNames) {
  await Promise.all(
    modelNames.map((name) => loadModel(name).catch((error) => {
      console.warn(`Model "${name}" could not be preloaded:`, error)
      return null
    })),
  )
}
