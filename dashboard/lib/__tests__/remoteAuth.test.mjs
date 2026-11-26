import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { hashRemoteCredential, startRemoteSession, verifyRemoteCredential, verifyRemoteSession } from '../remoteAuth.ts'

const PIN = 'local-pin'
const WRONG = 'wrong-pin'
const targetId = 'target'
const viewer = { id: 'viewer', userId: 'owner' }
const secondViewer = { ...viewer, id: 'second-viewer' }
const pinHash = await hashRemoteCredential(PIN)

// Prisma-shaped fixture. Simulate Postgres's device-row lock, keeping the
// initial session lookup outside it so concurrent requests can all see pending.
function fixture() {
  const makeTarget = (id) => ({
    id, userId: viewer.userId, name: id, remotePinHash: pinHash,
    remoteAuthFailures: 0, remoteAuthExpiresAt: null,
  })
  const target = makeTarget(targetId)
  const devices = [target, makeTarget('other-target')]
  const sessions = []
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => value?.in ? value.in.includes(row[key]) : row[key] === value)
  }
  const db = {
    remoteSession: {
      findFirst: async ({ where }) => {
        const row = sessions.find((row) => matches(row, where))
        return row ? { ...row } : null
      },
      create: async ({ data }) => {
        const row = { id: `session-${sessions.length}`, state: 'pending', ...data }
        sessions.push(row)
        return { ...row }
      },
      updateMany: async ({ where, data }) => {
        const rows = sessions.filter((row) => matches(row, where))
        for (const row of rows) Object.assign(row, data)
        return { count: rows.length }
      },
    },
    device: {
      update: async ({ where, data }) => Object.assign(devices.find((row) => matches(row, where)), data),
    },
  }
  let tail = Promise.resolve()
  db.$transaction = async (run) => {
    let unlock
    try {
      return await run({
        ...db,
        $queryRaw: async (sql, id, userId) => {
          assert.match(sql.join(''), /FROM "Device"[\s\S]+FOR UPDATE/)
          const before = tail
          tail = new Promise((resolve) => { unlock = resolve })
          await before
          return devices.filter((row) => matches(row, { id, userId })).map((row) => ({ ...row }))
        },
      })
    } finally {
      unlock?.()
    }
  }
  return { db, target, sessions }
}

test('new credentials use random salts; correct secrets match and old or malformed digests do not', async () => {
  const otherHash = await hashRemoteCredential(PIN)
  assert.notEqual(otherHash.split(':')[1], pinHash.split(':')[1])
  assert.equal(await verifyRemoteCredential(PIN, pinHash), true)
  assert.equal(await verifyRemoteCredential(WRONG, pinHash), false)
  const legacyHash = createHash('sha256').update(PIN).digest('hex')
  assert.equal(await verifyRemoteCredential(PIN, legacyHash), false)
  assert.equal(await verifyRemoteCredential(PIN, `${pinHash}:bad`), false)
})

test('four failures carry through a fresh session and a different viewer; fifth locks only the target', async () => {
  const { db, target, sessions } = fixture()
  const first = await startRemoteSession(db, viewer, targetId, null)
  assert.equal(first.kind, 'started')
  for (let attemptsLeft = 4; attemptsLeft >= 1; attemptsLeft--) {
    assert.deepEqual(await verifyRemoteSession(db, viewer, first.id, WRONG), { kind: 'bad-pin', attemptsLeft })
  }
  const second = await startRemoteSession(db, secondViewer, targetId, null)
  assert.equal(second.kind, 'started')
  assert.equal((await verifyRemoteSession(db, viewer, first.id, PIN)).kind, 'not-found')
  const fifth = await verifyRemoteSession(db, secondViewer, second.id, WRONG)
  assert.deepEqual(fifth, { kind: 'locked-out', retryAfterMs: 600_000 })
  assert.equal(sessions[1].state, 'ended')
  assert.equal(target.remoteAuthFailures, 5)
  const expiresAt = target.remoteAuthExpiresAt
  const locked = await startRemoteSession(db, viewer, targetId, null)
  assert.equal(locked.kind, 'locked-out')
  assert.ok(locked.retryAfterMs > 0 && locked.retryAfterMs <= 600_000)
  assert.equal(target.remoteAuthExpiresAt, expiresAt)
  assert.equal((await startRemoteSession(db, viewer, 'other-target', null)).kind, 'started')

  target.remoteAuthExpiresAt = new Date(0) // Cooldown expired.
  const third = await startRemoteSession(db, viewer, targetId, null)
  assert.equal(third.kind, 'started')
  assert.deepEqual(await verifyRemoteSession(db, viewer, third.id, WRONG), { kind: 'bad-pin', attemptsLeft: 4 })
  assert.deepEqual(await verifyRemoteSession(db, viewer, third.id, PIN), { kind: 'verified' })
  assert.equal(target.remoteAuthFailures, 0)
  assert.equal(target.remoteAuthExpiresAt, null)
})

test('parallel verification cannot lose failure increments or accept a correct PIN after lockout', async () => {
  const { db, target, sessions } = fixture()
  const session = await startRemoteSession(db, viewer, targetId, null)
  const results = await Promise.all([WRONG, WRONG, WRONG, WRONG, WRONG, PIN].map(
    (secret) => verifyRemoteSession(db, viewer, session.id, secret)
  ))
  assert.deepEqual(results.slice(0, 4).map((r) => r.attemptsLeft), [4, 3, 2, 1])
  assert.equal(results[4].kind, 'locked-out')
  assert.equal(results[5].kind, 'locked-out')
  assert.equal(target.remoteAuthFailures, 5)
  assert.equal(sessions[0].state, 'ended')
})

test('simultaneous starts leave one pending session; stale or unowned sessions cannot be verified', async () => {
  const { db, target, sessions } = fixture()
  const [first, second] = await Promise.all([
    startRemoteSession(db, viewer, targetId, null),
    startRemoteSession(db, secondViewer, targetId, null),
  ])
  assert.deepEqual(sessions.map((s) => s.state), ['ended', 'pending'])
  assert.equal((await verifyRemoteSession(db, viewer, first.id, PIN)).kind, 'not-found')
  assert.equal((await verifyRemoteSession(db, viewer, second.id, PIN)).kind, 'not-found')
  assert.equal((await startRemoteSession(db, { ...viewer, userId: 'stranger' }, targetId, null)).kind, 'not-found')
  assert.equal(target.remoteAuthFailures, 0)
})

test('email codes use the same budget as PINs and can only be used once while fresh', async () => {
  const { db, target, sessions } = fixture()
  const first = await startRemoteSession(db, viewer, targetId, null)
  await verifyRemoteSession(db, viewer, first.id, WRONG)
  const emailed = await startRemoteSession(db, viewer, targetId, 'owner@example.com')
  assert.match(emailed.code, /^\d{6}$/)
  assert.match(sessions[1].emailCodeHash, /^scrypt-v1:/)
  assert.deepEqual(await verifyRemoteSession(db, viewer, emailed.id, PIN), { kind: 'bad-pin', attemptsLeft: 3 })
  assert.deepEqual(await verifyRemoteSession(db, viewer, emailed.id, emailed.code), { kind: 'verified' })
  assert.equal(sessions[1].emailCodeHash, null)
  assert.equal((await verifyRemoteSession(db, viewer, emailed.id, emailed.code)).kind, 'not-found')
  assert.equal(target.remoteAuthFailures, 0)

  const expired = await startRemoteSession(db, viewer, targetId, 'owner@example.com')
  sessions[2].emailCodeSentAt = new Date(0)
  assert.equal((await verifyRemoteSession(db, viewer, expired.id, expired.code)).kind, 'bad-pin')
  assert.equal((await verifyRemoteSession(db, viewer, expired.id, PIN)).kind, 'bad-pin')
})
