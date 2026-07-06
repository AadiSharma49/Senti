'use client'

import { useEffect, useState } from 'react'
import { usePolicy } from './usePolicy'

/**
 * Voice match sensitivity — a real slider bound to the account policy's
 * voiceThreshold. Higher = stricter (fewer false accepts). Commits on
 * release so we don't spam the API while dragging.
 */
export default function VoiceSensitivity() {
  const { policy, loading, saving, save } = usePolicy()
  const [value, setValue] = useState(policy.voiceThreshold)

  useEffect(() => {
    setValue(policy.voiceThreshold)
  }, [policy.voiceThreshold])

  const label = value >= 0.6 ? 'Strict' : value >= 0.45 ? 'Balanced' : 'Lenient'

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/80">Voice sensitivity</div>
        <div className="text-sm font-semibold text-accent">
          {label} · {value.toFixed(2)}
        </div>
      </div>
      <input
        type="range"
        min={0.3}
        max={0.7}
        step={0.01}
        value={value}
        disabled={loading}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        onPointerUp={() => save({ voiceThreshold: value })}
        onKeyUp={() => save({ voiceThreshold: value })}
        className="mt-3 w-full accent-[#00d4ff]"
      />
      <div className="mt-1 flex justify-between text-xs text-white/35">
        <span>Lenient</span>
        <span>{saving ? 'Saving…' : 'Strict'}</span>
      </div>
    </div>
  )
}
