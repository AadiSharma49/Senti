import { useEffect, useState } from 'react'
import { onControlledChange, endControlSession } from '../../services/remoteHost'

/**
 * Shown the whole time another machine is driving this one.
 *
 * Someone operating your computer must never be a silent state, so this is
 * loud and always on top — and its button ends the session immediately.
 * Whoever is physically at the machine always outranks whoever is remote.
 */
export default function ControlledBanner() {
  const [controlled, setControlled] = useState(false)
  useEffect(() => onControlledChange(setControlled), [])

  if (!controlled) return null

  return (
    <div
      className="fixed left-1/2 top-3 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-full border border-amber-400/50 bg-black/80 px-4 py-2 text-sm text-white shadow-lg backdrop-blur"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
      </span>
      Someone is controlling this PC remotely
      <button
        onClick={() => void endControlSession()}
        className="rounded-full border border-red-400/50 bg-red-500/15 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/30"
      >
        Stop
      </button>
    </div>
  )
}
