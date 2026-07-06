import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initLockBridge } from './services/lockBridge'
import { syncPolicyFromDashboard } from './services/policySync'
import './index.css'

// Bridge the renderer's auth state to the Electron main process so it can
// harden the window while locked.
initLockBridge()

// Pull the account security policy from the dashboard (source of truth)
// and apply it to this device on startup.
void syncPolicyFromDashboard()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)