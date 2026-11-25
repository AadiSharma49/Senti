/**
 * Account-level destructive/security operations shared by /api/account:
 *  - Sign out all devices (unlink all paired PCs + revoke all Clerk sessions)
 *  - Delete account (cascade-delete all DB data + delete Clerk user)
 *
 * Kept pure (dependency-injected DB & Clerk interfaces, no Next.js runtime
 * imports) so every code path, error case, and ordering invariant is directly
 * unit-tested without mocking framework internals.
 */

export interface DeleteResult {
  count: number
}

export interface AccountDb {
  remoteSession: {
    deleteMany(args: { where: { userId: string } }): Promise<DeleteResult>
  }
  device: {
    deleteMany(args: { where: { userId: string } }): Promise<DeleteResult>
  }
  sharedClipboard: {
    deleteMany(args: { where: { userId: string } }): Promise<DeleteResult>
  }
  user: {
    deleteMany(args: { where: { id: string } }): Promise<DeleteResult>
  }
  $transaction<T extends readonly Promise<unknown>[]>(
    ops: [...T]
  ): Promise<{ [K in keyof T]: Awaited<T[K]> }>
}

export interface AccountClerkClient {
  sessions: {
    getSessionList(params: {
      userId: string
      status?: 'active'
      limit?: number
      offset?: number
    }): Promise<{ data?: Array<{ id?: string | null }> | null }>
    revokeSession(sessionId: string): Promise<unknown>
  }
  users: {
    deleteUser(userId: string): Promise<unknown>
  }
}

export interface CookieSetterResponse {
  cookies: {
    set(
      name: string,
      value: string,
      options: { path: string; maxAge: number; sameSite: 'lax'; secure: boolean }
    ): void
  }
}

const SESSION_PAGE_SIZE = 100
const MAX_SESSION_PAGES = 20
const REVOKE_BATCH_SIZE = 20

const IGNORABLE_CLERK_CODES = new Set([
  'resource_not_found',
  'session_not_found',
  'session_already_revoked',
])

/**
 * Reject cross-origin browser requests to state-changing account endpoints.
 * Browsers always attach an `Origin` header on `POST`/`DELETE` requests.
 */
export function isSameOriginRequest(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true

  let originHost: string
  try {
    originHost = new URL(origin).host.toLowerCase()
  } catch {
    return false
  }

  const headerHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()

  let expectedHost = headerHost
  if (!expectedHost) {
    try {
      expectedHost = new URL(req.url).host.toLowerCase()
    } catch {
      return false
    }
  }

  return !!expectedHost && originHost === expectedHost
}

/**
 * Distinguish benign race conditions (a session just expired/revoked or user
 * already deleted in a concurrent click) from real Clerk failures (5xx, bad
 * secret key, network errors) which MUST fail the request.
 */
export function isClerkNotFoundOrAlreadyRevoked(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: unknown; errors?: unknown }
  if (e.status === 404) return true
  if (Array.isArray(e.errors) && e.errors.length > 0) {
    return e.errors.every((item) => {
      const code = item && typeof item === 'object' ? (item as { code?: unknown }).code : null
      return typeof code === 'string' && IGNORABLE_CLERK_CODES.has(code)
    })
  }
  return false
}

/**
 * Revoke every active Clerk session for `userId`.
 *
 * Ordering invariant: revoke every OTHER session first, and revoke the
 * caller's `currentSessionId` LAST. That way, if Clerk fails mid-way, the
 * caller still has a live session to see the error and retry.
 */
export async function revokeAllClerkSessions(
  clerk: AccountClerkClient,
  userId: string,
  currentSessionId?: string | null
): Promise<number> {
  const seen = new Set<string>()

  for (let page = 0; page < MAX_SESSION_PAGES; page++) {
    const res = await clerk.sessions.getSessionList({
      userId,
      status: 'active',
      limit: SESSION_PAGE_SIZE,
      offset: page * SESSION_PAGE_SIZE,
    })
    const batch = (res.data ?? []).map((s) => s.id).filter((id): id is string => typeof id === 'string' && id.length > 0)
    if (!batch.length) break

    let added = 0
    for (const id of batch) {
      if (!seen.has(id)) {
        seen.add(id)
        added++
      }
    }
    if (batch.length < SESSION_PAGE_SIZE || added === 0) break
  }

  const otherIds = Array.from(seen).filter((id) => id !== currentSessionId)
  let revokedSessions = 0

  for (let i = 0; i < otherIds.length; i += REVOKE_BATCH_SIZE) {
    const chunk = otherIds.slice(i, i + REVOKE_BATCH_SIZE)
    const results = await Promise.allSettled(chunk.map((id) => clerk.sessions.revokeSession(id)))
    for (const r of results) {
      if (r.status === 'fulfilled') {
        revokedSessions++
      } else if (!isClerkNotFoundOrAlreadyRevoked(r.reason)) {
        throw r.reason
      }
    }
  }

  if (currentSessionId) {
    try {
      await clerk.sessions.revokeSession(currentSessionId)
      revokedSessions++
    } catch (err) {
      if (!isClerkNotFoundOrAlreadyRevoked(err)) {
        throw err
      }
    }
  }

  return revokedSessions
}

/**
 * Unlink every paired desktop device (revoking all device tokens, remote
 * sessions, screen frames, queued commands, file requests, and shared
 * clipboard), then revoke every active Clerk web session.
 */
export async function signOutAllDevices(params: {
  userId: string
  currentSessionId?: string | null
  db: AccountDb | null
  clerk: AccountClerkClient
}): Promise<{ ok: true; revokedSessions: number; unlinkedDevices: number }> {
  const { userId, currentSessionId, db, clerk } = params

  let unlinkedDevices = 0
  if (db) {
    const [, devices] = await db.$transaction([
      db.remoteSession.deleteMany({ where: { userId } }),
      db.device.deleteMany({ where: { userId } }),
      db.sharedClipboard.deleteMany({ where: { userId } }),
    ])
    unlinkedDevices = devices.count
  }

  const revokedSessions = await revokeAllClerkSessions(clerk, userId, currentSessionId)
  return { ok: true, revokedSessions, unlinkedDevices }
}

/**
 * Permanently delete all server-stored data for `userId` (idempotently, so a
 * retry after a transient Clerk outage still completes cleanly), then delete
 * the Clerk user account.
 */
export async function deleteUserAccount(params: {
  userId: string
  db: AccountDb | null
  clerk: AccountClerkClient
}): Promise<{ ok: true }> {
  const { userId, db, clerk } = params

  if (db) {
    await db.$transaction([
      db.remoteSession.deleteMany({ where: { userId } }),
      db.device.deleteMany({ where: { userId } }),
      db.sharedClipboard.deleteMany({ where: { userId } }),
      db.user.deleteMany({ where: { id: userId } }),
    ])
  }

  try {
    await clerk.users.deleteUser(userId)
  } catch (err) {
    if (!isClerkNotFoundOrAlreadyRevoked(err)) {
      throw err
    }
  }

  return { ok: true }
}

const CLERK_SESSION_COOKIE_RE = /^(__session|__client_uat|__refresh)(_[A-Za-z0-9_-]+)?$/

export function extractClerkCookieNamesToClear(cookieHeader: string | null): string[] {
  const names = new Set<string>(['__session', '__client_uat', '__refresh'])
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const name = part.split('=')[0]?.trim()
      if (name && CLERK_SESSION_COOKIE_RE.test(name)) {
        names.add(name)
      }
    }
  }
  return Array.from(names)
}

/**
 * Clear Clerk's stateless session JWT cookies on the HTTP response so the very
 * next navigation (/login, /, /dashboard) immediately sees `userId === null`
 * instead of bouncing back into /dashboard via a still-unexpired 60s JWT.
 */
export function clearClerkSessionCookies(req: Request, res: CookieSetterResponse): void {
  const proto = (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase()
  const secure = proto === 'https' || req.url.startsWith('https://')
  for (const name of extractClerkCookieNamesToClear(req.headers.get('cookie'))) {
    res.cookies.set(name, '', { path: '/', maxAge: 0, sameSite: 'lax', secure })
  }
}
