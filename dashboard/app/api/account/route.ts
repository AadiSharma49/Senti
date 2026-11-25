import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { clerkBackendEnabled } from '@/lib/auth'
import { dbEnabled, prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/ratelimit'
import {
  clearClerkSessionCookies,
  deleteUserAccount,
  isSameOriginRequest,
  signOutAllDevices,
  type AccountDb,
} from '@/lib/account'

export const runtime = 'nodejs'

const NO_STORE = { 'Cache-Control': 'no-store' }
const ACCOUNT_LIMIT = { limit: 5, windowMs: 60_000 }

function requireSignedInUser(
  req: Request
):
  | { ok: true; userId: string; sessionId: string | null }
  | { ok: false; response: NextResponse } {
  if (!clerkBackendEnabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accounts not configured' }, { status: 503, headers: NO_STORE }),
    }
  }
  if (!isSameOriginRequest(req)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE }),
    }
  }
  const { userId, sessionId } = auth()
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
  return { ok: true, userId, sessionId: sessionId ?? null }
}

/**
 * POST /api/account
 * { action: "sign_out_all" }
 *
 * Revokes both authentication planes for this account:
 *  1. Unlinks every paired Sentinel desktop device (deleting its token hash,
 *     live remote sessions, screen frames, queued commands, and file requests)
 *     and clears the shared clipboard.
 *  2. Revokes every active Clerk web session across browsers & phones (other
 *     sessions first, current session last) and expires the session cookies.
 */
export async function POST(req: Request) {
  const gate = requireSignedInUser(req)
  if (!gate.ok) return gate.response
  const { userId, sessionId } = gate

  const body = await req.json().catch(() => ({}))
  if (body?.action !== 'sign_out_all') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: NO_STORE })
  }

  try {
    const client = await Promise.resolve(clerkClient())
    const result = await signOutAllDevices({
      userId,
      currentSessionId: sessionId,
      db: dbEnabled ? (prisma as unknown as AccountDb) : null,
      clerk: client,
    })

    const res = NextResponse.json(result, { headers: NO_STORE })
    clearClerkSessionCookies(req, res)
    return res
  } catch (err) {
    console.error('[senti] account sign_out_all failed:', err)
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
 * Permanently deletes the signed-in user's database records (all paired
 * devices, remote sessions, frames, commands, file requests, shared clipboard,
 * and user row) first, then deletes the Clerk user account and expires the
 * session cookies.
 */
export async function DELETE(req: Request) {
  const gate = requireSignedInUser(req)
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
    const client = await Promise.resolve(clerkClient())
    const result = await deleteUserAccount({
      userId,
      db: dbEnabled ? (prisma as unknown as AccountDb) : null,
      clerk: client,
    })

    const res = NextResponse.json(result, { headers: NO_STORE })
    clearClerkSessionCookies(req, res)
    return res
  } catch (err) {
    console.error('[senti] account delete failed:', err)
    return NextResponse.json(
      { error: 'Could not delete your account right now. Please try again.' },
      { status: 500, headers: NO_STORE }
    )
  }
}
