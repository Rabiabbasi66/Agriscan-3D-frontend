import React, { useState, useEffect, lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import FarmViewer3D from './components/FarmViewer3D'
import StatsCards from './components/StatsCards'
import ScanDashboard from './components/ScanDashboard'
import ImageScanner from './components/ImageScanner'
import PredictionHistory from './components/PredictionHistory'
import FieldHealthMap from './components/FieldHealthMap'
const TeamSection = lazy(() => import('./components/TeamSection'))
import ErrorBoundary from './components/ErrorBoundary'
import FieldAnalytics from './components/FieldAnalytics'
import LoadingScreen from './components/LoadingScreen'
import SupportedCrops from './components/SupportedCrops'
import { AuthProvider } from './context/AuthContext'
import { normalizePrediction } from './services/api'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

function HeroSection({ detections = null, selectedDetectionId = null, onDetectionSelect = null, scrollProgress = 0, flightPattern = 'lissajous', missionSpeed = null, missionRunning = null }) {
  return (
    <div className="hero-wrapper" id="overview">
      {/* Ambient aurora glows behind the 3D scene */}
      <div className="aurora-blob aurora-1" aria-hidden="true" />
      <div className="aurora-blob aurora-2" aria-hidden="true" />
      <div className="aurora-blob aurora-3" aria-hidden="true" />
      <div className="absolute inset-0 pt-16">
        <ErrorBoundary>
          <FarmViewer3D
            detections={detections}
            selectedDetectionId={selectedDetectionId}
            onSelectionChange={onDetectionSelect}
            scrollProgress={scrollProgress}
            flightPattern={flightPattern}
            missionSpeed={missionSpeed}
            missionRunning={missionRunning}
          />
        </ErrorBoundary>
      </div>

      <div
        className="relative z-10 flex flex-col justify-end h-full pb-14 md:pb-16 px-4 md:px-8 pointer-events-none container-center hero-content"
        style={{ ['--scroll-p']: scrollProgress }}
      >
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-3 md:mb-4 hero-enter hero-enter-1">
            <div className="glass-panel flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ border: '1px solid var(--border)' }}>
              <span className="w-2 h-2 rounded-full animate-blink" style={{ background: 'var(--primary)' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--primary)', letterSpacing: '0.1em' }}>
                AI-POWERED CROP MONITORING
              </span>
            </div>
          </div>

          <h1 className="font-display font-700 leading-none mb-3 md:mb-4 hero-enter hero-enter-2" style={{ fontSize: 'clamp(38px, 7.5vw, 84px)', color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
            AGRI
            <span style={{ color: 'var(--primary)' }}>SCAN</span>
            {' '}
            <span style={{ color: 'var(--primary)', textShadow: '0 0 25px rgba(57,255,20,0.45)' }}>3D</span>
          </h1>

          <p className="text-sm md:text-base max-w-xl mb-5 md:mb-6 hero-enter hero-enter-3" style={{ color: 'var(--card-foreground)', lineHeight: '1.6', opacity: 0.9 }}>
            Autonomous drone flyover with YOLOv8 real-time AI disease detection. Pinpoint crop pathologies mapped directly to 3D field coordinates.
          </p>

          <div className="flex flex-wrap items-center gap-3 md:gap-4 pointer-events-auto hero-enter hero-enter-4">
            <button
              className="btn-shine px-5 py-2.5 md:px-6 md:py-3 rounded font-display font-700 tracking-wider text-xs md:text-sm transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', letterSpacing: '0.08em' }}
              onClick={() => document.getElementById('image-scanner')?.scrollIntoView({ behavior: 'smooth' })}
            >
              START AI SCAN
            </button>
            <a
              href="#analytics"
              className="glass-panel px-5 py-2.5 md:px-6 md:py-3 rounded font-display font-700 tracking-wider text-xs md:text-sm transition-all duration-200 hover:border-green-400"
              style={{ color: 'var(--primary)', letterSpacing: '0.08em' }}
            >
              VIEW ANALYTICS
            </a>
          </div>
        </div>
      </div>

      <div className="hidden sm:flex absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex-col items-center gap-2 pointer-events-none opacity-60">
        <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, transparent, var(--primary))' }} />
        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted-foreground)', letterSpacing: '0.12em' }}>
          SCROLL TO EXPLORE
        </span>
      </div>
    </div>
  )
}

function TechBanner() {
  const items = [
    { label: 'AI Engine', value: 'YOLOv8' },
    { label: '3D Renderer', value: 'Three.js r160' },
    { label: 'WebGL', value: 'Active' },
    { label: 'Backend API', value: 'FastAPI' },
    { label: 'Frontend', value: 'React 18' },
    { label: 'Latency', value: '< 340ms' },
    { label: 'Detection Accuracy', value: '97.3%' },
    { label: 'Telemetry', value: 'Nadir Pinhole' },
  ]

  return (
    <div className="w-full overflow-hidden border-y py-3 transition-colors duration-300" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="flex items-center gap-8 md:gap-10 animate-[scroll_22s_linear_infinite]" style={{ width: 'max-content' }}>
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-4 md:gap-6 shrink-0">
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {item.label}
            </span>
            <span style={{ fontFamily: 'sans-serif', fontSize: '13px', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
              {item.value}
            </span>
            <span style={{ color: 'var(--border)' }}>·</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t transition-colors duration-300" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="font-display text-xl font-700 tracking-wider mb-1" style={{ color: 'var(--foreground)' }}>
            AGRI<span style={{ color: 'var(--primary)' }}>SCAN</span> <span style={{ color: 'var(--muted-foreground)', fontSize: '14px' }}>3D</span>
          </div>
          <p className="max-w-md" style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em', lineHeight: 1.6, overflowWrap: 'break-word' }}>
            Final Year Project · AgriScan 3D: WebGL-Based Virtual Drone Crop Mapping with AI-Powered Disease Detection
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-8">
          {[
            ['Overview', '#overview'],
            ['Scanner', '#image-scanner'],
            ['History', '#prediction-history'],
            ['Analytics', '#analytics'],
            ['Crops', '#supported-crops'],
            ['Team', '#team'],
          ].map(([l, href]) => (
            <a
              key={l}
              href={href}
              style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
              className="hover:text-green-500 transition-colors"
            >
              {l}
            </a>
          ))}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.06em' }}>
          Three.js · WebGL · YOLOv8 · FastAPI
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(15)
  const [aiDetections, setAiDetections] = useState(null)
  const [selectedDetectionId, setSelectedDetectionId] = useState(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [missionConfig, setMissionConfig] = useState({ speed: 4, pattern: 'lissajous', running: true })
  const sectionsRef = React.useRef(null)

  // Initialize GSAP ScrollTrigger
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    // Scroll-reveal animations for all sections
    if (sectionsRef.current) {
      const sections = sectionsRef.current.querySelectorAll('.page-section')
      sections.forEach((section, index) => {
        gsap.fromTo(
          section,
          { opacity: 0, y: 60 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
            delay: index * 0.05,
          }
        )
      })
    }

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill())
    }
  }, [])

  // Card sheen: track cursor position over .agri-card for the radial hover glow.
  useEffect(() => {
    let active = null
    const onMove = (e) => {
      const card = e.target.closest?.('.agri-card') || null
      if (card === active) {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
        card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
        return
      }
      if (active) { active.style.setProperty('--mx', '50%'); active.style.setProperty('--my', '50%') }
      active = card
      if (active) {
        const r = active.getBoundingClientRect()
        active.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
        active.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  // Track scroll progress for hero section
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? scrollTop / docHeight : 0
      setScrollProgress(progress)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Smooth progress simulation while GLB models and 3D scenes initialize
    let current = 15
    const interval = setInterval(() => {
      current += Math.random() * 22 + 8
      if (current >= 100) {
        current = 100
        setLoadProgress(100)
        clearInterval(interval)
        setTimeout(() => setLoading(false), 450)
      } else {
        setLoadProgress(Math.min(99, Math.round(current)))
      }
    }, 180)
    return () => clearInterval(interval)
  }, [])

  const handleScanComplete = (rawResult) => {
    setAiDetections(rawResult ? normalizePrediction(rawResult) : null)
    setSelectedDetectionId(null)
    if (rawResult) {
      window.dispatchEvent(new CustomEvent('agriscan:scan-complete', { detail: rawResult }))
    }
  }

  return (
    <AuthProvider>
      <div style={{ background: 'var(--background)', minHeight: '100vh', transition: 'background-color 0.3s ease' }}>
        <LoadingScreen visible={loading} progress={loadProgress} />
        <Navbar />

        <HeroSection
          detections={aiDetections}
          selectedDetectionId={selectedDetectionId}
          onDetectionSelect={setSelectedDetectionId}
          scrollProgress={scrollProgress}
          flightPattern={missionConfig.pattern}
          missionSpeed={missionConfig.speed}
          missionRunning={missionConfig.running}
        />

        {/* Scroll-reveal sections */}
        <div ref={sectionsRef}>
          <section className="page-section">
            <div className="container-center">
              <TechBanner />
            </div>
          </section>

          <section className="page-section">
            <div className="container-center">
              <StatsCards />
            </div>
          </section>

          <section className="page-section">
            <div className="container-center">
              <ScanDashboard
                onConfigChange={(c) => setMissionConfig(prev => ({ ...prev, ...c }))}
                onRunningChange={(r) => setMissionConfig(prev => ({ ...prev, running: r }))}
              />
            </div>
          </section>

          <section id="image-scanner" className="page-section">
            <div className="container-center">
              <ImageScanner
                onScanComplete={handleScanComplete}
                onDetectionSelect={setSelectedDetectionId}
                selectedDetectionId={selectedDetectionId}
              />
            </div>
          </section>

          <section id="prediction-history" className="page-section">
            <div className="container-center">
              <PredictionHistory />
            </div>
          </section>

          <section id="analytics" className="page-section">
            <div className="container-center">
              <FieldAnalytics onDetectionSelect={setSelectedDetectionId} />
            </div>
          </section>

          <section className="page-section">
            <div className="container-center">
              <FieldHealthMap />
            </div>
          </section>

          <SupportedCrops />

          <section id="team" className="page-section">
            <div className="container-center">
              <Suspense fallback={<div className="agri-card p-8 text-center" style={{ color: 'var(--muted-foreground)', fontFamily: 'monospace', fontSize: '12px' }}>LOADING TEAM…</div>}>
                <TeamSection />
              </Suspense>
            </div>
          </section>
        </div>

        <Footer />
      </div>
    </AuthProvider>
  )
}
