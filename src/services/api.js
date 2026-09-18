// src/services/api.js
// Central AI prediction client for the image scanner UI.
//
// Endpoints + keys can be overridden with Vite env vars (VITE_API_URL /
// VITE_API_KEY / VITE_API_BASE_URL / VITE_AUTH_TOKEN). Defaults keep the
// previously hard-coded values so runtime behaviour is unchanged.
const API_URL = import.meta.env.VITE_API_URL || 'https://predict-6a8873db8618f7c7935cc654-dproatj77a-ww.a.run.app'
const API_KEY = import.meta.env.VITE_API_KEY || 'ul_01786bfbd9c0e301e77a5693dcc13a5671d98597'

// FastAPI backend (history endpoints). VITE_API_BASE_URL wins, then the
// shared VITE_API_URL, then the local FastAPI dev default (uvicorn on :8000,
// matching the backend's own CORS config).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || import.meta.env.VITE_API_URL
  || 'http://localhost:8000'

// Auth token store (Phase 5). The token lives in sessionStorage for the tab
// session only — never hardcoded, never committed, and cleared on logout.
// setAuthToken()/clearAuthToken() are called by the AuthContext on
// login/logout/restore. Env var VITE_AUTH_TOKEN still works as a static
// fallback for environments without the login UI.
const TOKEN_STORAGE_KEY = 'agriscan.auth.token'

let authToken = null
try {
  authToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
    || import.meta.env.VITE_AUTH_TOKEN
    || null
} catch {
  authToken = import.meta.env.VITE_AUTH_TOKEN || null
}

export const setAuthToken = (token) => {
  authToken = token || null
  try {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token)
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode etc.) — token stays in memory only.
  }
}

export const clearAuthToken = () => setAuthToken(null)

const authHeaders = () => (authToken ? { Authorization: `Bearer ${authToken}` } : {})

export const predictDisease = async (imageFile) => {
  const formData = new FormData()
  formData.append('file', imageFile)

  // Authenticated scans go through the FastAPI backend so the prediction is
  // persisted and attributed to the JWT user (Prediction History). If the
  // backend is unreachable the request falls back to the direct classifier
  // endpoint below — existing behavior is unchanged for anonymous scans.
  if (authToken) {
    try {
      const authedResponse = await fetch(`${API_BASE_URL}/api/v1/predict`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        body: formData
      })
      if (authedResponse.ok) {
        return await authedResponse.json()
      }
      console.error('FastAPI predict failed:', authedResponse.status)
    } catch (error) {
      console.error('FastAPI predict unavailable, using fallback:', error)
    }
  }

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

// ── Auth/session endpoints (Phase 5) — same client, same base URL ────────

/**
 * Register a new account. Backend: POST /api/v1/auth/register
 * Returns { success, message, data: UserOut } or throws Error(message).
 */
export const registerUser = async ({ email, password, fullName, phone }) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      full_name: fullName,
      phone: phone || null,
      role: 'farmer',
    }),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.detail || 'Registration failed')
  }
  return body
}

/**
 * Login. Backend: POST /api/v1/auth/login
 * Returns TokenResponse { access_token, refresh_token, token_type, expires_in }
 * or throws Error(message).
 */
export const loginUser = async ({ email, password }) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.detail || 'Invalid email or password')
  }
  return body
}

/**
 * Current user profile. Backend: GET /api/v1/auth/me (bearer required).
 * Returns { success, message, data: UserOut } or null on failure.
 */
export const fetchMe = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: { ...authHeaders() },
    })
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.error('Auth me Error:', error)
    return null
  }
}

/**
 * Fetch the authenticated user's prediction history (newest first).
 *
 * GET {API_BASE_URL}/api/v1/predictions?page=&page_size=
 * Returns the parsed body ({ data, total, page, page_size, total_pages,
 * success, message }) or null on failure — callers fall back safely.
 */
export const getPredictions = async ({ page = 1, pageSize = 20 } = {}) => {
  try {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    const response = await fetch(`${API_BASE_URL}/api/v1/predictions?${params}`, {
      headers: {
        ...authHeaders(),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Prediction History Error:', error)
    return null
  }
}

/**
 * Fetch a single prediction by ID (owner-only on the backend).
 *
 * GET {API_BASE_URL}/api/v1/predictions/{id}
 * Returns the parsed body ({ success, message, data }) or null on failure.
 */
export const getPredictionById = async (predictionId) => {
  try {
    if (!predictionId) return null

    const response = await fetch(`${API_BASE_URL}/api/v1/predictions/${predictionId}`, {
      headers: {
        ...authHeaders(),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Prediction Detail Error:', error)
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
