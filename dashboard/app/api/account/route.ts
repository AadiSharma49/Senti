import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { clerkEnabled } from '@/lib/auth'
import { dbEnabled, prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const ACCOUNT_LIMIT = { limit: 5, windowMs: 60_000 }

function requireSignedInUser():
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse } {
  if (!clerkEnabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accounts not configured' }, { status: 503, headers: NO_STORE }),
    }
  }
  const { userId } = auth()
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }),
    }
  }
  const rl = rateLimit(`account:${userId}`, ACCOUNT_LIMIT)
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(rl.retryAfter) } }
      ),
    }
  }
  return { ok: true, userId }
}

/**
 * POST /api/account
 * { action: "sign_out_all" }
 *
 * Revokes both authentication planes for this account:
 *  1. Unlinks every paired Sentinel desktop device (deleting its token hash,
 *     live remote sessions, screen frames, queued commands, and file requests)
 *     and clears the shared clipboard.
 *  2. Revokes every active/pending Clerk web session across browsers & phones.
 */
export async function POST(req: Request) {
  const gate = requireSignedInUser()
  if (!gate.ok) return gate.response
  const { userId } = gate

  const body = await req.json().catch(() => ({}))
  if (body?.action !== 'sign_out_all') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })
  }

  try {
    let unlinkedDevices = 0
    if (dbEnabled) {
      const [devices] = await prisma.$transaction([
        prisma.device.deleteMany({ where: { userId } }),
        prisma.sharedClipboard.deleteMany({ where: { userId } }),
      ])
      unlinkedDevices = devices.count
    }

    const client = await Promise.resolve(clerkClient())
    let revokedSessions = 0
    for (let page = 0; page < 5; page++) {
      const active = await client.sessions.getSessionList({ userId, status: 'active', limit: 100 })
      const ids = (active.data ?? []).map((s) => s.id).filter(Boolean)
      if (!ids.length) break
      const results = await Promise.allSettled(ids.map((id) => client.sessions.revokeSession(id)))
      revokedSessions += results.filter((r) => r.status === 'fulfilled').length
      if (ids.length < 100) break
    }

    return NextResponse.json({ ok: true, revokedSessions, unlinkedDevices }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: 'Could not revoke all sessions right now. Please try again.' },
      { status: 500, headers: NO_STORE }
    )
  }
}

/**
 * DELETE /api/account
 * { confirm: "DELETE" }
 *
 * Permanently deletes the signed-in user's database records (cascading to all
 * paired devices, remote sessions, frames, commands, file requests, and shared
 * clipboard) first, then deletes the Clerk user account.
 */
export async function DELETE(req: Request) {
  const gate = requireSignedInUser()
  if (!gate.ok) return gate.response
  const { userId } = gate

  const body = await req.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json(
      { error: 'Type DELETE to confirm permanent account deletion.' },
      { status: 400, headers: NO_STORE }
    )
  }

  try {
    if (dbEnabled) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    const client = await Promise.resolve(clerkClient())
    await client.users.deleteUser(userId)

    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch {
    return NextResponse.json(
      { error: 'Could not delete your account right now. Please try again.' },
      { status: 500, headers: NO_STORE }
    )
  }
}
