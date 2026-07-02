import { AnimatePresence } from 'framer-motion'
import LockScreen from './components/lockscreen/LockScreen'
import SetupWizard from './components/onboarding/SetupWizard'
import AudioCaptureTest from './components/debug/AudioCaptureTest'
import VADTest from './components/debug/VADTest'
import UtteranceTest from './components/debug/UtteranceTest'
import VoiceAuthTest from './components/debug/VoiceAuthTest'
import { useSettingsStore } from './state/settingsStore'

function App() {
  const settings = useSettingsStore((s) => s)
  const securityConfigured = settings.security.pin.trim().length >= 4
  const needsSetup = !settings.setupCompleted || !securityConfigured

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {needsSetup ? (
          <SetupWizard key="setup-wizard" />
        ) : (
          <LockScreen key="lock-screen" />
        )}
      </AnimatePresence>
      <AudioCaptureTest />
      <VADTest />
      <UtteranceTest />
      <VoiceAuthTest />
    </div>
  )
}

export default App