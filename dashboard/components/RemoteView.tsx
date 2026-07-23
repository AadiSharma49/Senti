'use client'

import { useEffect, useState } from 'react'
import { Card } from './ui'

interface DeviceLive {
  id: string
  name: string
  os: string
  status: string
  activity: string | null
  vitals: string | null
  reportedAt: string | null
  lastSeen: string | null
}

/** "3s ago", "5m ago" — how fresh the report is. */
function ago(iso: string | null): string {
  if (!iso) return 'never'
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** A device is "live" if it reported within the last ~90s. */
function isLive(d: DeviceLive): boolean {
  const t = d.reportedAt || d.lastSeen
  return !!t && Date.now() - new Date(t).getTime() < 90_000
}

const dot: Record<string, string> = {
  working: 'bg-accent',
  online: 'bg-green-400',
  idle: 'bg-green-400',
  offline: 'bg-white/25',
}

export default function RemoteView({ initial }: { initial: DeviceLive[] }) {
  const [devices, setDevices] = useState<DeviceLive[]>(initial)
  const [, tick] = useState(0)

  // Poll the live endpoint, and tick a clock so the "Xs ago" labels stay honest.
  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const res = await fetch('/api/devices/live', { cache: 'no-store' })
        if (res.ok && alive) {
          const data = await res.json()
          if (Array.isArray(data.devices)) setDevices(data.devices)
        }
      } catch {
        // keep the last snapshot
      }
    }
    const p = setInterval(poll, 4000)
    const c = setInterval(() => tick((n) => n + 1), 1000)
    return () => {
      alive = false
      clearInterval(p)
      clearInterval(c)
    }
  }, [])

  if (devices.length === 0) {
    return (
      <Card>
        <div className="py-6 text-center text-sm text-white/55">
          No devices yet. Install Senti and link it — then it will show up here, live.
        </div>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      {devices.map((d) => {
        const live = isLive(d)
        const state = live ? d.status : 'offline'
        return (
          <Card key={d.id} className="relative overflow-hidden">
            {state === 'working' && (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(0,212,255,0.10),transparent_60%)]" />
            )}
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot[state] ?? 'bg-white/25'} ${state === 'working' ? 'animate-pulse' : ''}`} />
                  <span className="truncate font-semibold text-white">{d.name}</span>
                  <span className="text-xs text-white/35">{d.os}</span>
                </div>

                <div className="mt-3 text-sm text-white/80">
                  {live ? (
                    <>
                      <span className="text-xs uppercase tracking-[0.2em] text-accent">
                        {state === 'working' ? 'Working' : 'Ready'}
                      </span>
                      <div className="mt-1 line-clamp-2 text-white/85">{d.activity || 'Idle — waiting for you.'}</div>
                    </>
                  ) : (
                    <span className="text-white/45">Offline — last seen {ago(d.lastSeen)}.</span>
                  )}
                </div>

                {d.vitals && live && <div className="mt-2 text-xs text-white/45">{d.vitals}</div>}
              </div>

              <div className="shrink-0 text-right text-xs text-white/35">
                {live ? `updated ${ago(d.reportedAt || d.lastSeen)}` : ''}
              </div>
            </div>
          </Card>
        )
      })}

      <p className="text-center text-xs text-white/35">
        Updates on its own. Say &ldquo;Senti, …&rdquo; on your PC and watch it change here.
      </p>
    </div>
  )
}
