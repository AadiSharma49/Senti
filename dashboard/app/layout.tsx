import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { clerkEnabled } from '@/lib/auth'
import './globals.css'

export const metadata: Metadata = {
  title: 'Senti — Your voice is the key',
  description:
    'Senti is an AI-powered desktop security platform. Unlock your computer with your voice — fully on-device, private, and secure.',
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
