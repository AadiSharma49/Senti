import { AnimatePresence } from 'framer-motion'
import LockScreen from './components/lockscreen/LockScreen'
import SetupWizard from './components/onboarding/SetupWizard'
import { ThemeProvider } from './theme/ThemeProvider'
import { useSettingsStore } from './state/settingsStore'
import ClapDetectionDeveloper from './components/training/ClapDetectionDeveloper'

function App() {
  const settings = useSettingsStore((s) => s)
  const identityConfigured =
    settings.identity.username.trim().length > 0 &&
    settings.identity.preferredName.trim().length > 0 &&
    settings.identity.preferredTitle.trim().length > 0
  const securityConfigured = settings.security.pin.trim().length >= 4
  const needsSetup = !settings.setupCompleted || !identityConfigured || !securityConfigured

  return (
    <ThemeProvider>
      <div className="relative w-full h-full overflow-hidden">
        <AnimatePresence mode="wait">
          {needsSetup ? (
            <SetupWizard key="setup-wizard" />
          ) : (
            <LockScreen key="lock-screen" />
          )}
        </AnimatePresence>
        <ClapDetectionDeveloper />
      </div>
    </ThemeProvider>
  )
}

export default App
