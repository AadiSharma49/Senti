import React from 'react'
import ErrorBoundary from './components/common/ErrorBoundary'
import LockScreen from './components/lockscreen/LockScreen'

function App() {
  console.log('[Senti] App.tsx - rendering LockScreen standalone')
  return (
    <ErrorBoundary name="root">
      <LockScreen />
    </ErrorBoundary>
  )
}

export default App