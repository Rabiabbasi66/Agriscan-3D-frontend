import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('AgriScan 3D view failed to render:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="agri-card flex flex-col items-center justify-center gap-3 p-8 text-center"
          style={{ minHeight: '320px', color: 'var(--muted-foreground)' }}
          role="alert"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--foreground)' }}>
            3D view could not load
          </div>
          <div style={{ fontSize: '13px', maxWidth: '320px' }}>
            {this.props.fallbackMessage || 'Your browser may not support WebGL, or the graphics driver failed. The rest of the app still works.'}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
