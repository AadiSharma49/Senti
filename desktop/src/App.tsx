import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import LockScreen from './components/lockscreen/LockScreen'
import SetupWizard from './components/onboarding/SetupWizard'
import CustomCursor from './components/common/CustomCursor'
import AudioCaptureTest from './components/debug/AudioCaptureTest'
import VADTest from './components/debug/VADTest'
import UtteranceTest from './components/debug/UtteranceTest'
import VoiceAuthTest from './components/debug/VoiceAuthTest'
import { useSettingsStore } from './state/settingsStore'

function App() {
  const settings = useSettingsStore((s) => s)
  const securityConfigured = settings.security.pin.trim().length >= 4
  const needsSetup = !settings.setupCompleted || !securityConfigured

  // Setup is a form, not a lock — show it in a normal window the user can move
  // and Alt+Tab away from. Only once they're set up does Senti take the screen.
  useEffect(() => {
    void window.senti?.setSetupMode?.(needsSetup)
  }, [needsSetup])

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {needsSetup ? (
          <SetupWizard key="setup-wizard" />
        ) : (
          <LockScreen key="lock-screen" />
        )}
      </AnimatePresence>
      <CustomCursor />
      <AudioCaptureTest />
      <VADTest />
      <UtteranceTest />
      <VoiceAuthTest />
    </div>
  )
}

export default App