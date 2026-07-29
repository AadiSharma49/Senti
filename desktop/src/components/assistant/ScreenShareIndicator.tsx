import { useEffect, useState } from 'react'
import { onScreenShareChange, stopScreenShare } from '../../services/screenShare'

/**
 * A small, unmissable badge shown the entire time this PC is streaming its
 * screen. Screen sharing is remote access to your OWN machine — so it must
 * never be invisible. Tapping it stops the stream immediately.
 */
export default function ScreenShareIndicator() {
  const [sharing, setSharing] = useState(false)
  useEffect(() => onScreenShareChange(setSharing), [])

  if (!sharing) return null

  return (
    <button
      onClick={() => void stopScreenShare()}
      title="Your screen is being shared — click to stop"
      className="fixed bottom-3 left-3 z-[60] flex items-center gap-2 rounded-full border border-red-400/40 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      Sharing screen · stop
    </button>
  )
}
