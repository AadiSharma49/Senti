import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import SentiMark from './SentiMark'
import { clerkEnabled } from '@/lib/auth'

/**
 * Site header. Auth-aware: a signed-in visitor gets their profile and a way
 * into the dashboard, not a "Sign in" button they've already used.
 */
export default function SiteHeader() {
  const signedIn = clerkEnabled ? !!auth().userId : false

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <SentiMark size={30} />
          <span className="text-lg font-semibold tracking-wide">Senti</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          <a href="/#features" className="transition hover:text-white">Features</a>
          <a href="/#vision" className="transition hover:text-white">Vision</a>
          <Link href="/download" className="transition hover:text-white">Download</Link>
        </nav>

        <div className="flex items-center gap-3">
          {signedIn ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent-glow"
              >
                Dashboard
              </Link>
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: 'h-9 w-9' } }}
              />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-white/70 transition hover:text-white">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-black transition hover:bg-accent-glow"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
