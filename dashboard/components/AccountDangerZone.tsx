'use client'

import { useEffect, useRef, useState } from 'react'
import { useClerk } from '@clerk/nextjs'

/**
 * Mounted ONLY when `ClerkProvider` wraps the app (`clerkEnabled === true`) so
 * local/unconfigured dev renders never call `useClerk()` outside a provider.
 */
function ClerkSignOutBridge({
  onReady,
}: {
  onReady: (fn: (redirectUrl: string) => Promise<void>) => void
}) {
  const { signOut } = useClerk()
  useEffect(() => {
    onReady(async (redirectUrl: string) => {
      await signOut({ redirectUrl })
    })
  }, [onReady, signOut])
  return null
}

type Mode = 'idle' | 'confirm-signout' | 'confirm-delete'

export default function AccountDangerZone({ clerkEnabled }: { clerkEnabled: boolean }) {
  const signOutRef = useRef<((redirectUrl: string) => Promise<void>) | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finishRedirect = async (redirectUrl: string) => {
    try {
      if (signOutRef.current) {
        await signOutRef.current(redirectUrl)
        return
      }
    } catch {
      // Session was already revoked server-side; fall through to hard navigation.
    }
    window.location.assign(redirectUrl)
  }

  const handleSignOutAll = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign_out_all' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not sign out all devices.')
        setBusy(false)
        return
      }
      await finishRedirect('/login')
    } catch {
      setError('Network error while signing out all devices.')
      setBusy(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not delete account.')
        setBusy(false)
        return
      }
      await finishRedirect('/')
    } catch {
      setError('Network error while deleting account.')
      setBusy(false)
    }
  }

  if (!clerkEnabled) {
    return (
      <p className="mt-3 text-sm text-white/45">
        Account session revocation and deletion become available once Clerk authentication is configured.
      </p>
    )
  }

  return (
    <div className="mt-4">
      <ClerkSignOutBridge onReady={(fn) => { signOutRef.current = fn }} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null)
            setMode(mode === 'confirm-signout' ? 'idle' : 'confirm-signout')
          }}
          className="rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          Sign out all devices
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setError(null)
            setConfirmText('')
            setMode(mode === 'confirm-delete' ? 'idle' : 'confirm-delete')
          }}
          className="rounded-full border border-red-400/30 px-5 py-2.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          Delete account
        </button>
      </div>

      {mode === 'confirm-signout' && (
        <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/[0.06] p-4">
          <p className="text-sm text-white/85">
            This signs out every active browser session and unlinks all paired Sentinel PCs (revoking
            their device tokens and ending any live remote sessions). You will need to sign back in and
            re-link your PCs.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSignOutAll()}
              className="rounded-full bg-red-500/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              {busy ? 'Signing out everywhere…' : 'Confirm sign out everywhere'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode('idle')}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/75 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {mode === 'confirm-delete' && (
        <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/[0.06] p-4">
          <p className="text-sm text-white/85">
            This permanently deletes your Sentinel account, unlinks every paired PC, and removes all
            devices, remote sessions, and shared clipboard data stored on the server. Type{' '}
            <span className="font-mono font-semibold text-red-300">DELETE</span> to confirm.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={confirmText}
              disabled={busy}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              aria-label="Type DELETE to confirm account deletion"
              className="w-40 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none focus:border-red-400/60"
            />
            <button
              type="button"
              disabled={busy || confirmText !== 'DELETE'}
              onClick={() => void handleDeleteAccount()}
              className="rounded-full bg-red-500/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Deleting account…' : 'Permanently delete account'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmText('')
                setMode('idle')
              }}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/75 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  )
}
