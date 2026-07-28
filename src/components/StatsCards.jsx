import React, { useEffect, useState } from 'react'

function AnimatedNumber({ target, suffix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / 60
    const interval = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(interval) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(interval)
  }, [target])
  return <>{val.toLocaleString()}{suffix}</>
}

const STATS = [
  {
    label: 'Field Health Score',
    value: '84.2',
    sub: 'Overall crop vitality index',
    trend: '+2.4% vs last scan',
    trendUp: true,
    accent: '#39ff14',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l-2 2m2-2 2 2M3 12h18" />
      </svg>
    ),
  },
  {
    label: 'Diseased Zones',
    value: '4',
    sub: 'Across 3 field sectors',
    trend: '+1 since yesterday',
    trendUp: false,
    accent: '#ff3030',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
        <path strokeLinecap="round" strokeWidth={1.5} d="M12 8v4m0 4h.01" />
      </svg>
    ),
  },
  {
    label: 'Area Scanned',
    value: '142',
    sub: 'Hectares this session',
    trend: '93% of total field',
    trendUp: true,
    accent: '#39ff14',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ),
  },
  {
    label: 'AI Confidence',
    value: '97.3',
    sub: 'YOLOv8 detection accuracy',
    trend: '1,204 images processed',
    trendUp: true,
    accent: '#a78bfa',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    label: 'Drone Battery',
    value: '73',
    sub: 'Estimated 41 min remaining',
    trend: 'Charging in 8 hrs',
    trendUp: true,
    accent: '#facc15',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    label: 'Scan Sessions',
    value: '28',
    sub: 'This month',
    trend: '+6 vs last month',
    trendUp: true,
    accent: '#39ff14',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
]

export default function StatsCards() {
  return (
    <section className="py-16 px-6 max-w-7xl mx-auto" id="analytics">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-px" style={{ background: '#39ff14' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#39ff14', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Real-time Analytics</span>
        </div>
        <h2 className="font-display text-4xl font-700 tracking-wide" style={{ color: '#e8f5e8' }}>
          Field Intelligence Dashboard
        </h2>
        <p className="mt-2 text-base" style={{ color: '#6b9b6b' }}>
          Live metrics from the ongoing YOLOv8 aerial scan — updated every 8 seconds.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {STATS.map((stat, i) => (
          <div
            key={stat.label}
            className="agri-card p-5 relative overflow-hidden group transition-all duration-300"
            style={{ animationDelay: `${i * 80}ms` }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = stat.accent + '66'
              e.currentTarget.style.boxShadow = `0 0 24px ${stat.accent}18`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#1c3a1c'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {/* Accent top line */}
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${stat.accent}66, transparent)` }} />

            <div className="flex items-start justify-between mb-3">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
              <span style={{ color: stat.accent, opacity: 0.7 }}>{stat.icon}</span>
            </div>

            <div className="flex items-end gap-1 mb-1">
              <span className="font-display text-3xl font-700" style={{ color: '#e8f5e8', lineHeight: 1 }}>
                <AnimatedNumber target={parseFloat(stat.value)} />
                {stat.label.includes('Score') || stat.label.includes('Confidence') || stat.label.includes('Battery') ? '%' : stat.label === 'Area Scanned' ? ' ha' : ''}
              </span>
            </div>

            <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6b9b6b', marginBottom: '8px' }}>
              {stat.sub}
            </p>

            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: stat.trendUp ? '#39ff14' : '#ff3030' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.trendUp ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
              </svg>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: stat.trendUp ? '#39ff14' : '#ff3030', letterSpacing: '0.05em' }}>
                {stat.trend}
              </span>
            </div>

            {/* Health bar for applicable cards */}
            {(stat.label.includes('Score') || stat.label.includes('Battery') || stat.label.includes('Confidence')) && (
              <div className="health-bar mt-3">
                <div
                  className="health-bar-fill"
                  style={{ width: `${stat.value}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}