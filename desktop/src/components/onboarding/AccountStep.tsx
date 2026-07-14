import React, { useState } from 'react'
import { useDeviceStore } from '../../state/deviceStore'
import { syncPolicyFromDashboard } from '../../services/policySync'
import { ensureVoiceprint } from '../../services/voiceprintSync'
import { apiBase } from '../../config'

/**
 * First step of setup: link this machine to a Senti account.
 *
 * This comes BEFORE the PIN and the voice, deliberately. The pairing token is
 * what lets Senti greet you by name, sync your voiceprint across machines, and
 * reach the assistant at all. A user who skipped it used to sail through the
 * whole wizard and only discover, later and silently, that Senti could not
 * think or speak.
 *
 * The token is verified against the server immediately — a typo fails here,
 * where it can be fixed, rather than mysteriously later.
 */
interface AccountStepProps {
  onLinked: () => void
}

export default function AccountStep({ onLinked }: AccountStepProps) {
  const linked = useDeviceStore((s) => s.linked)
  const link = useDeviceStore((s) => s.link)
  const unlink = useDeviceStore((s) => s.unlink)

  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const value = token.trim()
    if (!value || busy) return
    setBusy(true)
    setError(null)

    const stored = await link(value)
    if (!stored) {
      setError('Windows refused to store the token securely. Cannot link this device.')
      setBusy(false)
      return
    }

    // Prove the token actually works before letting the user move on.
    const ok = await syncPolicyFromDashboard()
    if (!ok) {
      await unlink()
      setError(
        `That token was rejected by ${apiBase()}. Copy it again from your dashboard — each token can only be used by one device.`
      )
      setBusy(false)
      return
    }

    // A machine that already has a voiceprint on the account skips enrollment.
    await ensureVoiceprint()
    setBusy(false)
    onLinked()
  }

  if (linked) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-green-400/30 bg-green-500/10 p-4 text-sm text-green-300">
        <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
        Linked to your Senti account.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-secondary">
        Senti needs to know whose computer this is. Sign in on your dashboard, open{' '}
        <span className="text-white">Devices</span>, click <span className="text-white">Link a device</span>,
        and paste the pairing token here.
      </p>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-secondary">
        Your dashboard: <span className="font-mono text-accent">{apiBase()}/dashboard/devices</span>
      </div>

      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
        }}
        placeholder="Paste your pairing token"
        spellCheck={false}
        autoFocus
        className="input-glass font-mono"
      />

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
      )}

      <button
        onClick={() => void submit()}
        disabled={!token.trim() || busy}
        className={`justify-self-start rounded-2xl px-6 py-3 text-sm font-semibold transition ${
          token.trim() && !busy
            ? 'bg-accent text-black hover:bg-accent-glow'
            : 'cursor-not-allowed bg-white/10 text-white/40'
        }`}
      >
        {busy ? 'Verifying…' : 'Link this device'}
      </button>
    </div>
  )
}
