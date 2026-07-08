import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initLockBridge } from './services/lockBridge'
import { syncPolicyFromDashboard } from './services/policySync'
import { ensureVoiceprint } from './services/voiceprintSync'
import './index.css'

// Bridge the renderer's auth state to the Electron main process so it can
// harden the window while locked.
initLockBridge()

// If linked to an account: pull the security policy and, if this device
// has no local voiceprint yet, download the account's.
void (async () => {
  await syncPolicyFromDashboard()
  await ensureVoiceprint()
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)