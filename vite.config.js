import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    // The repo root also contains the Python backend (~39k files in
    // backend/venv plus ~54k dataset images). Watching all of it stalls the
    // dev server: chokidar crawls the tree on startup and keeps the Node event
    // loop busy, so the first page request is never answered and the browser
    // sits on a blank "loading" screen indefinitely. Only frontend sources
    // need watching.
    watch: {
      ignored: [
        '**/backend/**',
        '**/dist/**',
        '**/hf-space/**',
        '**/.freebuff/**',
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three'],
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
