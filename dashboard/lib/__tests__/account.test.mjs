import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearClerkSessionCookies,
  deleteUserAccount,
  extractClerkCookieNamesToClear,
  isClerkNotFoundOrAlreadyRevoked,
  isSameOriginRequest,
  revokeAllClerkSessions,
  signOutAllDevices,
} from '../account.ts'

function createInMemoryDb(seed) {
  const state = {
    users: [...(seed.users ?? [])],
    devices: [...(seed.devices ?? [])],
    remoteSessions: [...(seed.remoteSessions ?? [])],
    clipboards: [...(seed.clipboards ?? [])],
  }
  const log = []

  const db = {
    remoteSession: {
      deleteMany: async ({ where }) => {
        log.push(`remoteSession.deleteMany:${where.userId}`)
        const before = state.remoteSessions.length
        state.remoteSessions = state.remoteSessions.filter((r) => r.userId !== where.userId)
        return { count: before - state.remoteSessions.length }
      },
    },
    device: {
      deleteMany: async ({ where }) => {
        log.push(`device.deleteMany:${where.userId}`)
        const before = state.devices.length
        state.devices = state.devices.filter((d) => d.userId !== where.userId)
        return { count: before - state.devices.length }
      },
    },
    sharedClipboard: {
      deleteMany: async ({ where }) => {
        log.push(`sharedClipboard.deleteMany:${where.userId}`)
        const before = state.clipboards.length
        state.clipboards = state.clipboards.filter((c) => c.userId !== where.userId)
        return { count: before - state.clipboards.length }
      },
    },
    user: {
      deleteMany: async ({ where }) => {
        log.push(`user.deleteMany:${where.id}`)
        const before = state.users.length
        state.users = state.users.filter((u) => u.id !== where.id)
        return { count: before - state.users.length }
      },
    },
    $transaction: async (ops) => {
      log.push('transaction:begin')
      const res = await Promise.all(ops)
      log.push('transaction:end')
      return res
    },
  }

  return { db, state, log }
}

describe('isSameOriginRequest', () => {
  it('allows requests with no Origin header', () => {
    const req = new Request('https://sentinel.example/api/account', { method: 'POST' })
    assert.equal(isSameOriginRequest(req), true)
  })

  it('allows matching Origin and Host', () => {
    const req = new Request('https://sentinel.example/api/account', {
      method: 'POST',
      headers: {
        origin: 'https://sentinel.example',
        host: 'sentinel.example',
      },
    })
    assert.equal(isSameOriginRequest(req), true)
  })

  it('allows matching Origin and X-Forwarded-Host (first entry, case-insensitive)', () => {
    const req = new Request('http://127.0.0.1:3000/api/account', {
      method: 'DELETE',
      headers: {
        origin: 'https://APP.Sentinel.Example',
        'x-forwarded-host': 'app.sentinel.example, proxy.internal',
      },
    })
    assert.equal(isSameOriginRequest(req), true)
  })

  it('rejects cross-origin requests', () => {
    const req = new Request('https://sentinel.example/api/account', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        host: 'sentinel.example',
      },
    })
    assert.equal(isSameOriginRequest(req), false)
  })

  it('rejects malformed Origin headers', () => {
    const req = new Request('https://sentinel.example/api/account', {
      method: 'POST',
      headers: {
        origin: 'not a url',
        host: 'sentinel.example',
      },
    })
    assert.equal(isSameOriginRequest(req), false)
  })
})

describe('isClerkNotFoundOrAlreadyRevoked', () => {
  it('recognizes 404 and ignorable Clerk error codes', () => {
    assert.equal(isClerkNotFoundOrAlreadyRevoked({ status: 404 }), true)
    assert.equal(
      isClerkNotFoundOrAlreadyRevoked({ status: 400, errors: [{ code: 'session_already_revoked' }] }),
      true
    )
    assert.equal(
      isClerkNotFoundOrAlreadyRevoked({ status: 400, errors: [{ code: 'resource_not_found' }] }),
      true
    )
  })

  it('does NOT ignore real Clerk/network errors', () => {
    assert.equal(isClerkNotFoundOrAlreadyRevoked(new Error('ECONNRESET')), false)
    assert.equal(isClerkNotFoundOrAlreadyRevoked({ status: 500 }), false)
    assert.equal(isClerkNotFoundOrAlreadyRevoked({ status: 401, errors: [{ code: 'authentication_invalid' }] }), false)
    assert.equal(
      isClerkNotFoundOrAlreadyRevoked({
        status: 400,
        errors: [{ code: 'session_already_revoked' }, { code: 'internal_error' }],
      }),
      false
    )
  })
})

describe('signOutAllDevices', () => {
  it('unlinks only caller devices/sessions/clipboard and revokes other sessions before current session', async () => {
    const { db, state } = createInMemoryDb({
      users: [{ id: 'user_1' }, { id: 'user_2' }],
      devices: [
        { id: 'dev_1', userId: 'user_1', tokenHash: 'h1' },
        { id: 'dev_2', userId: 'user_1', tokenHash: 'h2' },
        { id: 'dev_other', userId: 'user_2', tokenHash: 'h3' },
      ],
      remoteSessions: [
        { id: 'rs_1', userId: 'user_1' },
        { id: 'rs_other', userId: 'user_2' },
      ],
      clipboards: [
        { userId: 'user_1', text: 'secret' },
        { userId: 'user_2', text: 'keep' },
      ],
    })

    const revokedOrder = []
    const clerk = {
      sessions: {
        getSessionList: async ({ offset = 0 }) => ({
          data: offset === 0 ? [{ id: 'sess_cur' }, { id: 'sess_phone' }, { id: 'sess_laptop' }] : [],
        }),
        revokeSession: async (id) => {
          revokedOrder.push(id)
        },
      },
      users: { deleteUser: async () => {} },
    }

    const result = await signOutAllDevices({
      userId: 'user_1',
      currentSessionId: 'sess_cur',
      db,
      clerk,
    })

    assert.deepEqual(result, { ok: true, revokedSessions: 3, unlinkedDevices: 2 })
    // User 1's devices, remote sessions, and clipboard are gone; User 1 row stays.
    assert.deepEqual(state.devices.map((d) => d.id), ['dev_other'])
    assert.deepEqual(state.remoteSessions.map((r) => r.id), ['rs_other'])
    assert.deepEqual(state.clipboards.map((c) => c.userId), ['user_2'])
    assert.deepEqual(state.users.map((u) => u.id), ['user_1', 'user_2'])
    // Current session MUST be revoked last.
    assert.equal(revokedOrder[revokedOrder.length - 1], 'sess_cur')
    assert.deepEqual(new Set(revokedOrder), new Set(['sess_phone', 'sess_laptop', 'sess_cur']))
  })

  it('paginates past 100 active sessions and revokes every one', async () => {
    const allIds = Array.from({ length: 125 }, (_, i) => `sess_${i}`)
    const revoked = []
    const clerk = {
      sessions: {
        getSessionList: async ({ limit = 100, offset = 0 }) => ({
          data: allIds.slice(offset, offset + limit).map((id) => ({ id })),
        }),
        revokeSession: async (id) => {
          revoked.push(id)
        },
      },
      users: { deleteUser: async () => {} },
    }

    const count = await revokeAllClerkSessions(clerk, 'user_1', 'sess_0')
    assert.equal(count, 125)
    assert.equal(revoked.length, 125)
    assert.equal(revoked[revoked.length - 1], 'sess_0')
  })

  it('throws on Clerk revocation error instead of falsely succeeding, leaving current session intact to retry', async () => {
    const revoked = []
    const clerk = {
      sessions: {
        getSessionList: async () => ({
          data: [{ id: 'sess_cur' }, { id: 'sess_other' }],
        }),
        revokeSession: async (id) => {
          revoked.push(id)
          if (id === 'sess_other') {
            throw Object.assign(new Error('Clerk unavailable'), { status: 503 })
          }
        },
      },
      users: { deleteUser: async () => {} },
    }

    await assert.rejects(
      () =>
        signOutAllDevices({
          userId: 'user_1',
          currentSessionId: 'sess_cur',
          db: null,
          clerk,
        }),
      /Clerk unavailable/
    )
    assert.deepEqual(revoked, ['sess_other'])
  })

  it('tolerates already-revoked 404 races without failing', async () => {
    const clerk = {
      sessions: {
        getSessionList: async () => ({
          data: [{ id: 'sess_race' }, { id: 'sess_cur' }],
        }),
        revokeSession: async (id) => {
          if (id === 'sess_race') {
            throw { status: 400, errors: [{ code: 'session_already_revoked' }] }
          }
        },
      },
      users: { deleteUser: async () => {} },
    }

    const result = await signOutAllDevices({
      userId: 'user_1',
      currentSessionId: 'sess_cur',
      db: null,
      clerk,
    })
    assert.deepEqual(result, { ok: true, revokedSessions: 1, unlinkedDevices: 0 })
  })
})

describe('deleteUserAccount', () => {
  it('deletes all user DB rows first, then deletes Clerk user, without touching other users', async () => {
    const { db, state, log } = createInMemoryDb({
      users: [{ id: 'user_1' }, { id: 'user_2' }],
      devices: [
        { id: 'dev_1', userId: 'user_1' },
        { id: 'dev_2', userId: 'user_2' },
      ],
      remoteSessions: [
        { id: 'rs_1', userId: 'user_1' },
        { id: 'rs_2', userId: 'user_2' },
      ],
      clipboards: [
        { userId: 'user_1', text: 'wipe' },
        { userId: 'user_2', text: 'keep' },
      ],
    })

    const clerk = {
      sessions: { getSessionList: async () => ({ data: [] }), revokeSession: async () => {} },
      users: {
        deleteUser: async (id) => {
          log.push(`clerk.deleteUser:${id}`)
        },
      },
    }

    const result = await deleteUserAccount({ userId: 'user_1', db, clerk })
    assert.deepEqual(result, { ok: true })
    assert.deepEqual(state.users.map((u) => u.id), ['user_2'])
    assert.deepEqual(state.devices.map((d) => d.id), ['dev_2'])
    assert.deepEqual(state.remoteSessions.map((r) => r.id), ['rs_2'])
    assert.deepEqual(state.clipboards.map((c) => c.userId), ['user_2'])
    // DB transaction must complete before Clerk user deletion.
    assert.ok(log.indexOf('transaction:end') < log.indexOf('clerk.deleteUser:user_1'))
  })

  it('propagates Clerk deleteUser failures and supports idempotent retry', async () => {
    const { db, state } = createInMemoryDb({
      users: [{ id: 'user_1' }],
      devices: [{ id: 'dev_1', userId: 'user_1' }],
      remoteSessions: [],
      clipboards: [],
    })

    let attempts = 0
    const clerk = {
      sessions: { getSessionList: async () => ({ data: [] }), revokeSession: async () => {} },
      users: {
        deleteUser: async () => {
          attempts++
          if (attempts === 1) throw Object.assign(new Error('Clerk 500'), { status: 500 })
        },
      },
    }

    await assert.rejects(() => deleteUserAccount({ userId: 'user_1', db, clerk }), /Clerk 500/)
    assert.equal(state.users.length, 0)
    assert.equal(state.devices.length, 0)

    // Retry completes cleanly even though DB rows are already deleted.
    const res = await deleteUserAccount({ userId: 'user_1', db, clerk })
    assert.deepEqual(res, { ok: true })
    assert.equal(attempts, 2)
  })

  it('treats Clerk 404 (already deleted) as idempotent success', async () => {
    const clerk = {
      sessions: { getSessionList: async () => ({ data: [] }), revokeSession: async () => {} },
      users: {
        deleteUser: async () => {
          throw { status: 404 }
        },
      },
    }
    const res = await deleteUserAccount({ userId: 'user_1', db: null, clerk })
    assert.deepEqual(res, { ok: true })
  })
})

describe('clearClerkSessionCookies', () => {
  it('clears standard and suffixed Clerk session cookies while preserving unrelated cookies', () => {
    const names = extractClerkCookieNamesToClear(
      '__session=jwt; __session_abc123=jwt2; __client_uat_abc123=123; __clerk_db_jwt=keep; theme=dark'
    )
    assert.deepEqual(
      new Set(names),
      new Set(['__session', '__client_uat', '__refresh', '__session_abc123', '__client_uat_abc123'])
    )
    assert.ok(!names.includes('__clerk_db_jwt'))
    assert.ok(!names.includes('theme'))
  })

  it('sets Max-Age=0 and Secure flag matching request protocol', () => {
    const written = []
    const fakeRes = {
      cookies: {
        set: (name, value, options) => written.push({ name, value, options }),
      },
    }

    const httpsReq = new Request('https://sentinel.example/api/account', {
      method: 'POST',
      headers: { cookie: '__session=tok; __session_xyz=tok2' },
    })
    clearClerkSessionCookies(httpsReq, fakeRes)
    assert.ok(written.length >= 4)
    for (const c of written) {
      assert.equal(c.value, '')
      assert.equal(c.options.maxAge, 0)
      assert.equal(c.options.path, '/')
      assert.equal(c.options.sameSite, 'lax')
      assert.equal(c.options.secure, true)
    }

    const httpWritten = []
    const httpReq = new Request('http://127.0.0.1:3000/api/account', { method: 'POST' })
    clearClerkSessionCookies(httpReq, {
      cookies: { set: (name, value, options) => httpWritten.push({ name, value, options }) },
    })
    assert.equal(httpWritten[0].options.secure, false)
  })
})
