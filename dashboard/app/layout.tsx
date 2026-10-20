import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { clerkEnabled } from '@/lib/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sentinel — the AI that lives on your PC',
  description:
    'Sentinel is an OS-level AI co-pilot. Talk to it and it acts — opens apps, watches your system, remembers you, and only ever has the access you give it.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en">
      <body className="min-h-screen bg-bg font-sans antialiased">{children}</body>
    </html>
  )
  // Only mount ClerkProvider when keys are configured, so the app runs
  // without Clerk during early development.
  return clerkEnabled ? <ClerkProvider>{body}</ClerkProvider> : body
}
