import React, { useEffect, useRef, useState } from 'react'
import { AudioCapture } from '../../services/audioCapture'
import {
  HEARD_LEVEL,
  defaultOptionLabel,
  meterLevel,
  resolveMic,
  type MicInventory,
} from '../../services/micChoice'

/**
 * "Which microphone should Sentinel listen on?" — asked, not assumed.
 *
 * Picking a device opens it right away (exactly that device, no fallback) and
 * shows a live meter, so the user finds out HERE that the webcam mic across
 * the room is the one Windows chose — not later, as "it can't hear me".
 *
 * Runs its own capture instance, separate from the always-listening one, so
 * testing a candidate never interrupts Sentinel. Nothing is saved until the
 * user confirms.
 */
interface MicPickerProps {
  /** Called after the choice is saved. */
  onChosen?: (label: string) => void
  confirmLabel?: string
}

/** Seconds of silence on the test before suggesting another device. */
const QUIET_HINT_MS = 6000

export default function MicPicker({ onChosen, confirmLabel = 'Use this microphone' }: MicPickerProps) {
  const [inventory, setInventory] = useState<MicInventory>({ inputs: [], windowsDefault: null })
  const [loaded, setLoaded] = useState(false)
  const saved = useRef(AudioCapture.savedMic()).current
  // Chromium's alias entries aren't listed as choices; older builds could
  // save them, so start such users on the plain Windows default option.
  const [selected, setSelected] = useState<string>(
    saved.id === 'default' || saved.id === 'communications' ? '' : saved.id
  )
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState(false)
  const [quiet, setQuiet] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)

  // Device list, kept live: plugging a headset in mid-setup should just appear.
  // `loaded` waits for the first test open below: before permission is
  // granted the list comes back without ids or names, and judging "is the
  // saved mic connected?" from that would wrongly say no.
  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const inv = await AudioCapture.inventory()
      if (alive) setInventory(inv)
    }
    void refresh()
    const md = navigator.mediaDevices
    md?.addEventListener?.('devicechange', refresh)
    return () => {
      alive = false
      md?.removeEventListener?.('devicechange', refresh)
    }
  }, [])

  // Once the list is known, keep the selection pointing at something real.
  useEffect(() => {
    if (!loaded || !selected) return
    const res = resolveMic({ id: selected, label: saved.label }, inventory)
    if (res.kind === 'relabeled') setSelected(res.id)
    else if (res.kind === 'missing') setSelected('')
  }, [loaded, inventory, selected, saved.label])

  // Live test of the selected device. A fresh capture per selection: reusing
  // one would let a slow open for the previous pick finish after the new one
  // started, leaving two streams on one instance.
  useEffect(() => {
    let alive = true
    const capture = new AudioCapture()
    setLevel(0)
    setHeard(false)
    setQuiet(false)
    setTestError(null)

    let last = 0
    capture.subscribe((_frame, l) => {
      const now = Date.now()
      if (now - last < 90) return
      last = now
      const v = meterLevel(l.rms)
      setLevel(v)
      if (v >= HEARD_LEVEL) {
        setHeard(true)
        setQuiet(false)
      }
    })
    const quietTimer = window.setTimeout(() => alive && setQuiet(true), QUIET_HINT_MS)

    // The first open is what grants permission; only then do device ids and
    // names show up, so read the list again either way.
    const relist = async () => {
      const inv = await AudioCapture.inventory()
      if (!alive) return
      setInventory(inv)
      setLoaded(true)
    }
    capture
      .start({ deviceId: selected })
      .then(() => {
        // Unmounted or re-selected while the device was opening: close it now.
        if (!alive) capture.dispose()
        else void relist()
      })
      .catch((err) => {
        if (!alive) return
        void relist()
        setTestError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Windows is blocking microphone access. Open Settings → Privacy & security → Microphone and allow desktop apps.'
            : "Couldn't open this microphone. It may be in use or unplugged — try another."
        )
      })

    return () => {
      alive = false
      clearTimeout(quietTimer)
      capture.dispose()
    }
  }, [selected])

  const options = [
    { id: '', label: defaultOptionLabel(inventory) },
    ...inventory.inputs,
  ]
  const missingSaved =
    loaded && saved.id && resolveMic(saved, inventory).kind === 'missing' ? saved.label || 'your chosen microphone' : null

  const confirm = () => {
    const label = selected ? inventory.inputs.find((m) => m.id === selected)?.label ?? '' : ''
    AudioCapture.chooseMic(selected, label)
    onChosen?.(label)
  }

  return (
    <div className="grid gap-3">
      {missingSaved && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          You picked &ldquo;{missingSaved}&rdquo;, but it isn&apos;t connected right now.
        </div>
      )}

      <div role="radiogroup" aria-label="Microphone" className="grid gap-2">
        {options.map((m) => {
          const on = m.id === selected
          return (
            <button
              key={m.id || 'windows-default'}
              role="radio"
              aria-checked={on}
              onClick={() => setSelected(m.id)}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${
                on ? 'border-accent/60 bg-accent/10 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  on ? 'border-accent' : 'border-white/30'
                }`}
              >
                {on && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{m.label}</span>
            </button>
          )
        })}
        {loaded && inventory.inputs.length === 0 && (
          <div className="text-xs text-white/40">
            No other microphones found. Plug one in and it will show up here.
          </div>
        )}
      </div>

      {/* The proof: talk, and watch it move. */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-white/35">Test</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ${heard ? 'bg-green-400' : 'bg-accent/60'}`}
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
        </div>
        <div className="mt-2" aria-live="polite">
          {testError ? (
            <span className="text-red-300">{testError}</span>
          ) : heard ? (
            <span className="text-green-400">✓ Sentinel can hear you on this microphone.</span>
          ) : quiet ? (
            <span className="text-amber-300">
              Nothing yet. If you&apos;re talking and the bar isn&apos;t moving, pick another microphone.
            </span>
          ) : (
            <span className="text-white/45">Say something — the bar should jump when you talk.</span>
          )}
        </div>
      </div>

      <button
        onClick={confirm}
        disabled={!!testError}
        className={`justify-self-start rounded-2xl px-6 py-3 text-sm font-semibold transition ${
          testError ? 'cursor-not-allowed bg-white/10 text-white/40' : 'bg-accent text-black hover:bg-accent-glow'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  )
}
