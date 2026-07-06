'use client'

import { useState } from 'react'

type Mode = 'phrase_and_voice' | 'voice_only'

const OPTIONS: { id: Mode; title: string; body: string }[] = [
  {
    id: 'phrase_and_voice',
    title: 'Phrase + Voice',
    body: 'Unlock needs the right wake phrase AND your voice. Most secure.',
  },
  {
    id: 'voice_only',
    title: 'Voice only',
    body: 'Any words unlock, as long as it’s your voice. More convenient.',
  },
]

/**
 * Security mode selector. On the dashboard the user chooses how strict
 * voice unlock is; this policy syncs down to their devices (sync backend
 * pending). For now it updates local UI state.
 */
export default function SecurityModeSelector({ initial = 'phrase_and_voice' }: { initial?: Mode }) {
  const [mode, setMode] = useState<Mode>(initial)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const active = mode === o.id
        return (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            className={`text-left rounded-2xl border p-4 transition ${
              active
                ? 'border-accent/60 bg-accent/10 accent-ring'
                : 'border-white/10 bg-white/[0.03] hover:border-accent/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">{o.title}</div>
              <span
                className={`h-4 w-4 rounded-full border ${
                  active ? 'border-accent bg-accent' : 'border-white/30'
                }`}
              />
            </div>
            <div className="mt-1 text-xs text-white/55">{o.body}</div>
          </button>
        )
      })}
    </div>
  )
}
