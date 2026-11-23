import React, { useRef, useState, useCallback, useEffect } from 'react';
import { predictDisease, normalizePrediction } from '../services/api';
import GreennessHeatmap from './GreennessHeatmap';

const SEV_COLOR = {
  high: 'var(--neon-red)',
  medium: 'var(--neon-orange)',
  low: 'var(--neon-yellow)',
  healthy: 'var(--neon-green)',
};

const SEV_VAR = {
  high: '--neon-red',
  medium: '--neon-orange',
  low: '--neon-amber',
  healthy: '--neon-green',
};
const SEV_FALLBACK = {
  high: '#ff2020',
  medium: '#ff6020',
  low: '#ffaa20',
  healthy: '#39ff14',
};

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Canvas 2D cannot resolve var() — resolve to concrete hex (with alpha suffix
// support) for annotation drawing.
function sevCanvasColor(sev) {
  return cssVar(SEV_VAR[sev] || '--neon-green', SEV_FALLBACK[sev] || '#39ff14');
}
function onNeonCanvas() {
  return cssVar('--on-neon', '#060d06');
}

// Checkpoint class names use "Crop___Disease" with underscores; this is the
// only place they are turned into readable text.
const prettyClass = (name) => (
  typeof name === 'string'
    ? name.replace(/___/g, ' · ').replace(/_/g, ' ').trim()
    : '—'
);

// Local leaf photos: the samples must be inside the supported domain, otherwise
// the scanner's own examples would be rejected by the plant gate.
const SAMPLES = [
  { url: '/samples/leaf-tomato.jpg', label: 'Tomato leaf' },
  { url: '/samples/leaf-blight.jpg', label: 'Late blight' },
  { url: '/samples/leaf-spots.jpg', label: 'Leaf spots' },
];

const MONO_LABEL = {
  fontFamily: 'monospace',
  fontSize: '9px',
  color: 'var(--icon-muted)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

// The classifier only ever looks at a 512 px longest edge (MAX_INFERENCE_EDGE
// in the backend) and the plant gate resizes to 224, so uploading a 12 MP phone
// photo spends bandwidth and decode time on pixels no model sees. Downscaling
// above 1280 px keeps the model input equivalent while cutting a 1.05 MB upload
// to ~200 kB. Small images pass through untouched and any failure falls back to
// the original file, so this step can never block a scan.
const MAX_UPLOAD_EDGE = 1280
const UPLOAD_JPEG_QUALITY = 0.92

async function downscaleForUpload(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= MAX_UPLOAD_EDGE) {
      bitmap.close?.()
      return file
    }
    const scale = MAX_UPLOAD_EDGE / longest
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', UPLOAD_JPEG_QUALITY))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], 'scan.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

function drawDetections(canvas, img, detections, progress) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (progress < 1) {
    const scanY = canvas.height * progress;
    ctx.fillStyle = 'rgba(57,255,20,0.08)';
    ctx.fillRect(0, 0, canvas.width, scanY);
    ctx.strokeStyle = 'rgba(57,255,20,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, scanY);
    ctx.lineTo(canvas.width, scanY);
    ctx.stroke();
    const grad = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(57,255,20,0.25)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 8, canvas.width, 16);
    return;
  }

  detections.forEach(d => {
    const px = d.x * canvas.width;
    const py = d.y * canvas.height;
    const pw = d.w * canvas.width;
    const ph = d.h * canvas.height;
    const color = sevCanvasColor(d.severity);

    ctx.fillStyle = color + '22';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px, py, pw, ph);

    const labelText = `${d.label} ${d.confidence.toFixed(1)}%`;
    ctx.font = 'bold 11px JetBrains Mono, monospace';
    const tw = ctx.measureText(labelText).width;
    const labelY = py > 20 ? py - 4 : py + ph + 16;
    ctx.fillStyle = color + 'dd';
    ctx.fillRect(px, labelY - 13, tw + 10, 17);
    ctx.fillStyle = d.severity === 'healthy' ? onNeonCanvas() : '#fff';
    ctx.fillText(labelText, px + 5, labelY);
  });
}

export default function ImageScanner({ onScanComplete, onDetectionSelect, selectedDetectionId = null }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  const [imageSrc, setImageSrc] = useState(null);
  const [scanState, setScanState] = useState('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [detections, setDetections] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const detectionsRef = useRef([]);
  // A failed scan is visibly different from a successful one and never feeds
  // analytics or AI markers.
  const [scanError, setScanError] = useState(null);
  // Set when the model abstained (top-1 below the confidence threshold).
  const [scanNote, setScanNote] = useState(null);
  // The full `data` object of the last prediction, so the report renders only
  // fields the backend actually returned.
  const [scanData, setScanData] = useState(null);
  // { savedToDb, predictionId } from the response envelope.
  const [scanSaved, setScanSaved] = useState(null);

  useEffect(() => {
    if (!canvasRef.current || !imgRef.current || !imageSrc) return;
    drawDetections(canvasRef.current, imgRef.current, detectionsRef.current, scanProgress);
  }, [scanProgress, imageSrc]);

  const runScan = useCallback(async (src) => {
    setScanState('scanning');
    setScanProgress(0);
    setDetections([]);
    setScanError(null);
    setScanNote(null);
    setScanData(null);
    setScanSaved(null);

    try {
      // fetch() can reject (offline sample photo, revoked URL, blocked
      // network) — the catch below keeps the UI out of a stuck "scanning".
      const response = await fetch(src);
      const blob = await response.blob();
      const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });

      const uploadFile = await downscaleForUpload(file)
      const result = await predictDisease(uploadFile);
      const data = result && result.data ? result.data : null;

      if (!result || !data) {
        // Backend unavailable or an empty envelope: forward null (clears AI
        // markers) and emit no scan-complete event.
        setScanState('error');
        setScanError('Scan failed. The AI service returned no result — please try again.');
        if (onScanComplete) onScanComplete(null);
        return;
      }

      if (onScanComplete) onScanComplete(result);

      setScanData(data);
      setScanSaved({
        savedToDb: result.saved_to_db === true,
        predictionId: typeof result.prediction_id === 'string' ? result.prediction_id : null,
      });

      if (Array.isArray(result.detections) && result.detections.length > 0) {
        // Object-detection response (not produced by the current classifier
        // checkpoint): draw the boxes the model actually returned.
        const dets = result.detections.map((d, i) => ({
          id: `det-${i}`,
          label: d.class || 'Unknown',
          severity: d.severity || 'medium',
          confidence: (d.confidence || 0) * 100,
          x: d.bbox?.[0] || 0.2,
          y: d.bbox?.[1] || 0.2,
          w: d.bbox?.[2] - d.bbox?.[0] || 0.2,
          h: d.bbox?.[3] - d.bbox?.[1] || 0.2,
        }));
        detectionsRef.current = dets;
        setDetections(dets);
        setScanState('done');
        setScanProgress(1);
        if (canvasRef.current && imgRef.current) {
          drawDetections(canvasRef.current, imgRef.current, dets, 1);
        }
        return;
      }

      // Classification result: top-1 only, the checkpoint produces no boxes.
      const dets = normalizePrediction(result).map((d, i) => ({
        id: `ai-${i}`,
        label: d.label,
        severity: d.severity,
        confidence: d.confidence * 100,
      }));
      detectionsRef.current = dets;
      setDetections(dets);

      if (data.detected === false) {
        const top = typeof data.class_name === 'string'
          ? data.class_name.replace(/___/g, ' / ').replace(/_/g, ' ')
          : 'unknown';
        setScanNote(
          `No confident detection. Best match was ${top} at ${(Number(data.confidence) || 0).toFixed(1)}%, `
          + 'below the confidence threshold — the image may not be a supported crop leaf.',
        );
      }

      setScanState('done');
      setScanProgress(1);
    } catch (error) {
      // Image load / network / API failure: same visible failure state, markers
      // cleared, no scan-complete event.
      setScanState('error');
      if (error?.code === 'UNSUPPORTED_IMAGE' && error.message) {
        // Decodable image the plant gate refused: show its reason verbatim
        // instead of a generic scan failure.
        setScanError(error.message);
      } else {
        setScanError(
          error instanceof Error && error.message
            ? `Scan failed: ${error.message}`
            : 'Scan failed. The image could not be loaded — please try again.',
        );
      }
      if (onScanComplete) onScanComplete(null);
    }
  }, []);

  const loadImage = useCallback((src) => {
    setImageSrc(src);
    setScanState('idle');
    setScanProgress(0);
    setDetections([]);
    setScanError(null);
    setScanNote(null);
    setScanData(null);
    setScanSaved(null);
    detectionsRef.current = [];
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        canvasRef.current.width = img.naturalWidth;
        canvasRef.current.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = src;
  }, []);

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      // Not a scan failure: the state stays 'idle', so no header is shown.
      setScanError('Unsupported file — please choose an image (JPG, PNG, or WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => loadImage(e.target?.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePaste = useCallback((e) => {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
    if (item) { const file = item.getAsFile(); if (file) handleFile(file); }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const diseased = detections.filter(d => d.severity !== 'healthy');
  const headlineColor = !scanData
    ? 'var(--neon-green)'
    : scanData.detected === false
      ? 'var(--neon-amber)'
      : scanData.is_healthy ? 'var(--neon-green)' : 'var(--neon-orange)';

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto" id="image-scan">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-px" style={{ background: 'var(--neon-green)' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--neon-green)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            AI Image Analysis
          </span>
        </div>
        <h2 className="font-display text-4xl font-700 tracking-wide" style={{ color: 'var(--term-text)' }}>
          Scan Drone or Mobile Images
        </h2>
        <p className="mt-2 max-w-xl" style={{ color: 'var(--icon-muted)', fontSize: '14px' }}>
          Upload a photo from your drone or phone. YOLOv8 scans it in real time and draws
          bounding boxes around every detected disease or healthy region.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div
            className="agri-card relative flex flex-col items-center justify-center p-8 cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragOver ? 'var(--neon-green)' : 'var(--neon-green-dim)'}`,
              minHeight: '180px',
              background: dragOver ? 'rgba(57,255,20,0.04)' : 'var(--term-bg-deep)',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: dragOver ? 'var(--neon-green)' : 'var(--icon-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-display font-600 text-sm" style={{ color: 'var(--term-text)', letterSpacing: '0.06em' }}>
              DROP IMAGE HERE
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)', marginTop: '6px', textAlign: 'center', letterSpacing: '0.05em' }}>
              or click to browse · paste with Ctrl+V
            </span>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </div>

          <button
            className="agri-card w-full py-3 flex items-center justify-center gap-3 transition-all duration-200"
            style={{ border: '1px solid var(--neon-green-dim)', cursor: 'pointer' }}
            onClick={() => cameraInputRef.current?.click()}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(57,255,20,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--neon-green-dim)')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--neon-green)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-display font-600 tracking-widest" style={{ color: 'var(--term-text)', fontSize: '12px', letterSpacing: '0.1em' }}>
              USE CAMERA
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)' }}>(mobile / webcam)</span>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </button>

          <button
            disabled={!imageSrc || scanState === 'scanning'}
            onClick={() => imageSrc && runScan(imageSrc)}
            className="w-full py-3.5 rounded font-display font-700 tracking-widest transition-all duration-200"
            style={{
              fontSize: '13px',
              letterSpacing: '0.12em',
              background: !imageSrc || scanState === 'scanning' ? 'rgba(57,255,20,0.06)' : 'var(--neon-green)',
              color: !imageSrc || scanState === 'scanning' ? 'var(--icon-muted)' : 'var(--on-neon)',
              border: `1px solid ${!imageSrc ? 'var(--neon-green-dim)' : 'var(--neon-green)'}`,
              cursor: !imageSrc || scanState === 'scanning' ? 'not-allowed' : 'pointer',
            }}
          >
            {scanState === 'scanning' ? '⏳  SCANNING...' : scanState === 'done' ? '🔁  RESCAN' : '▶  RUN YOLOV8 SCAN'}
          </button>

          <div>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)', letterSpacing: '0.1em', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              Try a sample image
            </span>
            <div className="grid grid-cols-3 gap-2">
              {SAMPLES.map(s => (
                <button
                  key={s.url}
                  onClick={() => loadImage(s.url)}
                  className="relative overflow-hidden rounded group"
                  style={{ aspectRatio: '4/3', border: `1px solid ${imageSrc === s.url ? 'var(--neon-green)' : 'var(--neon-green-dim)'}` }}
                >
                  <img src={s.url} alt={s.label} className="w-full h-full object-cover" crossOrigin="anonymous" loading="lazy" decoding="async" />
                  <div
                    className="absolute inset-0 flex items-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(transparent, rgba(6,13,6,0.85))' }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--neon-green)', letterSpacing: '0.06em' }}>{s.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {scanError && (
            <div className="agri-card p-4" style={{ border: '1px solid rgba(255,48,48,0.4)' }}>
              {scanState === 'error' && (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--neon-red)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {scanError.startsWith('Unsupported image') ? 'Unsupported Image' : 'Scan Failed'}
                </span>
              )}
              <p className="text-sm mt-2" style={{ color: 'var(--neon-orange)' }}>{scanError}</p>
            </div>
          )}

          {scanState === 'done' && scanData && (
            <div className="agri-card p-4 flex flex-col gap-3" style={{ border: '1px solid rgba(57,255,20,0.2)' }}>
              <div className="flex items-start justify-between gap-2">
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--neon-green)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Scan Report
                </span>
                <span
                  className="px-2 py-0.5 rounded"
                  style={{
                    fontFamily: 'monospace', fontSize: '9px', letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: scanData.supported === true ? 'var(--neon-green)' : 'var(--neon-orange)',
                    background: scanData.supported === true ? 'rgba(57,255,20,0.08)' : 'rgba(255,144,32,0.08)',
                    border: `1px solid ${scanData.supported === true ? 'rgba(57,255,20,0.3)' : 'rgba(255,144,32,0.35)'}`,
                  }}
                  title={scanData.plant_score != null ? `Plant-domain score ${scanData.plant_score}` : undefined}
                >
                  {scanData.supported === true ? 'Leaf validated' : 'Not validated'}
                </span>
              </div>

              <div>
                <div style={MONO_LABEL}>Crop</div>
                <div className="font-display font-700" style={{ fontSize: '22px', color: 'var(--term-text)', lineHeight: 1.15 }}>
                  {scanData.crop || '—'}
                </div>
                <div
                  className="font-display font-600 mt-0.5"
                  style={{ fontSize: '15px', color: headlineColor }}
                >
                  {scanData.detected === false
                    ? 'No confident detection'
                    : scanData.is_healthy
                      ? 'Healthy — no disease class matched'
                      : (scanData.disease || '—')}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span
                    className="px-2 py-0.5 rounded"
                    style={{ background: 'var(--term-bg)', border: '1px solid var(--neon-green-dim)', fontFamily: 'monospace', fontSize: '9px', color: 'var(--term-text-mid)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  >
                    {scanData.category?.label || 'Unclassified'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded"
                    style={{ background: 'var(--term-bg-deep)', border: '1px solid var(--neon-green-dim)', fontFamily: 'monospace', fontSize: '9px', color: 'var(--icon-muted)' }}
                    title={scanData.class_name}
                  >
                    {prettyClass(scanData.class_name)}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span style={MONO_LABEL}>Confidence</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: 'var(--term-text)' }}>
                    {Number(scanData.confidence || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1 rounded overflow-hidden" style={{ height: '6px', background: 'var(--term-bg)' }}>
                  <div
                    style={{
                      height: '6px',
                      width: `${Math.min(100, Math.max(0, Number(scanData.confidence) || 0))}%`,
                      background: headlineColor,
                    }}
                  />
                </div>
                {scanData.confidence_threshold != null && (
                  <div className="mt-1" style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--icon-muted)' }}>
                    A class is reported only at or above {Number(scanData.confidence_threshold).toFixed(0)}%
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: 'Model', v: scanData.model_name || '—', t: scanData.model_file },
                  { l: 'Inference', v: scanData.inference_time_ms != null ? `${Number(scanData.inference_time_ms).toFixed(0)} ms` : '—', t: 'Model forward pass (excludes upload and preprocessing)' },
                  { l: 'Class index', v: scanData.class_index != null ? String(scanData.class_index) : '—' },
                  { l: 'Validation', v: scanData.supported === true ? 'Passed' : 'Failed' },
                  {
                    l: 'Prediction ID',
                    v: scanSaved?.predictionId
                      ? (scanSaved.predictionId.length > 12 ? `${scanSaved.predictionId.slice(0, 8)}…` : scanSaved.predictionId)
                      : 'None',
                    t: scanSaved?.predictionId || undefined,
                  },
                  { l: 'Database', v: scanSaved?.savedToDb ? 'Saved' : 'Not saved' },
                ].map(s => (
                  <div key={s.l} className="rounded p-2" style={{ background: 'var(--term-bg)', border: '1px solid var(--neon-green-dim)' }} title={s.t}>
                    <div style={MONO_LABEL}>{s.l}</div>
                    <div className="font-display font-700 text-sm mt-0.5" style={{ color: 'var(--term-text)' }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {Array.isArray(scanData.top_k) && scanData.top_k.length > 0 && (
                <div>
                  <div style={MONO_LABEL}>Top 3 predictions</div>
                  <div className="flex flex-col gap-1.5 mt-1.5">
                    {scanData.top_k.slice(0, 3).map((p, i) => {
                      const score = Number(p.confidence) || 0;
                      const isHealthy = /healthy/i.test(String(p.class_name || ''));
                      const color = isHealthy ? SEV_COLOR.healthy : (i === 0 ? SEV_COLOR.high : 'var(--icon-muted)');
                      const clickable = i === 0 && typeof onDetectionSelect === 'function';
                      const row = (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: i === 0 ? 'var(--term-text)' : 'var(--term-text-mid)' }}>
                              {prettyClass(p.class_name)}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 600, color }}>
                              {score.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-1 rounded overflow-hidden" style={{ height: '3px', background: 'var(--term-bg)' }}>
                            <div style={{ height: '3px', width: `${Math.min(100, Math.max(0, score))}%`, background: color, opacity: i === 0 ? 1 : 0.5 }} />
                          </div>
                        </>
                      );
                      return clickable ? (
                        <button
                          key={p.class_name || i}
                          type="button"
                          onClick={() => onDetectionSelect('ai-0')}
                          className="w-full text-left transition-all duration-150"
                          style={{ cursor: 'pointer' }}
                          title="Highlight in 3D view"
                        >
                          {row}
                        </button>
                      ) : (
                        <div key={p.class_name || i}>{row}</div>
                      );
                    })}
                  </div>
                </div>
              )}

              {scanNote && (
                <p className="text-sm" style={{ color: 'var(--neon-amber)', lineHeight: 1.5 }}>{scanNote}</p>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          <div
            className="agri-card relative overflow-hidden"
            style={{
              minHeight: '360px',
              background: imageSrc ? '#000' : 'var(--term-bg-deep)',
              border: `1px solid ${scanState === 'scanning' ? 'rgba(57,255,20,0.4)' : 'var(--neon-green-dim)'}`,
              transition: 'border-color 0.3s',
            }}
          >
            {!imageSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="relative w-32 h-24 rounded" style={{ border: '1px solid var(--neon-green-dim)' }}>
                  <div className="absolute inset-0 grid-overlay rounded" />
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="absolute left-2 right-2 h-2 rounded-sm" style={{ top: `${15 + i * 16}%`, background: 'var(--neon-green-dim)' }} />
                  ))}
                  <div className="absolute w-8 h-8 rounded-full" style={{ right: 8, top: 12, border: '1.5px solid rgba(255,48,48,0.4)', background: 'rgba(255,48,48,0.06)' }} />
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--icon-muted)', letterSpacing: '0.08em' }}>
                  No image loaded
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)', opacity: 0.6 }}>
                  Upload or pick a sample above
                </span>
              </div>
            )}

            {imageSrc && (
              <canvas
                ref={canvasRef}
                className="w-full h-auto block"
                style={{ display: 'block', maxHeight: '560px', objectFit: 'contain' }}
              />
            )}

            {scanState === 'scanning' && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute left-0 right-0 h-0.5"
                  style={{
                    top: `${scanProgress * 100}%`,
                    background: 'rgba(57,255,20,0.8)',
                    boxShadow: '0 0 12px rgba(57,255,20,0.6)',
                  }}
                />
              </div>
            )}

            {imageSrc && (
              <>
                {[['top-2 left-2', 'border-t border-l'], ['top-2 right-2', 'border-t border-r'], ['bottom-2 left-2', 'border-b border-l'], ['bottom-2 right-2', 'border-b border-r']].map(([pos, brd], i) => (
                  <div key={i} className={`absolute ${pos} w-6 h-6 ${brd} pointer-events-none`} style={{ borderColor: 'rgba(57,255,20,0.5)' }} />
                ))}
              </>
            )}

            {scanState !== 'idle' && (
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded" style={{ background: 'rgba(6,13,6,0.85)', border: '1px solid rgba(57,255,20,0.3)' }}>
                  <span className={`w-2 h-2 rounded-full ${scanState === 'scanning' ? 'animate-blink' : ''}`} style={{ background: 'var(--neon-green)' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--neon-green)', letterSpacing: '0.1em' }}>
                    {scanState === 'scanning' ? `SCANNING ${Math.round(scanProgress * 100)}%` : `${detections.length} DETECTIONS`}
                  </span>
                </div>
              </div>
            )}

            {scanState === 'done' && diseased.length > 0 && (
              <div className="absolute top-3 right-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded" style={{ background: 'rgba(255,32,32,0.15)', border: '1px solid rgba(255,32,32,0.4)' }}>
                  <span className="w-2 h-2 rounded-full animate-blink" style={{ background: 'var(--neon-red)' }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--neon-red)', letterSpacing: '0.1em' }}>
                    {diseased.length} DISEASE{diseased.length !== 1 ? 'S' : ''} FOUND
                  </span>
                </div>
              </div>
            )}
          </div>

          {imageSrc && <GreennessHeatmap src={imageSrc} />}

          {scanState === 'done' && (
            <div className="flex items-center gap-5 mt-3 px-1">
              {Object.entries(SEV_COLOR).map(([sev, col]) => (
                <div key={sev} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: col + '33', border: `1.5px solid ${col}` }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)', textTransform: 'capitalize' }}>{sev}</span>
                </div>
              ))}
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)', marginLeft: 'auto' }}>
                YOLOv8 · {new Date().toLocaleTimeString('en-US', { hour12: false })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Static agronomic reference for the predicted class. */}
      {scanState === 'done' && scanData?.disease_info && (
        <div className="mt-5 agri-card p-5" style={{ border: '1px solid var(--neon-green-dim)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-6 h-px" style={{ background: 'var(--neon-green)' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--neon-green)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Disease Reference
              </span>
            </div>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)' }}>
              {scanData.category?.label || 'Unclassified'} · {prettyClass(scanData.class_name)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-3">
              <div style={MONO_LABEL}>Overview</div>
              <p className="mt-1 text-sm" style={{ color: 'var(--term-text-soft)', lineHeight: 1.65 }}>
                {scanData.disease_info.overview}
              </p>
              {scanData.disease_info.agent && (
                <p className="mt-2" style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--icon-muted)' }}>
                  Causal agent: {scanData.disease_info.agent}
                </p>
              )}
            </div>

            {Array.isArray(scanData.disease_info.symptoms) && scanData.disease_info.symptoms.length > 0 && (
              <div>
                <div style={MONO_LABEL}>Common visible symptoms</div>
                <ul className="mt-2 flex flex-col gap-2">
                  {scanData.disease_info.symptoms.map(s => (
                    <li key={s} className="flex gap-2 text-sm" style={{ color: 'var(--term-text-soft)', lineHeight: 1.55 }}>
                      <span style={{ color: 'var(--neon-green)', lineHeight: 1.4 }}>▸</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(scanData.disease_info.management) && scanData.disease_info.management.length > 0 && (
              <div className="lg:col-span-2">
                <div style={MONO_LABEL}>Prevention &amp; management (general)</div>
                <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2">
                  {scanData.disease_info.management.map(s => (
                    <li key={s} className="flex gap-2 text-sm" style={{ color: 'var(--term-text-soft)', lineHeight: 1.55 }}>
                      <span style={{ color: 'var(--neon-green)', lineHeight: 1.4 }}>▸</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="mt-4 rounded p-3" style={{ background: 'var(--term-bg-deep)', border: '1px solid rgba(250,204,21,0.25)' }}>
            <div style={{ ...MONO_LABEL, color: 'var(--neon-yellow)' }}>General guidance — not a diagnosis of this image</div>
            <p className="mt-1 text-sm" style={{ color: 'var(--term-text-soft)', lineHeight: 1.6 }}>
              {scanData.disease_info.guidance_note}
            </p>
            {Array.isArray(scanData.disease_info.sources) && scanData.disease_info.sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                {scanData.disease_info.sources.map(s => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--neon-green)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}