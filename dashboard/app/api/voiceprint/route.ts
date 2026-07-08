import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled } from '@/lib/prisma'
import { deleteVoiceprint } from '@/lib/db'

/**
 * Account voiceprint management (dashboard, Clerk-authed). DELETE removes
 * the account's voiceprint everywhere.
 */
export const runtime = 'nodejs'

export async function DELETE() {
  if (!clerkEnabled || !dbEnabled) {
    return NextResponse.json({ error: 'Accounts not configured' }, { status: 503 })
  }
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await deleteVoiceprint(userId)
  return NextResponse.json({ ok: true })
}
