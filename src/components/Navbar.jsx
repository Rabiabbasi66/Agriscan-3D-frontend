/**
 * Navbar — top navigation slot of the app.
 *
 * Phase 1 cleanup: this file previously contained a byte-for-byte duplicate of
 * FarmViewer3D.jsx (a second full WebGL scene + duplicated scene code running
 * alongside the hero viewer). It now re-exports the shared FarmViewer3D so the
 * page renders exactly the same output through a single code path.
 *
 * Phase 2 note: if a distinct navigation bar is wanted here, replace this
 * re-export with a real navbar component — the 3D viewer stays untouched.
 */
export { default } from './FarmViewer3D'
