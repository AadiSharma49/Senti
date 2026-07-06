'use client'

import { usePolicy } from './usePolicy'
import type { SecurityMode } from '@/lib/policy'

const OPTIONS: { id: SecurityMode; title: string; body: string }[] = [
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
 * Security mode selector — reads and writes the real account policy, so
 * the choice persists and syncs to devices.
 */
export default function SecurityModeSelector() {
  const { policy, loading, saving, save } = usePolicy()

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const active = policy.securityMode === o.id
          return (
            <button
              key={o.id}
              onClick={() => save({ securityMode: o.id })}
              disabled={loading}
              className={`text-left rounded-2xl border p-4 transition disabled:opacity-60 ${
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
      <div className="mt-3 h-4 text-xs text-white/40">
        {loading ? 'Loading…' : saving ? 'Saving…' : 'Saved · applies to your devices'}
      </div>
    </div>
  )
}
