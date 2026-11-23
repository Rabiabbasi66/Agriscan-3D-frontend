import React, { useEffect, useState } from 'react'
import { getPredictions, hasAuthToken } from '../services/api'
import { useAuth } from '../context/AuthContext'

function AnimatedNumber({ target, suffix = '' }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!Number.isFinite(target)) return
    let start = 0
    const step = target / 60
    const interval = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(interval) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(interval)
  }, [target])
  if (!Number.isFinite(target)) return <>—</>
  return <>{val.toLocaleString()}{suffix}</>
}

const STATS = [
  {
    label: 'Field Health Score',
    value: '84.2',
    sub: 'Overall crop vitality index',
    trend: '+2.4% vs last scan',
    trendUp: true,
    accent: 'var(--neon-green)',
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
    accent: 'var(--neon-red)',
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
    accent: 'var(--neon-green)',
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
    accent: 'var(--neon-yellow)',
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
    accent: 'var(--neon-green)',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
]

export default function StatsCards() {
  const { isLoggedIn } = useAuth()
  const [real, setReal] = useState(null)

  // Real aggregates from the user's saved predictions. Anonymous visitors
  // keep the demo figures (clearly labelled below).
  useEffect(() => {
    if (!isLoggedIn) { setReal(null); return }
    let cancelled = false
    getPredictions({ page: 1, pageSize: 100 }).then((res) => {
      if (cancelled || !res?.data?.length) return
      const items = res.data
      const diseased = items.filter((p) => p.is_healthy === false).length
      const confs = items.map((p) => Number(p.confidence) || 0)
      const avgConf = confs.length ? (confs.reduce((a, b) => a + b, 0) / confs.length) * 100 : 0
      const healthScore = items.length ? Math.round(((items.length - diseased) / items.length) * 1000) / 10 : 0
      setReal({
        scans: res.total ?? items.length,
        diseased,
        healthScore: healthScore.toFixed(1),
        avgConf: avgConf.toFixed(1),
      })
    })
    return () => { cancelled = true }
  }, [isLoggedIn])

  const displayStats = real
    ? [
        { ...STATS[0], value: real.healthScore, sub: `${real.scans} scans analysed`, trend: 'From your prediction history', trendUp: true },
        { ...STATS[1], value: String(real.diseased), sub: 'Diseased scans in history', trend: real.diseased ? 'Review in History' : 'All clear', trendUp: !real.diseased },
        { ...STATS[2], value: String(real.scans), sub: 'Total AI scans saved', trend: 'Your account', trendUp: true },
        { ...STATS[3], value: real.avgConf, sub: 'Mean top-1 confidence', trend: 'YOLOv8n-cls', trendUp: true },
        { ...STATS[4], value: '—', sub: 'Simulated telemetry', trend: 'Mission Control', trendUp: true },
        { ...STATS[5], value: String(real.scans), sub: 'Prediction records', trend: 'MongoDB Atlas', trendUp: true },
      ]
    : STATS

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto" id="analytics">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-px" style={{ background: 'var(--primary)' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--primary)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Real-time Analytics</span>
        </div>
        <h2 className="font-display text-4xl font-700 tracking-wide" style={{ color: 'var(--foreground)' }}>
          Field Intelligence Dashboard
        </h2>
        <p className="mt-2 text-base" style={{ color: 'var(--muted-foreground)' }}>
          {real ? 'Live metrics computed from your saved AI scans.' : 'Values shown are demo data — sign in and run scans to see your real stats.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayStats.map((stat, i) => (
          <div
            key={stat.label}
            className="agri-card p-5 relative overflow-hidden group transition-all duration-300"
            style={{ animationDelay: `${i * 80}ms` }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = stat.accent + '88'
              e.currentTarget.style.boxShadow = `0 0 24px ${stat.accent}20`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${stat.accent}66, transparent)` }} />

            <div className="flex items-start justify-between mb-3">
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {stat.label}
              </span>
              <span style={{ color: stat.accent, opacity: 0.85 }}>{stat.icon}</span>
            </div>

            <div className="flex items-end gap-1 mb-1">
              <span className="font-display text-2xl sm:text-3xl font-700 break-all" style={{ color: 'var(--foreground)', lineHeight: 1 }}>
                <AnimatedNumber target={parseFloat(stat.value)} />
                {Number.isFinite(parseFloat(stat.value)) && (stat.label.includes('Score') || stat.label.includes('Confidence') || stat.label.includes('Battery') ? '%' : stat.label === 'Area Scanned' ? ' ha' : '')}
              </span>
            </div>

            <p style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--muted-foreground)', marginBottom: '8px' }}>
              {stat.sub}
            </p>

            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: stat.trendUp ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.trendUp ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'} />
              </svg>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: stat.trendUp ? 'var(--neon-green)' : 'var(--neon-red)', letterSpacing: '0.05em' }}>
                {stat.trend}
              </span>
            </div>

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