import React from 'react'

export default function LoadingScreen({ visible = true, progress = 0 }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--on-neon)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* High-tech drone scan ring animation */}
      <div style={{ position: 'relative', width: 90, height: 90 }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(57,255,20,0.15)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 4,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'var(--neon-green)',
            animation: 'loader-spin 1s linear infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 12,
            borderRadius: '50%',
            border: '1.5px solid transparent',
            borderBottomColor: 'rgba(57,255,20,0.45)',
            animation: 'loader-spin 1.8s linear infinite reverse',
          }}
        />
        {/* Center Drone Quadcopter SVG Icon */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'loader-hover 2.4s ease-in-out infinite',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" style={{ stroke: 'var(--neon-green)' }}>
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="7" />
            <line x1="12" y1="17" x2="12" y2="22" />
            <line x1="2" y1="12" x2="7" y2="12" />
            <line x1="17" y1="12" x2="22" y2="12" />
            <circle cx="12" cy="2" r="1.5" />
            <circle cx="12" cy="22" r="1.5" />
            <circle cx="2" cy="12" r="1.5" />
            <circle cx="22" cy="12" r="1.5" />
          </svg>
        </div>
      </div>

      {/* Brand title */}
      <div style={{ textAlign: 'center', padding: '0 1rem' }}>
        <h1
          className="font-display"
          style={{
            fontSize: 'clamp(28px, 6vw, 36px)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'var(--term-text)',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          AGRI<span style={{ color: 'var(--neon-green)' }}>SCAN</span>{' '}
          <span style={{ color: 'var(--neon-green)', textShadow: '0 0 25px rgba(57,255,20,0.6)' }}>3D</span>
        </h1>
        <p
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 'clamp(9px, 2.4vw, 11px)',
            color: 'var(--icon-muted)',
            letterSpacing: '0.12em',
            marginTop: 10,
            textTransform: 'uppercase',
            lineHeight: 1.7,
            maxWidth: 'min(560px, 88vw)',
          }}
        >
          WebGL-Based Virtual Drone<br />
          Crop Mapping with AI-Powered Disease Detection
        </p>
      </div>

      {/* Progress Bar & Status */}
      <div style={{ width: 'min(260px, 80vw)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: '100%',
            height: 4,
            background: 'rgba(57,255,20,0.12)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--neon-green), #22c55e)',
              borderRadius: 3,
              transition: 'width 0.25s ease-out',
              boxShadow: '0 0 10px rgba(57,255,20,0.5)',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 2px' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              color: 'var(--icon-muted)',
              letterSpacing: '0.08em',
            }}
          >
            {progress < 40 ? 'INITIALIZING ENGINE' : progress < 85 ? 'PRELOADING 3D GLB ASSETS' : 'CALIBRATING SENSORS'}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '10px',
              color: 'var(--neon-green)',
              fontWeight: 600,
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <style>{`
        @keyframes loader-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes loader-hover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
