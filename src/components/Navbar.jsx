import React, { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const LINKS = [
  { label: 'Overview', href: '#overview' },
  { label: 'Scanner', href: '#image-scanner' },
  { label: 'History', href: '#prediction-history' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'Crops', href: '#supported-crops' },
  { label: 'Team', href: '#team' },
]

export default function Navbar() {
  const { isDark, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: 'var(--navbar-bg)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <nav className="container-center flex items-center justify-between gap-4" style={{ height: 64 }}>
        {/* Logo */}
        <a
          href="#overview"
          className="font-display shrink-0 flex items-center gap-1.5"
          style={{
            color: 'var(--foreground)',
            fontSize: 'clamp(16px, 4.2vw, 19px)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />
          AGRI<span style={{ color: 'var(--primary)' }}>SCAN</span>
          <span style={{ color: 'var(--muted-foreground)', fontSize: '13px', fontWeight: 600 }}> 3D</span>
        </a>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-7">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--muted-foreground)',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted-foreground)' }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Actions (Theme Toggle & Mobile Menu) */}
        <div className="flex items-center gap-2">
          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="glass-panel p-2 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ color: 'var(--primary)', width: 38, height: 38 }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? (
              /* Sun icon for light mode toggle */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              /* Moon icon for dark mode toggle */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Quick Scanner Action Button */}
          <a
            href="#image-scanner"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all duration-200"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              letterSpacing: '0.04em',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            SCAN NOW
          </a>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden glass-panel p-2 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{ color: 'var(--muted-foreground)', width: 38, height: 38 }}
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Dropdown */}
      {mobileOpen && (
        <div
          className="md:hidden glass-panel mx-3 mb-3 p-4 animate-slide-down flex flex-col gap-3"
          style={{
            border: '1px solid var(--border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          }}
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="px-3 py-2 rounded-md font-mono text-xs uppercase tracking-wider transition-colors"
              style={{
                color: 'var(--foreground)',
                background: 'rgba(57,255,20,0.04)',
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#image-scanner"
            onClick={() => setMobileOpen(false)}
            className="w-full mt-1 py-2.5 text-center font-mono text-xs font-bold uppercase tracking-wider rounded-md"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
            }}
          >
            START AI CROP SCAN
          </a>
        </div>
      )}
    </header>
  )
}
