'use client'

import { useCallback, useEffect, useState } from 'react'

interface Device {
  id: string
  name: string
  os: string
  status: string
  linked: boolean
  voiceEnrolled: boolean
  lastSeen: string
}

const toneClass: Record<string, string> = {
  online: 'bg-green-400/15 text-green-300',
  locked: 'bg-accent/15 text-accent',
  offline: 'bg-white/10 text-white/40',
}

export default function DevicesManager() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/device/link')
      if (res.ok) setDevices(await res.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const linkDevice = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/device/link', { method: 'POST' })
      const data = await res.json()
      if (data.token) setToken(data.token)
      await load()
    } finally {
      setCreating(false)
    }
  }

  const unlink = async (id: string) => {
    await fetch('/api/device/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    await load()
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-white/50">
          {loading ? 'Loading…' : `${devices.length} device${devices.length === 1 ? '' : 's'}`}
        </div>
        <button
          onClick={linkDevice}
          disabled={creating}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-accent-glow disabled:opacity-60"
        >
          {creating ? 'Creating…' : 'Link a device'}
        </button>
      </div>

      {token && (
        <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <div className="text-sm font-semibold text-white">Pairing token</div>
          <p className="mt-1 text-xs text-white/60">
            In Senti on your computer, open Settings → Link to account, and paste this token.
            It won&apos;t be shown again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-black/40 px-3 py-2 text-xs text-accent">
              {token}
            </code>
            <button
              onClick={() => navigator.clipboard?.writeText(token)}
              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80 transition hover:bg-white/5"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {devices.length === 0 && !loading && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-white/45">
          No devices yet. Click “Link a device”, then paste the token into Senti on your computer.
        </div>
      )}

      {devices.map((d) => (
        <div
          key={d.id}
          className="glass flex flex-col gap-4 rounded-3xl p-5 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-white/70">▢</div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{d.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${toneClass[d.status] ?? toneClass.offline}`}>
                  {d.linked ? d.status : 'not linked'}
                </span>
              </div>
              <div className="mt-1 text-xs text-white/45">
                {d.os} · last seen {new Date(d.lastSeen).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs ${
                d.voiceEnrolled ? 'bg-green-400/15 text-green-300' : 'bg-white/10 text-white/50'
              }`}
            >
              {d.voiceEnrolled ? 'Voice enrolled' : 'No voice profile'}
            </span>
            <button
              onClick={() => unlink(d.id)}
              className="rounded-full border border-red-400/30 px-4 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
