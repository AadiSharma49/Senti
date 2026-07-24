import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import LockScreen from './components/lockscreen/LockScreen'
import SetupWizard from './components/onboarding/SetupWizard'
import WakeHud from './components/assistant/WakeHud'
import SettingsPanel from './components/common/SettingsPanel'
import AudioCaptureTest from './components/debug/AudioCaptureTest'
import VADTest from './components/debug/VADTest'
import UtteranceTest from './components/debug/UtteranceTest'
import VoiceAuthTest from './components/debug/VoiceAuthTest'
import { useSettingsStore } from './state/settingsStore'
import { useLockStore } from './state/lockStore'
import { useWakeStore } from './state/wakeStore'
import { useUiStore } from './state/uiStore'
import { useGreetingStore } from './state/greetingStore'
import { startReporting, stopReporting } from './services/statusReporter'
import { startCommandPolling, stopCommandPolling } from './services/commandPoller'

function App() {
  const settings = useSettingsStore((s) => s)
  const lockState = useLockStore((s) => s.state)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const securityConfigured = settings.security.pin.trim().length >= 4
  const needsSetup = !settings.setupCompleted || !securityConfigured
  const requireSignIn = settings.requireSignIn
  const unlocked = lockState === 'unlocked'

  // Returning users go STRAIGHT to Senti — no sign-in gate every launch, unless
  // they explicitly asked for one. Signing in once (at setup) is enough.
  useEffect(() => {
    if (!needsSetup && !requireSignIn && !unlocked) {
      useLockStore.getState().authSuccess()
    }
  }, [needsSetup, requireSignIn, unlocked])

  const signedIn = !needsSetup && (unlocked || !requireSignIn)

  /**
   * Window modes:
   *   setup  — first run, a normal window
   *   signin — the once-per-launch "it's me" screen (only if requireSignIn)
   *   panel  — a normal window showing Settings (reachable from the tray/orb)
   *   hud    — the floating orb; listening
   */
  useEffect(() => {
    const mode = needsSetup ? 'setup' : !signedIn ? 'signin' : settingsOpen ? 'panel' : 'hud'
    void window.senti?.setWindowMode?.(mode)
    // The orb window is transparent; nothing may paint a background over it.
    document.documentElement.classList.toggle('orb-mode', mode === 'hud')
  }, [needsSetup, signedIn, settingsOpen])

  // The tray "Open Senti" opens the control center.
  useEffect(() => {
    const off = window.senti?.onOpenSettings?.(() => useUiStore.getState().openSettings())
    return () => off?.()
  }, [])

  // Greet once, when Senti comes online.
  useEffect(() => {
    if (!signedIn) return
    void useGreetingStore.getState().greet()
    return () => useGreetingStore.getState().reset()
  }, [signedIn])

  // Listen for "Senti" in the background — hands-free from anywhere.
  useEffect(() => {
    const wake = useWakeStore.getState()
    if (signedIn && settings.permissions.alwaysListening) void wake.start()
    else wake.stop()
  }, [signedIn, settings.permissions.alwaysListening])

  // Report live status, and watch for commands sent from your phone.
  useEffect(() => {
    if (signedIn) {
      startReporting()
      startCommandPolling()
    } else {
      stopReporting()
      stopCommandPolling()
    }
  }, [signedIn])

  // Setup wizard — its own full-window flow.
  if (needsSetup) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <SetupWizard />
        <SettingsPanel />
      </div>
    )
  }

  // Signed in: the orb (hidden while the control center is open), plus Settings.
  if (signedIn) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        {!settingsOpen && <WakeHud />}
        <SettingsPanel />
      </div>
    )
  }

  // Once-per-launch sign-in (only when the user opted into it).
  return (
    <div className="relative w-full h-full overflow-hidden">
      <LockScreen />
      <AudioCaptureTest />
      <VADTest />
      <UtteranceTest />
      <VoiceAuthTest />
    </div>
  )
}

export default App
