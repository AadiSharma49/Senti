'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import SentiMark from './SentiMark'

interface AuthCardProps {
  mode: 'login' | 'signup'
}

/**
 * Auth UI shell. Wiring to a real auth provider (Clerk / NextAuth) and
 * the accounts API is the next slice — for now this validates input and
 * routes into the dashboard so the flow is clickable end to end.
 */
export default function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter()
  const isSignup = mode === 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (isSignup && name.trim().length < 2) return setError('Please enter your name.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    // TODO: call accounts API. For now, proceed into the dashboard.
    router.push('/dashboard')
  }

  return (
    <div className="bg-ambient flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <SentiMark size={40} />
          <span className="text-xl font-semibold tracking-wide">Senti</span>
        </Link>

        <div className="glass-strong rounded-[28px] p-8">
          <h1 className="text-2xl font-bold text-white">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {isSignup
              ? 'One account for every device you install Senti on.'
              : 'Sign in to manage your devices and voice profile.'}
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4">
            {isSignup && (
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="auth-input"
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-input"
              />
            </Field>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-glow"
            >
              {isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/50">
            {isSignup ? (
              <>Already have an account? <Link href="/login" className="text-accent hover:underline">Sign in</Link></>
            ) : (
              <>New to Senti? <Link href="/signup" className="text-accent hover:underline">Create an account</Link></>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</span>
      {children}
    </label>
  )
}
