import { useEffect } from 'react'
import SetupWizard from './components/onboarding/SetupWizard'
import WakeHud from './components/assistant/WakeHud'
import ScreenShareIndicator from './components/assistant/ScreenShareIndicator'
import ControlledBanner from './components/remote/ControlledBanner'
import SettingsPanel from './components/common/SettingsPanel'
import { useSettingsStore } from './state/settingsStore'
import { useWakeStore } from './state/wakeStore'
import { useUiStore } from './state/uiStore'
import { useGreetingStore } from './state/greetingStore'
import { startReporting, stopReporting } from './services/statusReporter'
import { startCommandPolling, stopCommandPolling } from './services/commandPoller'
import { startClipboardSync, stopClipboardSync } from './services/clipboardSync'
import { startRemoteHost, stopRemoteHost } from './services/remoteHost'
import { startProactive, stopProactive } from './services/proactive'
import { startFileHost, stopFileHost } from './services/fileHost'

function App() {
  const settings = useSettingsStore((s) => s)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const securityConfigured = settings.security.pin.trim().length >= 4
  const needsSetup = !settings.setupCompleted || !securityConfigured

  // Senti is NOT a lock screen: once first-time setup is done, you're in.
  const signedIn = !needsSetup

  /**
   * Window modes:
   *   setup — first run, a normal window
   *   panel — a normal window showing the Control Center (from tray/orb)
   *   hud   — the floating orb; listening
   */
  useEffect(() => {
    const mode = needsSetup ? 'setup' : settingsOpen ? 'panel' : 'hud'
    void window.senti?.setWindowMode?.(mode)
    // The orb window is transparent; nothing may paint a background over it.
    document.documentElement.classList.toggle('orb-mode', mode === 'hud')
  }, [needsSetup, settingsOpen])

  // The tray "Open Senti" opens the control center.
  useEffect(() => {
    const off = window.senti?.onOpenSettings?.(() => useUiStore.getState().openSettings())
    return () => off?.()
  }, [])

  // Tap-to-talk hotkey (Ctrl+Shift+Space): open a conversation from anywhere.
  useEffect(() => {
    const off = window.senti?.onTalk?.(() => useWakeStore.getState().engage())
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

  // Copy here, paste on your other machines — while you allow it.
  useEffect(() => {
    if (signedIn && settings.permissions.clipboardSync) startClipboardSync()
    else stopClipboardSync()
  }, [signedIn, settings.permissions.clipboardSync])

  // Listen for another of your machines asking to drive this one. The session
  // still can't do anything until its PIN is verified.
  useEffect(() => {
    if (signedIn && settings.permissions.remoteControl) startRemoteHost()
    else stopRemoteHost()
  }, [signedIn, settings.permissions.remoteControl])

  // Serve files to your other machines, while you allow file access at all.
  useEffect(() => {
    if (signedIn && settings.permissions.files) startFileHost()
    else stopFileHost()
  }, [signedIn, settings.permissions.files])

  // Let Senti notice what you're up to and speak first now and then.
  useEffect(() => {
    if (signedIn && settings.permissions.proactive) startProactive()
    else stopProactive()
  }, [signedIn, settings.permissions.proactive])

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
  return (
    <div className="relative h-full w-full overflow-hidden">
      {!settingsOpen && <WakeHud />}
      <ScreenShareIndicator />
      <ControlledBanner />
      <SettingsPanel />
    </div>
  )
}

export default App
