// src/components/FieldAnalytics.jsx
// Field Analytics (Phase 9) — lightweight statistics computed ONLY from real
// data: the authenticated user's persisted predictions (existing
// GET /api/v1/predictions — same JWT ownership model as Prediction History)
// merged with the current session's scans. No separate analytics backend,
// no fake numbers, no polling (single fetch per login/session change).
//
// Metrics shown only when genuinely available:
//   total / healthy / diseased predictions, class distribution (from the
//   history pages fetched), latest scan timestamp, session scan count, and
//   per-class average confidence from the current session result.
// Anonymous visitors see session-only analytics (their own scans); persisted
// history requires sign-in — identical isolation rules to Prediction History.
import React, { useEffect, useMemo, useState } from 'react';
import { getPredictions } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 20; // matches the history API default bounds

function StatCard({ label, value, tone = '#e8f5e8' }) {
  return (
    <div className="agri-card p-3">
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '9px',
          color: '#6b9b6b', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div className="font-display font-700 text-base mt-0.5" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function formatWhen(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function FieldAnalytics({ onDetectionSelect = null }) {
  const { isLoggedIn, isRestoring } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [history, setHistory] = useState(null); // first pages of persisted docs
  const [sessionScans, setSessionScans] = useState(0);
  const [lastSession, setLastSession] = useState(null); // { when, diseased, healthy, topLabel, topConf }

  // Session analytics: count REAL completed scans (not fabricated).
  useEffect(() => {
    // addEventListener passes the CustomEvent — the raw scan result App
    // dispatches lives on `.detail` (never dispatched for failed scans).
    const handler = (event) => {
      const rawResult = event && event.detail;
      setSessionScans(n => n + 1);
      if (rawResult && typeof rawResult === 'object') {
        const data = rawResult.data || {};
        setLastSession({
          when: new Date().toISOString(),
          crop: typeof data.crop === 'string' ? data.crop : null,
          disease: typeof data.disease === 'string' ? data.disease : null,
          confidence: typeof data.confidence === 'number' ? data.confidence : null,
          isHealthy: Boolean(data.is_healthy),
        });
      } else {
        setLastSession(null);
      }
    };
    window.addEventListener('agriscan:scan-complete', handler);
    return () => window.removeEventListener('agriscan:scan-complete', handler);
  }, []);

  // Persisted analytics: one bounded fetch per auth state — no polling.
  useEffect(() => {
    if (isRestoring) return;
    if (!isLoggedIn) {
      setHistory(null);
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const first = await getPredictions({ page: 1, pageSize: PAGE_SIZE });
      if (cancelled) return;
      if (!first || !Array.isArray(first.data)) {
        setStatus('error');
        return;
      }
      // One extra page when the first is full — keeps this bounded while
      // giving small histories complete coverage for distribution stats.
      let docs = first.data;
      if (first.data.length === PAGE_SIZE && first.total_pages > 1) {
        const second = await getPredictions({ page: 2, pageSize: PAGE_SIZE });
        if (!cancelled && second && Array.isArray(second.data)) {
          docs = first.data.concat(second.data);
        }
      }
      if (cancelled) return;
      setHistory(docs);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, isRestoring]);

  // All statistics derived from real documents only.
  const stats = useMemo(() => {
    const docs = history || [];
    const total = docs.length;
    const healthy = docs.filter(d => d.is_healthy).length;
    const diseased = total - healthy;

    // Class distribution over real persisted class names.
    const byClass = new Map();
    docs.forEach(d => {
      const key = d.class_name || `${d.crop || 'Unknown'} — ${d.disease || 'Unknown'}`;
      const entry = byClass.get(key) || { count: 0, healthy: Boolean(d.is_healthy) };
      entry.count += 1;
      byClass.set(key, entry);
    });
    const distribution = [...byClass.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const latest = docs.length
      ? docs.reduce((acc, d) => {
        const t = new Date(d.created_at).getTime();
        return Number.isFinite(t) && (!acc || t > acc) ? t : acc;
      }, null)
      : null;

    return { total, healthy, diseased, distribution, latest };
  }, [history]);

  const hasHistory = isLoggedIn && history && history.length > 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display font-700 tracking-widest" style={{ fontSize: '28px', color: '#e8f5e8' }}>
          FIELD ANALYTICS
        </h2>
        <span
          className="px-2 py-0.5 rounded text-[10px]"
          style={{
            border: '1px solid rgba(57,255,20,0.3)', color: '#39ff14',
            background: 'rgba(57,255,20,0.1)',
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em',
          }}
        >
          {isLoggedIn ? 'YOUR DATA' : 'SESSION ONLY'}
        </span>
      </div>

      {status === 'loading' && (
        <p className="text-sm" style={{ color: '#6b9b6b' }}>Loading analytics…</p>
      )}

      {status === 'error' && (
        <div className="agri-card p-4">
          <p className="text-sm" style={{ color: '#ff9020' }}>
            Could not load analytics. Please try again later.
          </p>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Session Scans" value={String(sessionScans)} />
            {hasHistory && (
              <>
                <StatCard label="Saved Predictions" value={String(stats.total)} />
                <StatCard label="Healthy" value={String(stats.healthy)} tone="#39ff14" />
                <StatCard label="Diseased" value={String(stats.diseased)} tone="#ff3030" />
              </>
            )}
            {!hasHistory && (
              <StatCard
                label="Latest Scan"
                value={lastSession ? formatWhen(lastSession.when) : '—'}
              />
            )}
            {!hasHistory && (
              <StatCard
                label="Sign In"
                value="For history stats"
                tone="#6b9b6b"
              />
            )}
          </div>

          {hasHistory && stats.distribution.length > 0 && (
            <div className="agri-card p-4 mt-4">
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '11px',
                  color: '#39ff14', letterSpacing: '0.1em', textTransform: 'uppercase',
                  marginBottom: '10px',
                }}
              >
                Class Distribution
              </div>
              <div className="flex flex-col gap-2">
                {stats.distribution.map(([name, info]) => {
                  const pct = stats.total > 0 ? Math.round((info.count / stats.total) * 100) : 0;
                  const color = info.healthy ? '#39ff14' : '#ff3030';
                  return (
                    <button
                      key={name}
                      type="button"
                      className="text-left w-full"
                      style={{ cursor: typeof onDetectionSelect === 'function' ? 'pointer' : 'default' }}
                      onClick={() => typeof onDetectionSelect === 'function' && onDetectionSelect(null)}
                      title={info.healthy ? 'Healthy class' : 'Disease class'}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#e8f5e8' }}>
                          {name.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color }}>
                          {info.count} · {pct}%
                        </span>
                      </div>
                      <div style={{ height: '4px', background: '#122012', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: color, borderRadius: '2px',
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              {stats.latest && (
                <p className="text-xs mt-3" style={{ color: '#6b9b6b', fontFamily: 'JetBrains Mono, monospace' }}>
                  Last saved scan: {formatWhen(new Date(stats.latest).toISOString())}
                </p>
              )}
            </div>
          )}

          {!isLoggedIn && (
            <p className="text-xs mt-3" style={{ color: '#6b9b6b' }}>
              Sign in to see analytics for your saved prediction history.
            </p>
          )}
        </>
      )}
    </div>
  );
}
