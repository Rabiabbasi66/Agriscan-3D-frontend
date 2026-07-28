import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const DISEASE_ZONES = [
  { x: -18, z: -12, radius: 6, label: 'Leaf Blight', severity: 'high' },
  { x: 22, z: 8, radius: 4.5, label: 'Powdery Mildew', severity: 'medium' },
  { x: 5, z: 20, radius: 5, label: 'Root Rot', severity: 'high' },
  { x: -8, z: 16, radius: 3.5, label: 'Rust', severity: 'low' },
]

function buildScene() {
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

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120, 60, 60),
    new THREE.MeshLambertMaterial({ color: 0x0a1a0a, wireframe: false })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const grid = new THREE.GridHelper(120, 30, 0x1a3a1a, 0x112211)
  grid.position.y = 0.02
  scene.add(grid)

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
  scene.add(cropGroup)

  const diseaseGroup = new THREE.Group()
  DISEASE_ZONES.forEach(zone => {
    const color = zone.severity === 'high' ? 0xff2020 : zone.severity === 'medium' ? 0xff6020 : 0xffaa20
    
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
  scene.add(diseaseGroup)

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
  scene.add(droneGroup)

  return { scene, droneGroup, diseaseGroup, droneLight }
}

function getDronePosition(t) {
  const scale = 22
  const x = Math.sin(t) * scale
  const z = Math.sin(t * 2) * scale * 0.5
  const y = 10 + Math.sin(t * 3) * 1.5
  return new THREE.Vector3(x, y, z)
}

export default function FarmViewer3D() {
  const mountRef = useRef(null)
  const [webgpu, setWebgpu] = useState(null)
  const [scanning, setScanning] = useState(true)
  const [droneSpeed, setDroneSpeed] = useState(0.004)
  const scanningRef = useRef(true)
  const speedRef = useRef(0.004)

  useEffect(() => {
    if ('gpu' in navigator) {
      setWebgpu(true)
    } else {
      setWebgpu(false)
    }
  }, [])

  useEffect(() => {
    scanningRef.current = scanning
  }, [scanning])

  useEffect(() => {
    speedRef.current = droneSpeed
  }, [droneSpeed])

  useEffect(() => {
    if (!mountRef.current) return
    const container = mountRef.current
    const W = container.clientWidth
    const H = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    const { scene, droneGroup, diseaseGroup, droneLight } = buildScene()

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500)
    camera.position.set(45, 38, 55)
    camera.lookAt(0, 0, 0)

    let orbitAngle = 0
    let tDrone = 0
    let pulseT = 0
    let resizing = false

    const rotors = droneGroup.userData.rotors

    const animate = () => {
      const raf = requestAnimationFrame(animate)
      container.userData = { raf }

      if (scanningRef.current) {
        tDrone += speedRef.current
      }
      orbitAngle += 0.0006
      pulseT += 0.04

      const camR = 65
      camera.position.x = Math.cos(orbitAngle) * camR
      camera.position.z = Math.sin(orbitAngle) * camR
      camera.position.y = 38 + Math.sin(orbitAngle * 0.3) * 4
      camera.lookAt(0, 2, 0)

      const newPos = getDronePosition(tDrone)
      droneGroup.position.lerp(newPos, 0.08)
      droneGroup.rotation.y = -tDrone + Math.PI

      droneLight.position.copy(droneGroup.position)
      droneLight.position.y -= 3

      rotors.forEach(r => { r.rotation.y += scanningRef.current ? 0.5 : 0.05 })

      diseaseGroup.children.forEach(child => {
        const mesh = child
        if (mesh.userData.isPulse) {
          const mat = mesh.material
          const scale = 1 + Math.sin(pulseT) * 0.3
          mesh.scale.setScalar(scale)
          mat.opacity = (0.5 + Math.sin(pulseT) * 0.3) * Math.max(0, 1 - (scale - 1) * 2)
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      if (resizing) return
      resizing = true
      requestAnimationFrame(() => {
        const nW = container.clientWidth
        const nH = container.clientHeight
        camera.aspect = nW / nH
        camera.updateProjectionMatrix()
        renderer.setSize(nW, nH)
        resizing = false
      })
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    return () => {
      const raf = container.userData?.raf
      if (raf) cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full" id="overview">
      <div ref={mountRef} className="w-full h-full" />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,255,20,0.012) 2px, rgba(57,255,20,0.012) 4px)',
        }}
      />

      {[['top-3 left-3', 'border-t border-l'], ['top-3 right-3', 'border-t border-r'], ['bottom-3 left-3', 'border-b border-l'], ['bottom-3 right-3', 'border-b border-r']].map(([pos, brd], i) => (
        <div key={i} className={`absolute ${pos} w-8 h-8 ${brd} pointer-events-none`} style={{ borderColor: '#39ff14', opacity: 0.6 }} />
      ))}

      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <div className="agri-card px-3 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-blink" style={{ background: scanning ? '#39ff14' : '#666' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.1em' }}>
            {scanning ? 'SCANNING ACTIVE' : 'PAUSED'}
          </span>
        </div>
        <div className="agri-card px-3 py-1.5">
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6b9b6b', letterSpacing: '0.08em' }}>
            ALT: <span style={{ color: '#e8f5e8' }}>10.2m</span>
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-4">
        <div className="agri-card px-2.5 py-1 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: webgpu ? '#39ff14' : '#6b9b6b' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: webgpu ? '#39ff14' : '#6b9b6b', letterSpacing: '0.08em' }}>
            {webgpu === null ? 'DETECTING...' : webgpu ? 'WEBGPU ON' : 'WEBGL MODE'}
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
        {[{ color: '#ff2020', label: 'High Severity' }, { color: '#ff6020', label: 'Medium' }, { color: '#ffaa20', label: 'Low Severity' }].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: item.color, background: item.color + '33' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.06em' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 right-4 flex items-center gap-3">
        <button
          onClick={() => setScanning(s => !s)}
          className="agri-card px-3 py-1.5 text-xs font-semibold transition-all duration-200"
          style={{ fontFamily: 'sans-serif', letterSpacing: '0.08em', color: scanning ? '#39ff14' : '#6b9b6b', fontSize: '12px' }}
        >
          {scanning ? '⏸ PAUSE' : '▶ RESUME'}
        </button>
        <div className="agri-card px-3 py-1.5 flex items-center gap-2">
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>SPEED</span>
          <input
            type="range"
            min={0.001}
            max={0.012}
            step={0.001}
            value={droneSpeed}
            onChange={e => setDroneSpeed(Number(e.target.value))}
            className="w-20 accent-green-400"
            style={{ accentColor: '#39ff14' }}
          />
        </div>
      </div>

      <div className="absolute top-4 left-4 agri-card p-3 max-w-44">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full animate-blink" style={{ background: '#ff3030' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff3030', letterSpacing: '0.08em' }}>4 ZONES DETECTED</span>
        </div>
        {DISEASE_ZONES.slice(0, 2).map(z => (
          <div key={z.label} className="flex items-center justify-between mt-1">
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b' }}>{z.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: z.severity === 'high' ? '#ff2020' : '#ff6020', letterSpacing: '0.05em' }}>{z.severity.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}