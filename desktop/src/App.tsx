import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import LockScreen from './components/lockscreen/LockScreen'
import SetupWizard from './components/onboarding/SetupWizard'
import WakeHud from './components/assistant/WakeHud'
import CustomCursor from './components/common/CustomCursor'
import AudioCaptureTest from './components/debug/AudioCaptureTest'
import VADTest from './components/debug/VADTest'
import UtteranceTest from './components/debug/UtteranceTest'
import VoiceAuthTest from './components/debug/VoiceAuthTest'
import { useSettingsStore } from './state/settingsStore'
import { useLockStore } from './state/lockStore'
import { useWakeStore } from './state/wakeStore'
import { useGreetingStore } from './state/greetingStore'

function App() {
  const settings = useSettingsStore((s) => s)
  const lockState = useLockStore((s) => s.state)
  const securityConfigured = settings.security.pin.trim().length >= 4
  const needsSetup = !settings.setupCompleted || !securityConfigured
  const unlocked = lockState === 'unlocked'

  /**
   * Three modes, driven from here. Senti is NOT a lock screen — sign-in is a
   * normal window shown once when it starts, then it lives in the tray.
   *   setup  — first run, a normal window
   *   signin — "it's me" once at startup; movable, minimisable, no fullscreen
   *   hud    — after that: a small panel hidden in the tray, still listening
   */
  useEffect(() => {
    const mode = needsSetup ? 'setup' : unlocked ? 'hud' : 'signin'
    void window.senti?.setWindowMode?.(mode)
  }, [needsSetup, unlocked])

  // Greet on unlock. The lock screen used to do this, but it unmounts the
  // moment we switch to the HUD, so it lives here now.
  useEffect(() => {
    if (!unlocked || needsSetup) return
    void useGreetingStore.getState().greet()
    return () => useGreetingStore.getState().reset()
  }, [unlocked, needsSetup])

  // Once unlocked, Senti listens for its name in the background — that's what
  // makes it hands-free from anywhere. Stops the moment it locks again.
  useEffect(() => {
    if (needsSetup) return
    const wake = useWakeStore.getState()
    if (unlocked && settings.permissions.alwaysListening) void wake.start()
    else wake.stop()
  }, [unlocked, needsSetup, settings.permissions.alwaysListening])

  // In HUD mode the lock screen is gone; only the wake panel remains.
  if (!needsSetup && unlocked) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <WakeHud />
      </div>
    )
  }

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
