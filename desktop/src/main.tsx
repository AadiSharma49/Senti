import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/common/ErrorBoundary'
import { syncPolicyFromDashboard } from './services/policySync'
import './index.css'

// If linked to an account: check in and report this device's status.
void syncPolicyFromDashboard()

// The boundary matters more here than in a web app: Senti runs as a
// transparent, click-through orb, so an unhandled render error doesn't show a
// broken page — it shows NOTHING, on a window you can't click. Catching it is
// the difference between a visible problem and an app that appears to have
// vanished.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)