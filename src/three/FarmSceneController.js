/**
 * Owns the renderer, camera, scene graph and animation loop for the farm
 * viewer. The React component only creates/disposes the controller and mirrors
 * UI state into `setScanning()` / `setDroneSpeed()`; all Three.js details stay
 * in this module.
 *
 * `_updateDrone()` is the only place drone motion is applied, and
 * `onBeforeRender` is the hook for per-frame overlays.
 */
import * as THREE from 'three'
import { createScene, createGround, createCrops, createDiseaseZones, createEnvironment } from './scene'
import { createDrone } from './drone'
import { getDronePositionInto } from './dronePath'
import { DRONE } from './config'
import { createAiMarkerGroup, rebuildAiMarkers, updateAppearAnimations, setHighlightedMarker } from './aiMarkers'

export default class FarmSceneController {
  /**
   * @param {HTMLElement} container element the canvas is appended to
   */
  constructor(container) {
    this.container = container
    this._rafId = null
    this._resizeObserver = null
    this._disposed = false

    const W = container.clientWidth
    const H = container.clientHeight

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setSize(W, H)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    // Soft shadows + filmic tone mapping so the metallic drone materials keep
    // highlight detail instead of clipping to white.
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.25
    container.appendChild(this.renderer.domElement)

    const { scene, droneLight, droneFillLight, sun } = createScene()
    this.scene = scene
    this.droneLight = droneLight
    this.droneFillLight = droneFillLight
    this.sun = sun

    // Without an environment the GLB's metallic parts render nearly black.
    this.envMap = createEnvironment(this.renderer)
    this.scene.environment = this.envMap

    const { ground, grid } = createGround()
    this.groundMesh = ground // kept for marker picking
    this.scene.add(ground, grid)

    this.cropGroup = createCrops()
    this.scene.add(this.cropGroup)

    this.diseaseGroup = createDiseaseZones()
    this.scene.add(this.diseaseGroup)

    // Persistent group, rebuilt (not re-created) per scan by setAiMarkers().
    // Empty when there is no AI result, leaving the demo zones visible.
    this.aiMarkerGroup = createAiMarkerGroup()
    this.scene.add(this.aiMarkerGroup)

    const { droneGroup, rotors } = createDrone(this.droneLight)
    this.droneGroup = droneGroup
    this.rotors = rotors
    this.scene.add(this.droneGroup)

    this.camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500)
    this.camera.position.set(45, 38, 55)
    this.camera.lookAt(0, 0, 0)

    this.orbitAngle = 0
    this.tDrone = 0
    this.pulseT = 0
    this.scanning = true
    this.droneSpeed = 0.004

    /** detectionId of the currently highlighted AI marker (or null). */
    this.selectedDetectionId = null

    /** Optional per-frame callback: (controller) => void, runs before render. */
    this.onBeforeRender = null

    // Drone position when the last scan was captured: detections are projected
    // through that nadir camera snapshot, not the live pose.
    this.lastCapturePosition = null
    this._appearClock = 0
    this._lastFrameTime = null

    /** Raycaster reused for marker picking (no per-click allocation). */
    this._raycaster = new THREE.Raycaster()

    /** Scratch vector for the per-frame drone path target. */
    this._droneTarget = new THREE.Vector3()

    this._animate = this._animate.bind(this)
    this._onResize = this._onResize.bind(this)

    this._resizeObserver = new ResizeObserver(this._onResize)
    this._resizeObserver.observe(container)

    // Only render while the viewer is on screen. A frame costs ~4.6 ms
    // (66 draw calls, 55k triangles, 2048² shadow pass), i.e. ~275 ms of
    // main-thread time per second spent drawing a canvas the user scrolled
    // past. Scene state is kept, so the patrol resumes in place on return.
    this._visible = true
    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) this._visible = entry.isIntersecting
      },
      { threshold: 0 },
    )
    this._intersectionObserver.observe(container)

    this._animate()
  }

  /** Pause/resume the drone scan (rotors + forward flight). */
  setScanning(value) {
    this.scanning = value
  }

  /** Update the drone patrol speed (world advance per frame tick). */
  setDroneSpeed(value) {
    this.droneSpeed = value
  }

  /** Current live drone position (clone) for capture-time camera state. */
  getDroneLivePosition() {
    return this.droneGroup.position.clone()
  }

  /**
   * Mission state derived only from live controller state.
   *
   * `loopProgress` is the fraction of the current patrol cycle (period 2π in
   * t) — a loop position, not a field survey percentage: the patrol is endless
   * and has no waypoints.
   * @returns {{ scanning: boolean, position: THREE.Vector3, altitude: number, loopProgress: number }}
   */
  getMissionState() {
    const pos = this.droneGroup.position
    const period = Math.PI * 2
    const loopProgress = ((this.tDrone % period) + period) % period / period
    return {
      scanning: this.scanning,
      position: pos.clone(),
      altitude: pos.y,
      loopProgress,
    }
  }

  /**
   * Replace the AI-scan markers with markers for `detections` (normalised, see
   * normalizePrediction()). An empty or failed result clears them so the demo
   * disease zones show through again.
   *
   * `capturePosition`, when given, is remembered and used as the nadir camera
   * for projecting detections; later updates reuse it, and without any position
   * the survey-grid fallback applies.
   *
   * @param {Array} detections normalised AI detections (may be [])
   * @param {THREE.Vector3|null} [capturePosition] drone position at capture
   */
  setAiMarkers(detections, capturePosition = null) {
    if (capturePosition) {
      this.lastCapturePosition = capturePosition.clone()
    }
    const effective = capturePosition || this.lastCapturePosition
    const result = rebuildAiMarkers(this.aiMarkerGroup, detections, effective)
    this._appearClock = 0 // restart the marker appear animation
    this.selectedDetectionId = null // a rescan invalidates any selection
    return result
  }

  /**
   * Ground point under a mouse event (used for marker picking).
   * @param {{clientX: number, clientY: number}} mouseEvent
   * @returns {THREE.Vector3|null} ground intersection, or null
   */
  pickGroundPoint(mouseEvent) {
    const rect = this.container.getBoundingClientRect()
    const ndcX = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1
    this._raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const hits = this._raycaster.intersectObject(this.groundMesh, false)
    return hits.length > 0 ? hits[0].point : null
  }

  /**
   * Highlight the AI marker for a detection id, re-colouring its materials in
   * place; pass null to clear. Returns true when a matching marker exists.
   * @param {string|null} detectionId
   * @returns {boolean}
   */
  highlightAiMarker(detectionId) {
    this.selectedDetectionId = detectionId || null
    return setHighlightedMarker(this.aiMarkerGroup, this.selectedDetectionId)
  }

  /**
   * Nearest AI marker to a ground point within `threshold` world units.
   * @param {THREE.Vector3|null} groundPoint
   * @param {number} [threshold=3.5]
   * @returns {number|null} marker index, or null when none matches
   */
  findNearestMarker(groundPoint, threshold = 3.5) {
    if (!groundPoint) return null
    let bestIndex = null
    let bestDistance = threshold
    this.aiMarkerGroup.children.forEach((marker, index) => {
      const dx = marker.position.x - groundPoint.x
      const dz = marker.position.z - groundPoint.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist <= bestDistance) {
        bestDistance = dist
        bestIndex = index
      }
    })
    return bestIndex
  }

  /**
   * Drone motion for the current frame, using the allocation-free path
   * variant so the loop allocates nothing per frame.
   * @private
   */
  _updateDrone() {
    if (this.scanning) {
      this.tDrone += this.droneSpeed
    }

    this._droneTarget = getDronePositionInto(this.tDrone, this._droneTarget)
    this.droneGroup.position.lerp(this._droneTarget, 0.08)
    this.droneGroup.rotation.y = -this.tDrone + Math.PI

    this.droneLight.position.copy(this.droneGroup.position)
    this.droneLight.position.y += DRONE.lightOffsetY

    // Fixed world offset, so the fill highlight does not spin with the airframe.
    this.droneFillLight.position.copy(this.droneGroup.position)
    this.droneFillLight.position.x += 2.2
    this.droneFillLight.position.y += 3.4
    this.droneFillLight.position.z -= 2.2

    if (!this.droneGroup.userData.mixer) {
      const spin = this.scanning ? DRONE.rotorSpinActive : DRONE.rotorSpinIdle
      this.rotors.forEach(r => { r.rotation.y += spin })
    }
  }

  /** Camera orbit + disease pulse animation. @private */
  _updateCameraAndEffects() {
    this.orbitAngle += 0.0006
    this.pulseT += 0.04

    const camR = 65
    this.camera.position.x = Math.cos(this.orbitAngle) * camR
    this.camera.position.z = Math.sin(this.orbitAngle) * camR
    this.camera.position.y = 38 + Math.sin(this.orbitAngle * 0.3) * 4
    this.camera.lookAt(0, 2, 0)

    this.diseaseGroup.children.forEach(child => {
      if (child.userData.isPulse) {
        const scale = 1 + Math.sin(this.pulseT) * 0.3
        child.scale.setScalar(scale)
        child.material.opacity = (0.5 + Math.sin(this.pulseT) * 0.3) * Math.max(0, 1 - (scale - 1) * 2)
      }
    })

    // Same clock and equations as the demo zones so all rings breathe in sync.
    this.aiMarkerGroup.children.forEach(marker => {
      const pulse = marker.userData.pulse
      if (pulse && pulse.userData.isPulse) {
        const scale = 1 + Math.sin(this.pulseT) * 0.3
        pulse.scale.setScalar(scale)
        pulse.material.opacity = (0.5 + Math.sin(this.pulseT) * 0.3) * Math.max(0, 1 - (scale - 1) * 2)
      }
    })
  }

  /** Render loop. @private */
  _animate() {
    if (this._disposed) return
    this._rafId = requestAnimationFrame(this._animate)

    // Off-screen: skip the frame entirely, but keep the clock fresh so the
    // animation resumes without a jump in the appear/marker timings.
    if (!this._visible) {
      this._lastFrameTime = performance.now()
      return
    }

    // Delta time for the marker appear animation (clamped for tab switches).
    const now = performance.now()
    if (this._lastFrameTime === null) this._lastFrameTime = now
    const dtMs = Math.min(now - this._lastFrameTime, 100)
    this._lastFrameTime = now
    this._appearClock += dtMs
    if (this.aiMarkerGroup.children.length > 0) {
      updateAppearAnimations(this.aiMarkerGroup, this._appearClock)
    }

    if (this.droneGroup.userData.mixer) {
      this.droneGroup.userData.mixer.update(dtMs / 1000)
    }

    this._updateDrone()
    this._updateCameraAndEffects()
    if (this.onBeforeRender) this.onBeforeRender(this)

    this.renderer.render(this.scene, this.camera)
  }

  /** Debounced resize handling. @private */
  _onResize() {
    if (this._resizePending) return
    this._resizePending = true
    requestAnimationFrame(() => {
      const W = this.container.clientWidth
      const H = this.container.clientHeight
      if (W === 0 || H === 0) {
        this._resizePending = false
        return
      }
      this.camera.aspect = W / H
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(W, H)
      this._resizePending = false
    })
  }

  /**
   * Full teardown: stops the loop, releases GPU resources (geometries,
   * materials) and removes the canvas. Safe to call twice.
   */
  dispose() {
    if (this._disposed) return
    this._disposed = true

    if (this._rafId !== null) cancelAnimationFrame(this._rafId)
    if (this._resizeObserver) this._resizeObserver.disconnect()
    if (this._intersectionObserver) this._intersectionObserver.disconnect()

    if (this.droneGroup.userData.mixer) {
      this.droneGroup.userData.mixer.stopAllAction()
    }

    if (this.envMap) {
      this.scene.environment = null
      this.envMap.dispose()
      this.envMap = null
    }

    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => m.dispose())
      }
    })

    // aiMarkerGroup is a scene child, so the traverse above already disposed
    // every marker geometry/material.
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}

