import Link from 'next/link'
import { SignIn } from '@clerk/nextjs'
import AuthCard from '@/components/AuthCard'
import SentiMark from '@/components/SentiMark'
import { clerkEnabled } from '@/lib/auth'

export default function LoginPage() {
  if (!clerkEnabled) return <AuthCard mode="login" />
  return (
    <div className="bg-ambient flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <Link href="/" className="flex items-center gap-3">
        <SentiMark size={40} />
        <span className="text-xl font-semibold tracking-wide">Senti</span>
      </Link>
      <SignIn signUpUrl="/signup" forceRedirectUrl="/dashboard" />
    </div>
  )
}
