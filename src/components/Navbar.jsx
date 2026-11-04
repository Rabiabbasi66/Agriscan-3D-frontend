import React from 'react'

/**
 * Fixed top navigation. It must stay a plain nav bar: re-exporting the 3D
 * viewer from here would mount a second WebGL context and render loop.
 */
const LINKS = [
  { label: 'Overview', href: '#overview' },
  { label: 'Scanner', href: '#image-scanner' },
  { label: 'History', href: '#prediction-history' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'Team', href: '#team' },
]

export default function Navbar() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        height: '64px',
        background: 'rgba(6, 13, 6, 0.82)',
        borderBottom: '1px solid #1c3a1c',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <nav className="h-full container-center flex items-center justify-between gap-4">
        <a
          href="#overview"
          className="font-display shrink-0"
          style={{
            color: '#e8f5e8',
            fontSize: 'clamp(15px, 4.4vw, 18px)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
          }}
        >
          AGRI<span style={{ color: '#39ff14' }}>SCAN</span>
          <span style={{ color: '#6b9b6b', fontSize: '13px' }}> 3D</span>
        </a>

        <div className="flex items-center gap-3 sm:gap-7 shrink-0">
          {LINKS.map((link, index) => (
            <a
              key={link.href}
              href={link.href}
              className={index > 2 ? 'hidden md:inline' : index === 2 ? 'hidden sm:inline' : 'inline'}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#6b9b6b',
              }}
              onMouseEnter={(event) => { event.currentTarget.style.color = '#39ff14' }}
              onMouseLeave={(event) => { event.currentTarget.style.color = '#6b9b6b' }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  )
}
