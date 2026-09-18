// src/services/api.js
// Central AI prediction client for the image scanner UI.
//
// Endpoint + key can be overridden with Vite env vars (VITE_API_URL /
// VITE_API_KEY). Defaults keep the previously hard-coded values so runtime
// behaviour is unchanged.
const API_URL = import.meta.env.VITE_API_URL || 'https://predict-6a8873db8618f7c7935cc654-dproatj77a-ww.a.run.app'
const API_KEY = import.meta.env.VITE_API_KEY || 'ul_01786bfbd9c0e301e77a5693dcc13a5671d98597'

export const predictDisease = async (imageFile) => {
  const formData = new FormData()
  formData.append('file', imageFile)

  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Prediction Error:', error)
    return null
  }
}

/**
 * Normalise any known /predict response shape into a flat detection list.
 *
 * The deployed Cloud Run endpoint is a YOLOv8 CLASSIFIER and returns:
 *   { images: [{ results: [{ name, class, confidence }] }], metadata: { task, ... } }
 * The local FastAPI endpoint (app/routers/predict.py) returns:
 *   { success, data: { disease, crop, confidence, is_healthy, class_name }, ... }
 * Neither shape carries bounding boxes (classification, not detection). If a
 * future detection model adds `detections: [{ class, confidence, bbox }]`, it
 * is passed through unchanged so the 3D mapper can use real image boxes.
 *
 * Returns [] for null/failed/malformed responses — callers fall back safely.
 */
export const normalizePrediction = (raw) => {
  if (!raw || typeof raw !== 'object') return []

  // Shape 1: remote classifier — images[0].results[] top-K class predictions.
  const remote = Array.isArray(raw.images) && Array.isArray(raw.images[0]?.results)
    ? raw.images[0].results
    : null

  // Shape 2: local FastAPI — single data{disease, crop, confidence, ...}.
  const local = raw.data && typeof raw.data === 'object' && raw.data.disease
    ? [{
        name: raw.data.class_name || `${raw.data.crop}___${raw.data.disease}`,
        confidence: (Number(raw.data.confidence) || 0) / 100,
        is_healthy: Boolean(raw.data.is_healthy),
      }]
    : null

  // Shape 3 (future): object-detection endpoint with bounding boxes.
  const det = Array.isArray(raw.detections) ? raw.detections : null

  const entries = remote || det || local || []

  return entries
    .map((d, i) => {
      const label = typeof d.name === 'string' ? d.name
        : typeof d.class === 'string' ? d.class
        : 'Unknown'
      // Remote classifier confidences are 0-1; a malformed value > 1 is
      // treated as already-percentaged.
      const conf = Math.min(Math.max(Number(d.confidence) || 0, 0), 100)
      const confidence = conf > 1 ? conf / 100 : conf
      const healthy = Boolean(d.is_healthy) || /healthy/i.test(label)
      return {
        id: `ai-${i}`,
        label,
        className: label,
        confidence,
        // Report tier derived from the model's own confidence (backend has no
        // severity field): >=0.60 high, >=0.35 medium, else low.
        severity: healthy ? 'healthy' : confidence >= 0.6 ? 'high' : confidence >= 0.35 ? 'medium' : 'low',
        // Normalised [x1, y1, x2, y2] when a detection model provides one.
        bbox: Array.isArray(d.bbox) && d.bbox.length === 4 ? d.bbox.map(Number) : null,
      }
    })
    .filter(d => Number.isFinite(d.confidence))
}
