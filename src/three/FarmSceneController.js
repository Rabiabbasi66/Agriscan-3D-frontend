/**
 * Owns the renderer, camera, scene graph and animation loop for the farm
 * viewer. The React component only creates/disposes the controller and mirrors
 * UI state into `setScanning()` / `setDroneSpeed()`; all Three.js details stay
 * in this module.
 *
 * `_updateDrone()` handles realistic flight kinematics (pitch, roll, banking),
 * OrbitControls delivers smooth interactive rotation/zoom, and
 * `onBeforeRender` is the hook for per-frame overlays.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createScene, createGround, createCrops, createDiseaseZones, createEnvironment } from './scene'
import { createDrone } from './drone'
import { getDronePositionInto, getDronePositionForPattern } from './dronePath'
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

    const W = container.clientWidth || 800
    const H = container.clientHeight || 600
    const isMobile = W < 768

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setSize(W, H)
    // Mobile optimization: clamp pixel ratio to 1.5 on mobile to prevent GPU fill-rate throttling
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2))
    // Soft PCF shadows + filmic tone mapping so metallic & composite drone materials
    // retain dynamic range and specular highlights without clipping.
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
    container.appendChild(this.renderer.domElement)

    const { scene, droneLight, droneFillLight, droneSpotLight, sun, rimLight, hemiLight, ambientLight } = createScene()
    this.scene = scene
    this.droneLight = droneLight
    this.droneFillLight = droneFillLight
    this.droneSpotLight = droneSpotLight
    this.sun = sun
    this.rimLight = rimLight
    this.hemiLight = hemiLight
    this.ambientLight = ambientLight

    // High-fidelity procedural reflection environment for realistic PBR response
    this.envMap = createEnvironment(this.renderer)
    this.scene.environment = this.envMap

    const { ground, grid } = createGround()
    this.groundMesh = ground // kept for marker picking
    this.scene.add(ground, grid)

    this.cropGroup = createCrops()
    this.scene.add(this.cropGroup)

    this.diseaseGroup = createDiseaseZones()
    this.scene.add(this.diseaseGroup)

    // Persistent group, rebuilt per scan by setAiMarkers()
    this.aiMarkerGroup = createAiMarkerGroup()
    this.scene.add(this.aiMarkerGroup)

    // Planned survey path: thin line showing the route before take-off.
    this._plannedPath = this._buildPlannedPath()
    this.scene.add(this._plannedPath)

    // Flown-path trail: fixed-size ring written in place each frame.
    const TRAIL_MAX = 300
    this._trailMax = TRAIL_MAX
    this._trailPositions = new Float32Array(TRAIL_MAX * 3)
    this._trailCount = 0
    this._trailGeometry = new THREE.BufferGeometry()
    this._trailGeometry.setAttribute('position', new THREE.BufferAttribute(this._trailPositions, 3))
    this._trailLine = new THREE.Line(
      this._trailGeometry,
      new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.55 })
    )
    this._trailLine.frustumCulled = false
    this.scene.add(this._trailLine)

    // Camera footprint on the ground under the drone (nadir FOV proxy).
    this._footprint = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.DoubleSide })
    )
    this._footprint.rotation.x = -Math.PI / 2
    this._footprint.position.y = 0.06
    this.scene.add(this._footprint)

    // Shutter flash light fired on each simulated capture.
    this._captureFlash = 0
    this._captureLight = new THREE.PointLight(0xcfe8ff, 0, 22, 1.5)
    this.scene.add(this._captureLight)

    // Coverage grid: plots are "scanned" when the drone footprint passes over.
    this._coverage = { cols: 10, rows: 10, half: 24, cells: new Set() }
    this._coverageTimer = 0

    // Geofence boundary around the survey area (simulated keep-out zone).
    this._geofence = this._buildGeofence()
    this.scene.add(this._geofence)

    // Capture log: last simulated captures with position/altitude.
    this._captureLog = []

    // Simulated wind phase + time-of-day cycle + motion preference.
    this._windPhase = Math.random() * Math.PI * 2
    this._dayT = 0.3 // start mid-morning
    this._reducedMotion = false

    const { droneGroup, rotors } = createDrone(this.droneLight)
    this.droneGroup = droneGroup
    this.rotors = rotors
    this.scene.add(this.droneGroup)

    // Fit camera perspective to screen aspect ratio (wider FOV on portrait mobile screens)
    const aspect = W / H
    const initialFov = aspect < 1.0 ? 64 : 55
    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 500)
    // On mobile portrait, position slightly further back so drone & field remain fully framed
    const camDistMultiplier = aspect < 1.0 ? 1.25 : 1.0
    this.camera.position.set(45 * camDistMultiplier, 38 * camDistMultiplier, 55 * camDistMultiplier)

    // Smooth OrbitControls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.screenSpacePanning = true
    this.controls.minDistance = 6
    this.controls.maxDistance = 150
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04 // prevent camera flipping underground
    this.controls.minPolarAngle = 0.05
    this.controls.target.set(0, 4, 0)
    this.controls.autoRotate = false
    this.controls.autoRotateSpeed = 0.4
    this.controls.update()

    /** Camera mode: 'overview' (orbits field) or 'drone' (tracks drone) */
    this.cameraMode = 'overview'

    this.tDrone = 0
    this.pulseT = 0
    this.scanning = true
    this.droneSpeed = 0.004
    this.flightPattern = 'lissajous'
    this.missionTime = 0
    this.captures = 0
    this._captureTimer = 0
    this._rtkActive = false
    this._rtkLanded = false
    this.scrollProgress = 0
    this._smoothScrollProgress = 0

    /** detectionId of the currently highlighted AI marker (or null). */
    this.selectedDetectionId = null

    /** Optional per-frame callback: (controller) => void, runs before render. */
    this.onBeforeRender = null

    // Drone position when the last scan was captured
    this.lastCapturePosition = null
    this._appearClock = 0
    this._lastFrameTime = null

    /** Raycaster reused for marker picking (no per-click allocation). */
    this._raycaster = new THREE.Raycaster()

    /** Scratch vectors for the per-frame drone path target. */
    this._droneTarget = new THREE.Vector3()
    this._lookAheadTarget = new THREE.Vector3()

    // Drag detection so orbit/zoom interactions do not trigger marker click events
    this._isDragging = false
    this._pointerDownPos = { x: 0, y: 0 }

    this._onPointerDown = (e) => {
      this._pointerDownPos = { x: e.clientX, y: e.clientY }
      this._isDragging = false
    }

    this._onPointerMove = (e) => {
      if (Math.hypot(e.clientX - this._pointerDownPos.x, e.clientY - this._pointerDownPos.y) > 5) {
        this._isDragging = true
      }
    }

    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove)

    this._animate = this._animate.bind(this)
    this._onResize = this._onResize.bind(this)

    this._resizeObserver = new ResizeObserver(this._onResize)
    this._resizeObserver.observe(container)

    // Visibility-aware render loop: saves CPU/GPU when scrolled out of view
    this._visible = true
    this._intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) {
          const wasVisible = this._visible
          this._visible = entry.isIntersecting
          if (!wasVisible && this._visible && !this._disposed) {
            this._lastFrameTime = performance.now()
            this._startLoop()
          }
        }
      },
      { threshold: 0 },
    )
    this._intersectionObserver.observe(container)

    this._startLoop()
  }

  /** Start or restart the animation frame loop. @private */
  _startLoop() {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId)
    this._rafId = requestAnimationFrame(this._animate)
  }

  /**
   * Switch camera mode: 'overview' (orbit field), 'drone' (chase/follow),
   * 'fpv' (drone-camera view), 'topdown' (map view).
   */
  setCameraMode(mode) {
    this.cameraMode = ['overview', 'drone', 'fpv', 'topdown'].includes(mode) ? mode : 'overview'
    // FPV drives the camera directly; orbit controls would fight it.
    this.controls.enabled = this.cameraMode !== 'fpv'
    if (mode === 'drone') {
      this.controls.target.copy(this.droneGroup.position)
      // If camera is very far, pull in closer for a thrilling inspection view
      if (this.camera.position.distanceTo(this.droneGroup.position) > 40) {
        this.camera.position.set(
          this.droneGroup.position.x + 14,
          this.droneGroup.position.y + 8,
          this.droneGroup.position.z + 14
        )
      }
    } else if (mode === 'topdown') {
      this.controls.target.set(0, 0, 0)
      this.camera.position.set(0.01, 72, 0.01)
    } else {
      this.controls.target.set(0, 4, 0)
    }
    this.controls.update()
  }

  /** Reset camera to the default isometric view overlooking the field. */
  resetCamera() {
    this.cameraMode = 'overview'
    this.controls.target.set(0, 4, 0)
    this.camera.position.set(45, 38, 55)
    this.controls.update()
  }

  /** Toggle subtle cinematic auto-rotation. Returns the new active state. */
  toggleAutoRotate() {
    this.controls.autoRotate = !this.controls.autoRotate
    return this.controls.autoRotate
  }

  /** Pause/resume the drone scan (rotors + forward flight). */
  setScanning(value) {
    this.scanning = value
    if (value && this._rtkLanded) {
      // Simulated battery swap: resuming after an RTK landing starts a
      // fresh sortie (mission clock, captures and battery all reset).
      this._rtkLanded = false
      this.missionTime = 0
      this.captures = 0
      this._captureTimer = 0
    }
  }

  /** Update normalized scroll progress (0..1) for smooth scroll-driven drone choreography */
  setScrollProgress(progress) {
    this.scrollProgress = Math.max(0, Math.min(1, progress || 0))
  }

  /** Update the drone patrol speed (world advance per frame tick). */
  setDroneSpeed(value) {
    this.droneSpeed = value
  }

  /** Switch survey flight pattern: 'lissajous' | 'grid' | 'spiral' | 'crosshatch'. */
  setFlightPattern(pattern) {
    this.flightPattern = ['grid', 'spiral', 'crosshatch'].includes(pattern) ? pattern : 'lissajous'
    // A new survey pattern restarts the mission clock, capture log, battery
    // and return-to-home state (simulated "battery swap").
    this.missionTime = 0
    this.captures = 0
    this._captureTimer = 0
    this._rtkActive = false
    this._rtkLanded = false
    this._trailCount = 0
    this._trailGeometry.setDrawRange(0, 0)
    this._coverage.cells.clear()
    this._captureLog.length = 0
    // Rebuild the planned-path overlay for the new pattern.
    this.scene.remove(this._plannedPath)
    this._plannedPath.geometry.dispose()
    this._plannedPath.material.dispose()
    this._plannedPath = this._buildPlannedPath()
    this.scene.add(this._plannedPath)
  }

  /** Honour prefers-reduced-motion: kills sway, pulses and wind drift. */
  setReducedMotion(value) {
    this._reducedMotion = !!value
  }

  /**
   * Geofence: thin amber rectangle marking the survey boundary.
   * @returns {THREE.Line}
   * @private
   */
  _buildGeofence() {
    const s = 26
    const y = 0.2
    const pts = [
      new THREE.Vector3(-s, y, -s), new THREE.Vector3(s, y, -s),
      new THREE.Vector3(s, y, s), new THREE.Vector3(-s, y, s),
      new THREE.Vector3(-s, y, -s),
    ]
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xff9020, transparent: true, opacity: 0.45 })
    )
  }

  /**
   * Sample the active pattern over one loop into a thin preview line.
   * @returns {THREE.Line}
   * @private
   */
  _buildPlannedPath() {
    const N = 240
    const pts = []
    const v = new THREE.Vector3()
    const period = Math.PI * 2
    for (let i = 0; i <= N; i++) {
      getDronePositionForPattern((i / N) * period, v, this.flightPattern)
      // Flatten to a ground-level preview line (y = 0.15 clears the terrain).
      pts.push(new THREE.Vector3(v.x, 0.15, v.z))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    return new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.30 })
    )
  }

  /** Current live drone position (clone) for capture-time camera state. */
  getDroneLivePosition() {
    return this.droneGroup.position.clone()
  }

  /**
   * Mission state derived only from live controller state.
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
      pattern: this.flightPattern,
      elapsed: this.missionTime,
      captures: this.captures,
      battery: Math.max(0, 100 - this.missionTime * 0.1),
      rtk: this._rtkActive || this._rtkLanded,
      coverage: this._coverage.cells.size / (this._coverage.cols * this._coverage.rows),
      captureLog: this._captureLog.slice(),
      wind: this._reducedMotion ? 0 : Math.round((0.4 + 0.6 * Math.abs(Math.sin(this._windPhase + performance.now() * 0.0004))) * 10) / 10,
    }
  }

  /**
   * Replace the AI-scan markers with markers for `detections`.
   * @param {Array} detections normalised AI detections
   * @param {THREE.Vector3|null} [capturePosition] drone position at capture
   */
  setAiMarkers(detections, capturePosition = null) {
    if (capturePosition) {
      this.lastCapturePosition = capturePosition.clone()
    }
    const effective = capturePosition || this.lastCapturePosition
    const result = rebuildAiMarkers(this.aiMarkerGroup, detections, effective)
    this._appearClock = 0 // restart marker appear animation
    this.selectedDetectionId = null
    return result
  }

  /**
   * Ground point under a mouse event (used for marker picking).
   * Automatically ignores clicks that were part of an orbit drag.
   * @param {{clientX: number, clientY: number}} mouseEvent
   * @returns {THREE.Vector3|null} ground intersection, or null
   */
  pickGroundPoint(mouseEvent) {
    if (this._isDragging) return null
    const rect = this.container.getBoundingClientRect()
    const ndcX = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1
    this._raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera)
    const hits = this._raycaster.intersectObject(this.groundMesh, false)
    return hits.length > 0 ? hits[0].point : null
  }

  /**
   * Highlight the AI marker for a detection id; pass null to clear.
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
   * Realistic drone aerodynamics: banking into curves, pitching forward,
   * syncing searchlights, and scaling rotor spin smoothly.
   * Delta-time normalized for 60Hz/120Hz/144Hz displays.
   * @param {number} dtMs delta time in milliseconds
   * @private
   */
  _updateDrone(dtMs = 16.67) {
    const dtFactor = dtMs / 16.6667

    // Simulated battery: below 20% the drone breaks off and returns home (RTK).
    const battery = 100 - this.missionTime * 0.1
    if (this.scanning && battery <= 20 && !this._rtkLanded) {
      this._rtkActive = true
    }

    if (this.scanning && !this._rtkActive && !this._rtkLanded) {
      this.tDrone += this.droneSpeed * dtFactor
      // Simulated mission clock: 1 capture every 5 s of flight.
      const dtSec = dtMs / 1000
      this.missionTime += dtSec
      this._captureTimer += dtSec
      if (this._captureTimer >= 5) {
        this._captureTimer = 0
        this.captures += 1
        this._captureFlash = 1 // shutter flash on each simulated capture
        const p = this.droneGroup.position
        this._captureLog.push({
          t: +this.missionTime.toFixed(1),
          x: +p.x.toFixed(1),
          z: +p.z.toFixed(1),
          alt: +p.y.toFixed(1),
        })
        if (this._captureLog.length > 8) this._captureLog.shift()
      }
    }

    // Progressive coverage: mark grid cells under the camera footprint.
    this._coverageTimer += dtMs
    if (this.scanning && !this._rtkActive && this._coverageTimer >= 150) {
      this._coverageTimer = 0
      const { cols, rows, half, cells } = this._coverage
      const px = this.droneGroup.position.x
      const pz = this.droneGroup.position.z
      const cellW = (half * 2) / cols
      const cellH = (half * 2) / rows
      const reach = Math.max(1, Math.ceil((this.droneGroup.position.y * 0.4) / Math.min(cellW, cellH)))
      const c0 = Math.floor((px + half) / cellW)
      const r0 = Math.floor((pz + half) / cellH)
      for (let dr = -reach; dr <= reach; dr++) {
        for (let dc = -reach; dc <= reach; dc++) {
          const c = c0 + dc
          const r = r0 + dr
          if (c >= 0 && c < cols && r >= 0 && r < rows) cells.add(r * cols + c)
        }
      }
    }

    // Current target position along patrol curve
    this._droneTarget = getDronePositionForPattern(this.tDrone, this._droneTarget, this.flightPattern)

    if (this._rtkLanded) {
      // Hold position on the ground after landing.
      this._droneTarget.copy(this.droneGroup.position)
    } else if (this._rtkActive) {
      // RTK: head for the home point above field centre, land when close.
      this._droneTarget.set(0, 9, 0)
      const distHome = this.droneGroup.position.distanceTo(this._droneTarget)
      if (distHome < 2.5) {
        this._rtkActive = false
        this._rtkLanded = true
        this.scanning = false
        this.droneGroup.position.y = Math.max(this.droneGroup.position.y, 2.2)
      }
    }

    // Look ahead on the trajectory to compute natural heading, pitch & banking
    let nextTarget
    if (this._rtkActive) {
      // Aim the nose toward the home point during return.
      const toHome = this._droneTarget.clone().sub(this.droneGroup.position)
      if (toHome.lengthSq() > 1e-6) {
        nextTarget = this._lookAheadTarget.copy(this.droneGroup.position)
          .addScaledVector(toHome.normalize(), 10)
      } else {
        nextTarget = getDronePositionForPattern(this.tDrone + 0.05, this._lookAheadTarget, this.flightPattern)
      }
    } else {
      const lookAheadT = this.tDrone + (this.scanning ? 0.05 : 0.001)
      nextTarget = getDronePositionForPattern(lookAheadT, this._lookAheadTarget, this.flightPattern)
    }
    const flightDir = nextTarget.clone().sub(this._droneTarget)

    // Smooth position interpolation with organic hover breathing and scroll choreography
    this._smoothScrollProgress = THREE.MathUtils.lerp(this._smoothScrollProgress, this.scrollProgress, 0.08 * dtFactor)
    this.droneGroup.position.lerp(this._droneTarget, 0.08 * dtFactor)
    const hoverOffset = Math.sin(performance.now() * 0.0025) * 0.12
    this.droneGroup.position.y += hoverOffset * 0.05 + this._smoothScrollProgress * 1.5

    // Simulated wind gusts: gentle drift on the airframe (disabled by
    // prefers-reduced-motion via setReducedMotion).
    if (!this._reducedMotion) {
      const nowMs = performance.now()
      this.droneGroup.position.x += Math.sin(nowMs * 0.0011 + this._windPhase) * 0.05 * dtFactor
      this.droneGroup.position.z += Math.cos(nowMs * 0.0009 + this._windPhase * 1.3) * 0.045 * dtFactor
    }

    // Subtle inspection scale on scroll
    const scrollScale = 1 + this._smoothScrollProgress * 0.14
    this.droneGroup.scale.set(scrollScale, scrollScale, scrollScale)

    const speed = flightDir.length()
    if (speed > 1e-4) {
      // Aerodynamic flight angles + scroll banking
      const targetYaw = Math.atan2(flightDir.x, flightDir.z) + this._smoothScrollProgress * Math.PI * 0.35
      // Pitch forward when flying forward
      const targetPitch = this.scanning ? Math.min(0.2, speed * 0.25) : 0

      // Roll banking into curves
      const yawDelta = targetYaw - this.droneGroup.rotation.y
      const normalizedYawDelta = Math.atan2(Math.sin(yawDelta), Math.cos(yawDelta))
      const targetRoll = this.scanning ? -normalizedYawDelta * 0.8 : 0

      this.droneGroup.rotation.y += normalizedYawDelta * 0.08 * dtFactor
      this.droneGroup.rotation.x = THREE.MathUtils.lerp(this.droneGroup.rotation.x, targetPitch, 0.06 * dtFactor)
      this.droneGroup.rotation.z = THREE.MathUtils.lerp(this.droneGroup.rotation.z, targetRoll, 0.06 * dtFactor)
    }

    // Flown-path trail: shift the ring left and append the live position.
    if (this.scanning && !this._rtkLanded) {
      const writeIdx = this._trailCount >= this._trailMax ? this._trailMax - 1 : this._trailCount
      if (this._trailCount >= this._trailMax) {
        this._trailPositions.copyWithin(0, 3)
      } else {
        this._trailCount += 1
      }
      const ti = writeIdx * 3
      this._trailPositions[ti] = this.droneGroup.position.x
      this._trailPositions[ti + 1] = this.droneGroup.position.y
      this._trailPositions[ti + 2] = this.droneGroup.position.z
      this._trailGeometry.setDrawRange(0, this._trailCount)
      this._trailGeometry.attributes.position.needsUpdate = true
    }

    // Camera footprint follows the drone; size scales with altitude (FOV proxy).
    this._footprint.position.x = this.droneGroup.position.x
    this._footprint.position.z = this.droneGroup.position.z
    const fp = Math.max(2, this.droneGroup.position.y * 0.85)
    this._footprint.scale.set(fp, fp * 0.75, 1)
    this._footprint.material.opacity = this.scanning ? 0.10 : 0.05

    // Shutter flash decay
    this._captureFlash = Math.max(0, this._captureFlash - dtFactor * 0.12)
    this._captureLight.position.copy(this.droneGroup.position)
    this._captureLight.position.y += 0.5
    this._captureLight.intensity = this._captureFlash * 5

    // Synchronize inspection searchlight
    if (this.droneSpotLight) {
      this.droneSpotLight.position.copy(this.droneGroup.position)
      this.droneSpotLight.position.y += DRONE.lightOffsetY || -0.5
      this.droneSpotLight.target.position.set(
        this.droneGroup.position.x,
        0,
        this.droneGroup.position.z
      )
    }

    // Synchronize fill & point lights
    if (this.droneLight) {
      this.droneLight.position.copy(this.droneGroup.position)
      this.droneLight.position.y += -1.5
    }

    if (this.droneFillLight) {
      this.droneFillLight.position.copy(this.droneGroup.position)
      this.droneFillLight.position.y += 2.0
    }

    // Rotor animations
    if (this.droneGroup.userData.mixer) {
      // Scale GLB animation: active flight (1.4x) vs gentle idle hover (0.08x)
      const timeScale = this.scanning ? 1.4 : 0.08
      if (this.droneGroup.userData.action) {
        this.droneGroup.userData.action.setEffectiveTimeScale(timeScale)
      }
      this.droneGroup.userData.mixer.update(dtMs / 1000)
    } else if (this.rotors) {
      const spin = this.scanning ? DRONE.rotorSpinActive : DRONE.rotorSpinIdle
      this.rotors.forEach(r => { r.rotation.y += spin * dtFactor })
    }
  }

  /** Camera tracking, disease pulses, simulated time-of-day. @private */
  _updateCameraAndEffects(dtMs = 16.67) {
    const dtFactor = dtMs / 16.6667
    this.pulseT += 0.04 * dtFactor

    // Simulated time-of-day: sun orbits once per ~4 min, driving light
    // intensity/colour. Cosmetic only — no real clock is implied.
    this._dayT = (this._dayT + dtMs / 240000) % 1
    const a = this._dayT * Math.PI * 2
    const elev = Math.sin(a)
    const daylight = THREE.MathUtils.clamp(elev * 1.4 + 0.4, 0.06, 1)
    this.sun.position.set(Math.cos(a) * 60, Math.max(6, elev * 55 + 18), 30)
    this.sun.intensity = 0.35 + daylight * 2.5
    this.sun.color.setHSL(0.09 + daylight * 0.04, 0.55 - daylight * 0.25, 0.55 + daylight * 0.15)
    this.hemiLight.intensity = 0.22 + daylight * 0.55
    this.ambientLight.intensity = 0.12 + daylight * 0.3

    // Animate demo disease zones (skipped for reduced-motion users)
    if (!this._reducedMotion) {
      this.diseaseGroup.children.forEach(child => {
        if (child.userData.isPulse) {
          const scale = 1 + Math.sin(this.pulseT) * 0.3
          child.scale.setScalar(scale)
          child.material.opacity = (0.5 + Math.sin(this.pulseT) * 0.3) * Math.max(0, 1 - (scale - 1) * 2)
        }
      })

      // Animate AI detection marker pulses in sync
      this.aiMarkerGroup.children.forEach(marker => {
        const pulse = marker.userData.pulse
        if (pulse && pulse.userData.isPulse) {
          const scale = 1 + Math.sin(this.pulseT) * 0.3
          pulse.scale.setScalar(scale)
          pulse.material.opacity = (0.5 + Math.sin(this.pulseT) * 0.3) * Math.max(0, 1 - (scale - 1) * 2)
        }
      })
    }

    // Follow drone smoothly if active
    if (this.cameraMode === 'drone') {
      this.controls.target.lerp(this.droneGroup.position, 0.08 * dtFactor)
    }

    // FPV: camera rides just behind/above the drone, looking along its flight
    // direction (derived from the same look-ahead used for banking).
    if (this.cameraMode === 'fpv') {
      const p = this.droneGroup.position
      const dir = this._lookAheadTarget.clone().sub(p)
      if (dir.lengthSq() > 1e-6) dir.normalize()
      this.camera.position.set(p.x - dir.x * 3, p.y + 1.4, p.z - dir.z * 3)
      this.camera.lookAt(p.x + dir.x * 30, p.y - 3, p.z + dir.z * 30)
    }

    this.controls.update()
  }

  /** Render loop. @private */
  _animate() {
    if (this._disposed) return

    // Off-screen: stop loop to save CPU & GPU completely
    if (!this._visible) {
      this._lastFrameTime = performance.now()
      this._rafId = null
      return
    }

    this._rafId = requestAnimationFrame(this._animate)

    // Accurate, clamped delta time
    const now = performance.now()
    if (this._lastFrameTime === null) this._lastFrameTime = now
    const dtMs = Math.min(now - this._lastFrameTime, 100)
    this._lastFrameTime = now
    this._appearClock += dtMs

    if (this.aiMarkerGroup.children.length > 0) {
      updateAppearAnimations(this.aiMarkerGroup, this._appearClock)
    }

    this._updateDrone(dtMs)
    this._updateCameraAndEffects(dtMs)

    if (this.onBeforeRender) this.onBeforeRender(this)

    this.renderer.render(this.scene, this.camera)
  }

  /** Debounced resize handling with adaptive mobile framing. @private */
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
      const aspect = W / H
      this.camera.aspect = aspect
      // Dynamic FOV: increase vertical FOV on tall portrait mobile screens so full field is visible
      this.camera.fov = aspect < 1.0 ? 64 : 55
      this.camera.updateProjectionMatrix()

      const isMobile = W < 768
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2))
      this.renderer.setSize(W, H)
      this._resizePending = false
    })
  }

  /**
   * Full teardown: releases GPU buffers (geometries, materials, textures,
   * shadow maps), removes listeners, and disposes OrbitControls. Safe to call twice.
   */
  dispose() {
    if (this._disposed) return
    this._disposed = true

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId)
      this._rafId = null
    }

    if (this._resizeObserver) this._resizeObserver.disconnect()
    if (this._intersectionObserver) this._intersectionObserver.disconnect()

    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown)
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove)

    if (this.controls) {
      this.controls.dispose()
      this.controls = null
    }

    if (this.droneGroup.userData.mixer) {
      this.droneGroup.userData.mixer.stopAllAction()
    }

    if (this.envMap) {
      this.scene.environment = null
      this.envMap.dispose()
      this.envMap = null
    }

    if (this.sun && this.sun.shadow && this.sun.shadow.map) {
      this.sun.shadow.map.dispose()
    }

    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => {
          if (m.map) m.map.dispose()
          m.dispose()
        })
      }
    })

    this.renderer.dispose()
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
