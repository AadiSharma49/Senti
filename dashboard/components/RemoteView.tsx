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

/**
 * The web view is deliberately a WINDOW, not a control panel: see your
 * machines and watch a screen. Everything that acts on a PC — cleanup, power,
 * launching apps, full mouse/keyboard control — lives in the Senti app itself,
 * where it's behind the device's own permission dial and remote PIN. One place
 * that does things, one place that shows them.
 */

export default function RemoteView({ initial }: { initial: DeviceLive[] }) {
  const [devices, setDevices] = useState<DeviceLive[]>(initial)
  const [, tick] = useState(0)
  // Per-device note of what we just sent, so a tap gives instant feedback.
  const [sent, setSent] = useState<Record<string, string>>({})
  // Live screen per device: the latest frame and whether the PC is still sharing.
  const [screens, setScreens] = useState<Record<string, { frame: string | null; sharing: boolean }>>({})

  const send = async (deviceId: string, label: string, action: string, args?: Record<string, string>) => {
    setSent((s) => ({ ...s, [deviceId]: `Sending ${label}…` }))
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, action, ...args }),
      })
      setSent((s) => ({
        ...s,
        [deviceId]: res.ok ? `${label} sent — your PC will pick it up.` : `Could not send ${label}.`,
      }))
    } catch {
      setSent((s) => ({ ...s, [deviceId]: 'No connection.' }))
    }
    setTimeout(() => setSent((s) => ({ ...s, [deviceId]: '' })), 6000)
  }

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

  // Pull the live screen frame for every device, ~once a second — matching the
  // rate the PC uploads. Cheap because it's one small JPEG per tick.
  useEffect(() => {
    let alive = true
    const pull = async () => {
      for (const d of devices) {
        try {
          const res = await fetch(`/api/screen?deviceId=${d.id}`, { cache: 'no-store' })
          if (!res.ok || !alive) continue
          const data = await res.json()
          setScreens((s) => ({ ...s, [d.id]: { frame: data.frame ?? null, sharing: !!data.sharing } }))
        } catch {
          // keep the last frame
        }
      }
    }
    const t = setInterval(pull, 1200)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [devices])

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

            {/* Live screen — watch this PC from here. */}
            <div className="relative mt-4 border-t border-white/5 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-white/45">Live screen</span>
                <button
                  onClick={() =>
                    send(
                      d.id,
                      screens[d.id]?.sharing ? 'Stop screen' : 'Share screen',
                      'screen_share',
                      { on: screens[d.id]?.sharing ? 'false' : 'true' }
                    )
                  }
                  disabled={!live}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    !live
                      ? 'cursor-not-allowed border-white/5 text-white/25'
                      : screens[d.id]?.sharing
                      ? 'border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                  }`}
                >
                  {screens[d.id]?.sharing ? 'Stop' : 'Share screen'}
                </button>
              </div>
              {screens[d.id]?.frame ? (
                <img
                  src={screens[d.id].frame as string}
                  alt="Live screen"
                  className="w-full rounded-lg border border-white/10"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-white/30">
                  {live ? 'Tap “Share screen” to see this PC live.' : 'PC offline.'}
                </div>
              )}
              {sent[d.id] && <div className="mt-2 text-xs text-accent">{sent[d.id]}</div>}
            </div>
          </Card>
        )
      })}

      <p className="text-center text-xs text-white/35">
        Updates on its own. To actually control a machine — mouse, keyboard, cleanup, power —
        open Senti on any of your devices and use My devices there.
      </p>
    </div>
  )
}
