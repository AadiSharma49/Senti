'use client'

import { useState } from 'react'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function WaitlistForm({ source = 'landing' }: { source?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setStatus('error')
        setError(data.error || 'Something went wrong.')
        return
      }
      setStatus('done')
    } catch {
      setStatus('error')
      setError('Network error. Please try again.')
    }
  }

  if (status === 'done') {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-full border border-green-400/30 bg-green-500/10 px-6 py-4 text-sm text-green-300">
        <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
        You&apos;re on the list. We&apos;ll email you when early access opens.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-full border border-white/12 bg-black/40 px-5 py-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-accent/60 focus:ring-2 focus:ring-accent/15"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-black transition hover:bg-accent-glow disabled:opacity-60"
        >
          {status === 'loading' ? 'Joining…' : 'Get early access'}
        </button>
      </div>
      {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
      <div className="mt-3 text-xs text-white/35">No spam. One email when it&apos;s ready.</div>
    </form>
  )
}
