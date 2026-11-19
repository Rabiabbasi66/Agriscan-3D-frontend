import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { preloadModels } from './three/modelLoader'
import { ThemeProvider } from './context/ThemeContext'

// Start the GLB downloads during module init so they overlap React's first
// render; modelLoader de-duplicates in-flight requests, so the scene reuses
// these downloads instead of fetching the same models again.
preloadModels(['drone', 'corn', 'leaf'])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
