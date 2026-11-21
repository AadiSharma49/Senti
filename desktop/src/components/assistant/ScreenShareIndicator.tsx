import { useEffect, useState } from 'react'
import { onScreenCaptureChange, onScreenShareChange, stopScreenShare } from '../../services/screenShare'
import { useSettingsStore } from '../../state/settingsStore'

/**
 * Unmissable badge shown the entire time this PC's screen is being captured —
 * whether streaming live to another device or running opt-in background screen
 * context. Clicking stops capture immediately (and turns off background screen
 * watching if that was what opened the stream).
 */
export default function ScreenShareIndicator() {
  const [capturing, setCapturing] = useState(false)
  const [sharing, setSharing] = useState(false)
  useEffect(() => onScreenCaptureChange(setCapturing), [])
  useEffect(() => onScreenShareChange(setSharing), [])

  if (!capturing) return null

  const handleStop = () => {
    if (!sharing && useSettingsStore.getState().permissions.watchScreen) {
      useSettingsStore.getState().setPermissions({ watchScreen: false })
    }
    void stopScreenShare()
  }

  return (
    <button
      onClick={handleStop}
      title={
        sharing
          ? 'Your screen is being shared — click to stop'
          : 'Sentinel is watching your screen in the background — click to stop'
      }
      className="fixed bottom-3 left-3 z-[60] flex items-center gap-2 rounded-full border border-red-400/40 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      {sharing ? 'Sharing screen · stop' : 'Watching screen · stop'}
    </button>
  )
}
