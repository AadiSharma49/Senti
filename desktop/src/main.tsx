import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initLockBridge } from './services/lockBridge'
import './index.css'

// Bridge the renderer's auth state to the Electron main process so it can
// harden the window while locked.
initLockBridge()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)