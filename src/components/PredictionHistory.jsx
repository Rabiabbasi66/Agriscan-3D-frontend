// src/components/PredictionHistory.jsx
// Prediction History (Phase 4) — displays the authenticated user's saved
// predictions from the FastAPI backend (GET /api/v1/predictions).
//
// States: loading → empty / error / list. Details expand inline (no modal),
// matching the project's panel language. The bearer token is optional: with
// no auth integration yet the section shows its empty state; once a login
// flow supplies a token (VITE_AUTH_TOKEN or a future auth store) history
// works without any change here.
import React, { useCallback, useEffect, useState } from 'react';
import { getPredictions, getPredictionById } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthPanel from './AuthPanel';

const PAGE_SIZE = 5;

const statusTone = (isHealthy) => (isHealthy
  ? { color: '#39ff14', border: 'rgba(57,255,20,0.3)', bg: 'rgba(57,255,20,0.1)' }
  : { color: '#ff3030', border: 'rgba(255,48,48,0.3)', bg: 'rgba(255,48,48,0.1)' });

const formatDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

function Detail({ label, value, mono = false }) {
  return (
    <div className="flex justify-between sm:justify-start sm:gap-3">
      <span
        className="text-xs shrink-0"
        style={{ color: '#6b9b6b', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}
      >
        {label.toUpperCase()}
      </span>
      <span
        className="text-sm text-right sm:text-left break-all"
        style={{ color: '#a8d4a8', ...(mono ? { fontFamily: 'JetBrains Mono, monospace' } : {}) }}
      >
        {value || '—'}
      </span>
    </div>
  );
}

function HistoryRow({ item, details, onToggle, expanded, loadingDetails }) {
  const tone = statusTone(item.is_healthy);

  return (
    <div className="agri-card mb-3 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-700" style={{ color: '#e8f5e8' }}>
              {item.crop || '—'}
            </span>
            <span className="text-xs" style={{ color: '#6b9b6b' }}>·</span>
            <span className="text-sm" style={{ color: '#a8d4a8' }}>{item.disease || '—'}</span>
          </div>
          <div className="text-xs mt-1" style={{ color: '#6b9b6b', fontFamily: 'JetBrains Mono, monospace' }}>
            {formatDate(item.created_at)}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="text-right">
            <div className="font-display font-700" style={{ color: '#39ff14' }}>
              {typeof item.confidence === 'number' ? `${item.confidence.toFixed(1)}%` : '—'}
            </div>
            <div
              className="text-[10px]"
              style={{ color: '#6b9b6b', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}
            >
              CONF
            </div>
          </div>

          <span
            className="px-2 py-0.5 rounded text-[10px] font-600"
            style={{
              color: tone.color,
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
            }}
          >
            {item.is_healthy ? 'HEALTHY' : 'DISEASED'}
          </span>

          <button
            type="button"
            onClick={() => onToggle(item.id)}
            className="px-3 py-1.5 rounded text-xs font-600 transition-all duration-200"
            style={{ border: '1px solid rgba(57,255,20,0.3)', color: '#39ff14', letterSpacing: '0.06em' }}
          >
            {expanded ? 'HIDE' : 'VIEW DETAILS'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: '#1c3a1c' }}>
          {loadingDetails ? (
            <p className="text-sm" style={{ color: '#6b9b6b' }}>Loading details…</p>
          ) : details ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Detail label="Crop" value={details.crop} />
              <Detail label="Disease" value={details.disease} />
              <Detail
                label="Confidence"
                value={typeof details.confidence === 'number' ? `${details.confidence.toFixed(1)}%` : '—'}
              />
              <Detail label="Recorded" value={formatDate(details.created_at)} />
              <Detail label="Class" value={details.class_name} />
              <Detail label="Prediction ID" value={details.id} mono />
              <Detail
                label="Inference time"
                value={typeof details.inference_time_ms === 'number'
                  ? `${details.inference_time_ms.toFixed(1)} ms`
                  : '—'}
              />
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#ff9020' }}>
              Details could not be loaded. Try again later.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PredictionHistory() {
  const { isLoggedIn, isRestoring } = useAuth();
  const [history, setHistory] = useState(null); // null = not fetched yet
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadPage = useCallback(async (p) => {
    setStatus('loading');
    const result = await getPredictions({ page: p, pageSize: PAGE_SIZE });
    if (!result || !Array.isArray(result.data)) {
      setStatus('error');
      return;
    }
    setHistory(result.data);
    setPagination(result);
    setStatus('ready');
  }, []);

  useEffect(() => {
    if (isRestoring) return;
    if (!isLoggedIn) {
      // Not signed in: clear any stale rows and show the sign-in prompt.
      setHistory(null);
      setPagination(null);
      setStatus('signedOut');
      return;
    }
    loadPage(1);
  }, [isLoggedIn, isRestoring, loadPage]);

  const handleToggle = useCallback(async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetails(null);
      return;
    }
    setExpandedId(id);
    setDetails(null);
    setLoadingDetails(true);
    const detail = await getPredictionById(id);
    setLoadingDetails(false);
    setDetails(detail && detail.data ? detail.data : null);
  }, [expandedId]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display font-700 tracking-widest" style={{ fontSize: '28px', color: '#e8f5e8' }}>
          PREDICTION HISTORY
        </h2>
        {pagination && (
          <span
            className="px-2 py-0.5 rounded text-[10px]"
            style={{
              border: '1px solid rgba(57,255,20,0.3)',
              color: '#39ff14',
              background: 'rgba(57,255,20,0.1)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
            }}
          >
            {pagination.total} RECORDS
          </span>
        )}
      </div>

      <AuthPanel />

      {status === 'signedOut' && (
        <div className="agri-card p-6 text-center">
          <p className="font-display font-700 mb-1" style={{ color: '#e8f5e8' }}>
            Sign in to view your prediction history.
          </p>
          <p className="text-sm" style={{ color: '#6b9b6b' }}>
            Your scans are saved and listed here once you are logged in.
          </p>
        </div>
      )}

      {status === 'loading' && (
        <p className="text-sm" style={{ color: '#6b9b6b' }}>Loading history…</p>
      )}

      {status === 'error' && (
        <div className="agri-card p-4">
          <p className="text-sm" style={{ color: '#ff9020' }}>
            Could not load prediction history. Please try again later.
          </p>
          <button
            type="button"
            onClick={() => loadPage(page)}
            className="mt-3 px-3 py-1.5 rounded text-xs font-600"
            style={{ border: '1px solid rgba(57,255,20,0.3)', color: '#39ff14' }}
          >
            RETRY
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {history.length === 0 ? (
            <div className="agri-card p-6 text-center">
              <p className="font-display font-700 mb-1" style={{ color: '#e8f5e8' }}>
                No predictions yet.
              </p>
              <p className="text-sm" style={{ color: '#6b9b6b' }}>
                Run your first crop scan to see results here.
              </p>
              <button
                type="button"
                onClick={() => document.getElementById('image-scanner')?.scrollIntoView({ behavior: 'smooth' })}
                className="mt-4 px-4 py-2 rounded font-display font-700 tracking-widest text-xs"
                style={{ background: '#39ff14', color: '#060d06', letterSpacing: '0.1em' }}
              >
                START SCAN
              </button>
            </div>
          ) : (
            <>
              {history.map((item) => (
                <HistoryRow
                  key={item.id}
                  item={item}
                  details={expandedId === item.id ? details : null}
                  onToggle={handleToggle}
                  expanded={expandedId === item.id}
                  loadingDetails={loadingDetails}
                />
              ))}
              {pagination && pagination.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => { const p = page - 1; setPage(p); loadPage(p); }}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded text-xs font-600"
                    style={{
                      border: '1px solid rgba(57,255,20,0.3)',
                      color: '#39ff14',
                      opacity: page <= 1 ? 0.4 : 1,
                    }}
                  >
                    ← PREV
                  </button>
                  <span className="text-xs" style={{ color: '#6b9b6b', fontFamily: 'JetBrains Mono, monospace' }}>
                    PAGE {page} / {pagination.total_pages}
                  </span>
                  <button
                    type="button"
                    onClick={() => { const p = page + 1; setPage(p); loadPage(p); }}
                    disabled={page >= pagination.total_pages}
                    className="px-3 py-1.5 rounded text-xs font-600"
                    style={{
                      border: '1px solid rgba(57,255,20,0.3)',
                      color: '#39ff14',
                      opacity: page >= pagination.total_pages ? 0.4 : 1,
                    }}
                  >
                    NEXT →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
