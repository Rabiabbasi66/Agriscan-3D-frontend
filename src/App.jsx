import React from 'react'
import Navbar from './components/Navbar'
import FarmViewer3D from './components/FarmViewer3D'
import StatsCards from './components/StatsCards'
import ScanDashboard from './components/ScanDashboard'
import ImageScanner from './components/ImageScanner'
import FieldHealthMap from './components/FieldHealthMap'
import TeamSection from './components/TeamSection'

function HeroSection() {
  return (
    <div className="hero-wrapper">
      {/* Background 3D Layer */}
      <div className="absolute inset-0 pt-16">
        <FarmViewer3D />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col justify-end h-full pb-16 px-4 md:px-8 pointer-events-none container-center">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.2)' }}>
              <span className="w-2 h-2 rounded-full animate-blink" style={{ background: '#39ff14' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.1em' }}>
                AI-POWERED CROP MONITORING
              </span>
            </div>
          </div>

          <h1 className="font-display font-700 leading-none mb-4" style={{ fontSize: 'clamp(44px, 8vw, 88px)', color: '#e8f5e8', letterSpacing: '-0.01em' }}>
            AGRI
            <span style={{ color: '#39ff14' }}>SCAN</span>
            {' '}
            <span style={{ color: '#39ff14', textShadow: '0 0 30px rgba(57,255,20,0.5)' }}>3D</span>
          </h1>

          <p className="text-base max-w-xl mb-6" style={{ color: 'rgba(232,245,232,0.7)', lineHeight: '1.65', fontSize: '15px' }}>
            Virtual drone flyover with YOLOv8 AI detection. Identify diseased crops in real time,
            mapped to precise 3D coordinates — so farmers act fast, save yields, cut losses.
          </p>

          <div className="flex items-center gap-4 pointer-events-auto">
            <button
              className="px-6 py-3 rounded font-display font-700 tracking-widest text-sm transition-all duration-200"
              style={{ background: '#39ff14', color: '#060d06', fontSize: '13px', letterSpacing: '0.1em' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 30px rgba(57,255,20,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
            >
              START SCAN
            </button>
            <a
              href="#analytics"
              className="px-6 py-3 rounded font-display font-700 tracking-widest text-sm transition-all duration-200"
              style={{ border: '1px solid rgba(57,255,20,0.3)', color: '#39ff14', fontSize: '13px', letterSpacing: '0.1em' }}
            >
              VIEW REPORT
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <div className="w-px h-10" style={{ background: 'linear-gradient(to bottom, transparent, rgba(57,255,20,0.4))' }} />
        <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(57,255,20,0.5)', letterSpacing: '0.12em' }}>
          SCROLL
        </span>
      </div>
    </div>
  )
}

function TechBanner() {
  const items = [
    { label: 'AI Engine', value: 'YOLOv8' },
    { label: '3D Renderer', value: 'Three.js' },
    { label: 'GPU Compute', value: 'WebGPU' },
    { label: 'Backend', value: 'FastAPI' },
    { label: 'Frontend', value: 'React 19' },
    { label: 'Detection', value: 'Real-time' },
    { label: 'Accuracy', value: '97.3%' },
    { label: 'Latency', value: '< 340ms' },
  ]

  return (
    <div className="w-full overflow-hidden border-y border-[#1c3a1c] bg-[#122012] py-3">
      <div className="flex items-center gap-10 animate-[scroll_20s_linear_infinite]" style={{ width: 'max-content' }}>
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-6 shrink-0">
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {item.label}
            </span>
            <span style={{ fontFamily: 'sans-serif', fontSize: '13px', color: '#39ff14', fontWeight: 700, letterSpacing: '0.06em' }}>
              {item.value}
            </span>
            <span style={{ color: '#1c3a1c' }}>·</span>
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
    <footer className="py-12 px-6 border-t border-[#1c3a1c]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="font-display text-xl font-700 tracking-wider mb-1" style={{ color: '#e8f5e8' }}>
            AGRI<span style={{ color: '#39ff14' }}>SCAN</span> <span style={{ color: '#6b9b6b', fontSize: '14px' }}>3D</span>
          </div>
          <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6b9b6b', letterSpacing: '0.06em' }}>
            AI-powered crop disease detection · YOLOv8 + Three.js + WebGPU
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
          {['Overview', 'Field Map', 'Detections', 'Analytics', 'Team'].map((l) => (
            <a 
              key={l} 
              href={`#${l.toLowerCase().replace(' ', '-')}`} 
              style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6b9b6b', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {l}
            </a>
          ))}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.06em' }}>
          Frontend · 3D · Backend · AI
        </div>
      </div>
    </footer>
  )
}

export default function App() {
  return (
    <div style={{ background: '#060d06', minHeight: '100vh' }}>
      <Navbar />
      
      {/* Hero is full width, no container needed inside */}
      <HeroSection />
      
      {/* Other sections wrapped in container-center to keep them tidy */}
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
          <ScanDashboard />
        </div>
      </section>

      <section className="page-section">
        <div className="container-center">
          <ImageScanner />
        </div>
      </section>

      <section className="page-section">
        <div className="container-center">
          <FieldHealthMap />
        </div>
      </section>

      <section className="page-section">
        <div className="container-center">
          <TeamSection />
        </div>
      </section>

      <Footer />
    </div>
  )
}