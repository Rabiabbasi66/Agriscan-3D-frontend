# Recovery Report — "stuck loading" after bundle optimization

Date: 2026-11-02
Scope: focused recovery only. No optimization work, no commits, no resets, nothing deleted.

## Symptom

`npm run dev` printed `VITE v5.4.21 ready`, but opening http://localhost:3000
never painted the app: the browser sat on an empty page indefinitely. The
backend (uvicorn on :8000) looked fine when probed with curl, but all
auth/history calls from the browser were rejected.

## Root causes

### 1. Vite dev server never answered requests (frontend "stuck loading")

Verified, not guessed:

| Measurement | Result |
| --- | --- |
| `curl http://127.0.0.1:3000/` (before fix) | `index:000 time:10.015` — connection accepted, **no response ever written** |
| Node process CPU after ~2 min uptime | **84.7 s CPU**, 429 MB RSS (one core pinned continuously) |
| `vite preview` (no file watcher) on :4173 | `200` in 0.1 s |
| Same config + `server.watch.ignored` on :3011 | `200` in 0.10 s |

Cause: `vite.config.js` had no `server.watch` configuration, so chokidar
watched the whole project root. The root also contains the Python backend:

- `backend/venv` — 39,291 files
- `backend/plantvillage_dataset` — 54,307 files
- **~92,000 of the ~93,900 files in the project**

Crawling/watching that tree keeps the Node event loop busy, so the HTTP
handler for the very first page request is starved. The server was not
crashed — it was listening but mute. This is why the app never got past
"loading": no HTML and no JS were ever served. The frontend source was not at
fault.

Fix: `server.watch.ignored` now excludes `backend/`, `dist/`, `hf-space/` and
`.freebuff/`, so only frontend sources are watched.

### 2. Backend CORS rejected the dev origin (auth/history stuck)

The dev server binds `0.0.0.0`, so the app can be opened as either
`localhost:3000` or `127.0.0.1:3000`. `backend/.env` pinned
`ALLOWED_ORIGINS` to `localhost` only, and an env value overrides the Python
defaults in `app/config.py`.

Evidence before the fix — request from `http://127.0.0.1:3000`:

```
HTTP/1.1 403 Forbidden
access-control-allow-credentials: true
(no access-control-allow-origin header)
```

The browser therefore blocked `/api/v1/auth/me`, `AuthContext.restore()`
caught the failure, and the auth-dependent panels never had a session to
render. After the fix the same request returns
`access-control-allow-origin: http://127.0.0.1:3000`.

### 3. Backend cannot start from `backend/.env` alone (startup blocker)

`backend/.env` points `MONGODB_URI` at an Atlas SRV host that does not resolve
in this network:

```
pymongo.errors.ConfigurationError:
The DNS query name does not exist: _mongodb._tcp.agriscan3d.l8gxxmx.mongodb.net.
ERROR: Application startup failed. Exiting.
```

A local `mongod` is listening on `127.0.0.1:27017`, and starting uvicorn with
an explicit override works:

```
cd backend
MONGODB_URI=mongodb://localhost:27017 ./venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The `.env` value was left untouched (not my data source to change) — the
override is the documented way to run it locally.

## Not broken (checked, left alone)

- `src/App.jsx`, `src/context/AuthContext.jsx`, `src/components/FarmViewer3D.jsx`
  — unchanged from the last commit; no infinite render loop, no stuck state
  machine. `restore()` always terminates (`loggedIn` or `loggedOut`).
- `src/components/Navbar.jsx` — the working-tree version is a **fix**, keep it.
  The committed version re-exported `FarmViewer3D`, which mounted a second
  full Three.js scene (second WebGL context, second render loop, duplicate
  GLB downloads). Now there is exactly one `FarmViewer3D` mount and one
  `FarmSceneController`.
- `src/three/modelLoader.js` + GLB upgrade paths in `scene.js` / `drone.js` —
  all four models are served and fetched: `corn.glb`, `leaf.glb`, `drone.glb`,
  `tomato.glb` all return 200, and the scene upgrades to them after paint.
- `src/three/FarmSceneController.js` — mixer/rotor gating is coherent.
- `vite.config.js` `manualChunks` — the split builds and runs correctly
  (`react-vendor`, `three-vendor`, `index`); it was not the failure.
- `src/services/api.js` env guards and classifier params — harmless, kept.

## Changes made

1. `vite.config.js` — added `server.watch.ignored`; line endings normalised to
   LF. `manualChunks` untouched.
2. `backend/app/config.py` — loopback `127.0.0.1` variants added to the
   `ALLOWED_ORIGINS` defaults.
3. `backend/.env` (gitignored, local only) — `ALLOWED_ORIGINS` extended with
   `http://127.0.0.1:3000` and `http://127.0.0.1:5173`.

## Verification

Frontend (`npm run dev`, port 3000) — cold start:

- `GET /` → `200` in `0.14 s` (was: no response)
- Every module 200: `main.jsx`, `App.jsx`, `Navbar.jsx`, `FarmViewer3D.jsx`,
  `FarmSceneController.js`, `scene.js`, `drone.js`, `modelLoader.js`,
  `api.js`, `AuthContext.jsx`, `three`, `GLTFLoader`
- Runtime DOM: hero `AGRISCAN 3D`, one WebGL canvas 543×933 context alive,
  HUD `SCANNING ACTIVE`, live altitude changing (9.1 m → 11.8 m), pause/resume
  toggles `PAUSED` → `RESUME` → `PAUSE`
- No `Restoring session…`, `Loading history…` or `Loading analytics…` states
  remain after load

Backend (uvicorn, port 8000):

- `GET /docs` → 200, `GET /openapi.json` → 200
- `GET /api/v1/auth/me` (no token) → 403 with CORS header
- `POST /api/v1/auth/login` (bad credentials) → 401 `{"detail":"Invalid credentials"}`
  with `access-control-allow-origin: http://127.0.0.1:3000`
- Browser form submit reached the backend (request logged server-side), i.e.
  the full browser → API round trip works

Production bundle:

- `npm run build` → 55 modules, 3 chunks, no errors
- `vite preview` page renders, WebGL context alive, drone animating, GLB
  models 200, no console exceptions

## How to run

```
# backend
cd backend && MONGODB_URI=mongodb://localhost:27017 ./venv/Scripts/python.exe \
  -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend
npm run dev            # http://localhost:3000
```
