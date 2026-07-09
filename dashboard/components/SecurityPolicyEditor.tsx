'use client'

import { usePolicy } from './usePolicy'

function Stepper({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => set(value - step)}
        disabled={disabled || value <= min}
        className="h-8 w-8 rounded-lg border border-white/10 text-white/80 transition hover:bg-white/5 disabled:opacity-40"
      >
        −
      </button>
      <div className="min-w-[3.5rem] text-center text-sm font-semibold text-accent">
        {value}
        {suffix}
      </div>
      <button
        onClick={() => set(value + step)}
        disabled={disabled || value >= max}
        className="h-8 w-8 rounded-lg border border-white/10 text-white/80 transition hover:bg-white/5 disabled:opacity-40"
        aria-label={`increase ${label}`}
      >
        +
      </button>
    </div>
  )
}

/**
 * Editable account security policy. Saves to /api/policy; the desktop
 * reads it and obeys.
 */
export default function SecurityPolicyEditor() {
  const { policy, loading, saving, save } = usePolicy()

  return (
    <div className="grid gap-3">
      <Row label="Voice unlock" desc="Your voice unlocks Senti">
        <span className="text-sm font-medium text-accent">On</span>
      </Row>

      <Row label="Max attempts before lockout" desc="Failed PIN attempts">
        <Stepper
          label="max attempts"
          value={policy.maxAttempts}
          min={1}
          max={10}
          step={1}
          onChange={(v) => save({ maxAttempts: v })}
          disabled={loading}
        />
      </Row>

      <Row label="Lockout duration" desc="Cool-down after lockout">
        <Stepper
          label="lockout duration"
          value={policy.lockoutDuration}
          min={5}
          max={300}
          step={5}
          suffix="s"
          onChange={(v) => save({ lockoutDuration: v })}
          disabled={loading}
        />
      </Row>

      <Row label="Telegram recovery" desc="Remote unlock via Telegram bot">
        <span className="text-sm text-white/35">Not set up</span>
      </Row>

      <div className="h-4 text-xs text-white/40">
        {loading ? 'Loading…' : saving ? 'Saving…' : 'Saved · syncs to your devices'}
      </div>
    </div>
  )
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] px-4 py-3">
      <div>
        <div className="text-sm text-white/85">{label}</div>
        <div className="text-xs text-white/40">{desc}</div>
      </div>
      {children}
    </div>
  )
}
