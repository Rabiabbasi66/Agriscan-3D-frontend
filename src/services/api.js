// Central API client for the image scanner, auth and prediction history.
//
// All inference goes to the FastAPI backend (backend/models/best.pt). There is
// no second classifier and no mock mode: if the backend cannot answer, the scan
// fails visibly rather than silently using different weights.
//
// VITE_API_BASE_URL configures the backend origin; an unset or malformed value
// falls back to localhost for development.
const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()
const API_BASE_URL = /^https?:\/\//.test(envApiBaseUrl)
  ? envApiBaseUrl
  : 'http://localhost:8000'

// Bearer token for the tab session only (sessionStorage, never persisted).
// VITE_AUTH_TOKEN is a static fallback for environments without the login UI.
const TOKEN_STORAGE_KEY = 'agriscan.auth.token'

let authToken = null
try {
  authToken = sessionStorage.getItem(TOKEN_STORAGE_KEY)
    || import.meta.env.VITE_AUTH_TOKEN
    || null
} catch {
  authToken = import.meta.env.VITE_AUTH_TOKEN || null
}

export const hasAuthToken = () => Boolean(authToken)

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

  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/predict`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData,
    })
  } catch (error) {
    console.error('Prediction Error:', error)
    throw new Error('Could not reach the AI server. Check that the backend is running and try again.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = typeof body?.detail === 'string' ? body.detail : `Prediction failed (HTTP ${response.status})`
    console.error('Prediction Error:', response.status, detail)
    const error = new Error(detail)
    // 415 = decodable image the plant-domain gate rejected (not a leaf).
    if (response.status === 415 && /^unsupported image/i.test(detail)) {
      error.code = 'UNSUPPORTED_IMAGE'
    }
    throw error
  }

  return response.json()
}

/**
 * Register a new account: POST /api/v1/auth/register.
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
 * Login: POST /api/v1/auth/login.
 * Returns { access_token, refresh_token, token_type, expires_in } or throws.
 */
export const loginUser = async ({ email, password }) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      (Array.isArray(body?.detail)
        ? body.detail[0]?.msg
        : body?.detail) || 'Invalid email or password'
    )
  }
  return body
}

/**
 * Current user profile: GET /api/v1/auth/me. Returns the body or null.
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
 * Authenticated prediction history (newest first): GET /api/v1/predictions.
 * Returns { data, total, page, page_size, total_pages } or null on failure.
 */
export const getPredictions = async ({ page = 1, pageSize = 20 } = {}) => {
  try {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    const response = await fetch(`${API_BASE_URL}/api/v1/predictions?${params}`, {
      headers: { ...authHeaders() },
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
 * Single prediction (owner-only on the backend): GET /api/v1/predictions/{id}.
 * Returns { success, message, data } or null on failure.
 */
export const getPredictionById = async (predictionId) => {
  try {
    if (!predictionId) return null

    const response = await fetch(`${API_BASE_URL}/api/v1/predictions/${predictionId}`, {
      headers: { ...authHeaders() },
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
 * Normalise a /predict response into a flat detection list.
 *
 * The checkpoint is a classifier, so it yields no bounding boxes (`bbox` stays
 * null). `detected: false` means the model abstained, which returns an empty
 * list so the UI reports "no confident detection" instead of naming a disease.
 * A detection model's `detections: [{ class, confidence, bbox }]` is passed
 * through unchanged.
 */
export const normalizePrediction = (raw) => {
  if (!raw || typeof raw !== 'object') return []

  const data = raw.data && typeof raw.data === 'object' ? raw.data : null

  // Shape 1: object-detection endpoint with bounding boxes.
  const det = Array.isArray(raw.detections) ? raw.detections : null

  // Shape 2: classification result from the local FastAPI endpoint.
  const local = data && data.disease && data.detected !== false
    ? [{
        name: data.class_name || `${data.crop}___${data.disease}`,
        confidence: (Number(data.confidence) || 0) / 100,
        is_healthy: Boolean(data.is_healthy),
      }]
    : null

  const entries = det || local || []

  return entries
    .map((d, i) => {
      const label = typeof d.name === 'string' ? d.name
        : typeof d.class === 'string' ? d.class
        : 'Unknown'
      // A confidence above 1 is a percentage, not a probability.
      const conf = Math.min(Math.max(Number(d.confidence) || 0, 0), 100)
      const confidence = conf > 1 ? conf / 100 : conf
      const healthy = Boolean(d.is_healthy) || /healthy/i.test(label)
      return {
        id: `ai-${i}`,
        label,
        className: label,
        confidence,
        // Severity tier derived from confidence (the backend has no such field).
        severity: healthy ? 'healthy' : confidence >= 0.6 ? 'high' : confidence >= 0.35 ? 'medium' : 'low',
        bbox: Array.isArray(d.bbox) && d.bbox.length === 4 ? d.bbox.map(Number) : null,
      }
    })
    .filter(d => Number.isFinite(d.confidence))
}
