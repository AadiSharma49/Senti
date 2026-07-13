import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'
import AuthCard from '@/components/AuthCard'
import SentiMark from '@/components/SentiMark'
import { clerkEnabled } from '@/lib/auth'

export default function SignupPage() {
  if (!clerkEnabled) return <AuthCard mode="signup" />

  // Same as /login: <SignUp/> can't render for a signed-in user, and Clerk's
  // silent bounce looks like a broken page. Redirect deliberately.
  const { userId } = auth()
  if (userId) redirect('/dashboard')

  return (
    <div className="bg-ambient flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <Link href="/" className="flex items-center gap-3">
        <SentiMark size={40} />
        <span className="text-xl font-semibold tracking-wide">Senti</span>
      </Link>
      <SignUp signInUrl="/login" forceRedirectUrl="/dashboard" />
    </div>
  )
}
