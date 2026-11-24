import { createHmac, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { CodeBridgeServer } from '../codeBridge'

const secret = randomBytes(32).toString('hex')
const proof = (key: string, role: string, server: string, client: string) =>
  createHmac('sha256', Buffer.from(key, 'hex')).update(`${role}:${server}:${client}`).digest('hex')
const next = async (socket: WebSocket) => JSON.parse((await once(socket, 'message'))[0].toString())

describe('loopback VS Code bridge (live WebSockets)', () => {
  let server: CodeBridgeServer, url: string
  beforeEach(async () => {
    server = new CodeBridgeServer({ secret, port: 0 })
    url = `ws://127.0.0.1:${await server.start()}`
  })
  afterEach(async () => { vi.useRealTimers(); await server.stop() })

  const challenge = async () => {
    const socket = new WebSocket(url)
    const hello = await next(socket)
    expect(hello).toEqual({ type: 'challenge', nonce: expect.stringMatching(/^[0-9a-f]{64}$/) })
    return { socket, nonce: hello.nonce as string }
  }
  const auth = (socket: WebSocket, nonce: string, key = secret) => {
    const client = randomBytes(32).toString('hex')
    socket.send(JSON.stringify({ type: 'authenticate', nonce: client, proof: proof(key, 'client', nonce, client) }))
    return client
  }
  const connect = async () => {
    const { socket, nonce } = await challenge()
    const ready = next(socket)
    const client = auth(socket, nonce)
    expect(await ready).toEqual({ type: 'ready', proof: proof(secret, 'server', nonce, client) })
    return socket
  }
  const send = async (socket: WebSocket, command = 'get_active_file') => {
    const frame = next(socket)
    const result = server.request(command, {})
    const msg = await frame
    expect(msg).toEqual({ type: 'request', command, id: expect.stringMatching(/^[0-9a-f-]{36}$/), args: {} })
    return { result, id: msg.id as string }
  }

  it('stays offline until authenticated, rejects incorrect proofs and browser origins', async () => {
    const browser = new WebSocket(url, { origin: 'null' })
    expect((await once(browser, 'error'))[0].message).toMatch(/403|401/)
    const { socket, nonce } = await challenge()
    expect(await server.request('list_files', {})).toMatchObject({ ok: false, text: expect.stringMatching(/offline/i) })
    const closed = once(socket, 'close')
    auth(socket, nonce, '00'.repeat(32))
    await closed
    expect(server.status()).toMatch(/waiting/i)
    await connect()
    expect(server.status()).toMatch(/connected/i)
  })

  it('keeps one authenticated client; correlates out-of-order replies and propagates denials', async () => {
    const socket = await connect()
    const other = await challenge()
    const closed = once(other.socket, 'close')
    auth(other.socket, other.nonce)
    await closed
    const first = await send(socket), second = await send(socket, 'run_tests')
    expect(first.id).not.toEqual(second.id)
    socket.send(JSON.stringify({ type: 'result', id: second.id, ok: false, text: 'User declined.' }))
    socket.send(JSON.stringify({ type: 'result', id: first.id, ok: true, text: 'src/index.ts' }))
    expect(await first.result).toEqual({ ok: true, text: 'src/index.ts' })
    expect(await second.result).toEqual({ ok: false, text: 'User declined.' })
  })

  it('clears in-flight requests on disconnect and stop; reconnects without replay', async () => {
    const socket = await connect()
    const pending = await send(socket)
    socket.terminate()
    expect(await pending.result).toMatchObject({ ok: false, text: expect.stringMatching(/disconnect/i) })
    const reconnected = await connect()
    const fresh = await send(reconnected, 'get_git_status')
    reconnected.send(JSON.stringify({ type: 'result', id: pending.id, ok: true, text: 'stale' }))
    const closed = once(reconnected, 'close')
    await server.stop()
    await closed
    expect(await fresh.result).toMatchObject({ ok: false, text: expect.stringMatching(/stopped/i) })
    expect(await server.request('list_files', {})).toMatchObject({ ok: false })
  })

  it('bounds outbound requests, inbound frames and the UTF-16 text returned to IPC', async () => {
    const socket = await connect()
    expect((await server.request('execute_shell', {})).ok).toBe(false)
    expect((await server.request('write_file', { content: 'ä'.repeat(66_000) })).ok).toBe(false)
    const msg = await send(socket)
    socket.send(JSON.stringify({ type: 'result', id: msg.id, ok: true, text: '📁'.repeat(10_000) }))
    const response = await msg.result
    expect(response.ok).toBe(true)
    expect(response.text.length).toBeLessThanOrEqual(16_000)
    const oversized = await send(socket)
    socket.send('x'.repeat(128 * 1024 + 1))
    expect((await oversized.result).ok).toBe(false)
  })

  it('rejects startup on an occupied port and can clean up the failed listener', async () => {
    const other = new CodeBridgeServer({ secret, port: Number(new URL(url).port) })
    try { await expect(other.start()).rejects.toMatchObject({ code: 'EADDRINUSE' }) }
    finally { await other.stop() }
    await connect() // the original listener is unaffected
  })

  it('rejects replaying a proof from a previous challenge', async () => {
    const first = await challenge()
    const ready = next(first.socket)
    const client = auth(first.socket, first.nonce)
    await ready
    const disconnected = once(first.socket, 'close')
    first.socket.close()
    await disconnected
    const fresh = await challenge()
    expect(fresh.nonce).not.toEqual(first.nonce)
    const closed = once(fresh.socket, 'close')
    fresh.socket.send(JSON.stringify({ type: 'authenticate', nonce: client, proof: proof(secret, 'client', first.nonce, client) }))
    await closed
    expect(server.status()).toMatch(/waiting/i)
  })

  it('expires an unanswered request after 120 seconds', async () => {
    const socket = await connect()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { result } = await send(socket)
    vi.advanceTimersByTime(120_000)
    expect(await result).toMatchObject({ ok: false, text: expect.stringContaining('120 seconds') })
  })

  it('disconnects clients that never authenticate', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { socket } = await challenge()
    const closed = once(socket, 'close')
    vi.advanceTimersByTime(5_000)
    await closed
    expect(server.status()).toMatch(/waiting/i)
  })
})
