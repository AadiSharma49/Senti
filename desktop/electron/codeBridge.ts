import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'

const COMMANDS = new Set([
  'read_file', 'write_file', 'list_files', 'run_tests', 'get_active_file',
  'get_diagnostics', 'open_file', 'get_git_status',
])
const MAX_FRAME = 128 * 1024
const MAX_TEXT = 16_000
const AUTH_MS = 5_000
const REQUEST_MS = 120_000
const HEX = /^[0-9a-f]{64}$/
const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s)
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)

export type CodeBridgeResult = { ok: boolean; text: string }
const fail = (text: string): CodeBridgeResult => ({ ok: false, text })

/** One pairing/listener lifetime. No Electron dependency; port 0 is useful for integration tests. */
export class CodeBridgeServer {
  private readonly key: Buffer
  private readonly port: number
  private http?: Server
  private ws?: WebSocketServer
  private ready?: Promise<number>
  private stopping?: Promise<void>
  private client?: WebSocket
  private readonly pending = new Map<string, (result: CodeBridgeResult) => void>()

  constructor({ secret, port = 9876 }: { secret: string; port?: number }) {
    if (!isHex(secret)) throw new Error('Invalid VS Code pairing key.')
    this.key = Buffer.from(secret, 'hex')
    this.port = port
  }

  start(): Promise<number> {
    if (this.stopping) return Promise.reject(new Error('The VS Code bridge has stopped.'))
    if (this.ready) return this.ready
    const http = this.http = createServer({ headersTimeout: AUTH_MS, requestTimeout: AUTH_MS }, (_req, res) => {
      res.writeHead(404, { Connection: 'close' }).end()
    })
    http.maxConnections = 16
    const ws = this.ws = new WebSocketServer({
      server: http, maxPayload: MAX_FRAME, perMessageDeflate: false,
      verifyClient: ({ req }: { req: IncomingMessage }) => !this.stopping && req.socket.remoteAddress === '127.0.0.1' &&
        req.headers.origin === undefined && req.headers['sec-websocket-origin'] === undefined,
    })
    ws.on('connection', socket => this.accept(socket))
    this.ready = new Promise<number>((resolve, reject) => {
      // ws forwards errors from its HTTP server (including EADDRINUSE).
      ws.on('error', reject)
      http.listen(this.port, '127.0.0.1', () => {
        const address = http.address()
        if (!address || typeof address === 'string') reject(new Error('Could not start the VS Code bridge.'))
        else resolve(address.port)
      })
    })
    return this.ready
  }

  status(): string {
    if (this.client?.readyState === WebSocket.OPEN) return 'VS Code is connected.'
    if (!this.stopping && this.http?.listening) return 'Paired. Waiting for the VS Code extension to connect.'
    return 'The VS Code bridge is offline.'
  }

  private accept(socket: WebSocket): void {
    const nonce = randomBytes(32).toString('hex')
    const deadline = setTimeout(() => socket.terminate(), AUTH_MS)
    socket.on('error', () => socket.terminate())
    socket.once('close', () => {
      clearTimeout(deadline)
      if (this.client === socket) this.detach('VS Code disconnected before replying. Check VS Code before retrying.')
    })
    const send = (message: object) => socket.send(JSON.stringify(message), err => { if (err) socket.terminate() })
    socket.on('message', (data, binary) => {
      if (this.stopping || binary || socket.readyState !== WebSocket.OPEN) return socket.terminate()
      let msg: unknown
      try { msg = JSON.parse(data.toString()) } catch { return socket.terminate() }
      if (!isRecord(msg)) return socket.terminate()
      if (this.client !== socket) {
        if (this.client || msg.type !== 'authenticate' || !isHex(msg.nonce) || msg.nonce === nonce || !isHex(msg.proof)) {
          return socket.terminate()
        }
        const proof = (role: 'client' | 'server') => createHmac('sha256', this.key).update(`${role}:${nonce}:${msg.nonce}`, 'utf8').digest()
        if (!timingSafeEqual(proof('client'), Buffer.from(msg.proof, 'hex'))) return socket.terminate()
        clearTimeout(deadline)
        this.client = socket
        send({ type: 'ready', proof: proof('server').toString('hex') })
        return
      }
      if (msg.type !== 'result' || typeof msg.id !== 'string' || typeof msg.ok !== 'boolean' || typeof msg.text !== 'string') {
        return socket.terminate()
      }
      // Unknown IDs include late/duplicate results; never resolve a different request.
      const suffix = '\n[VS Code response truncated]'
      const text = msg.text.length > MAX_TEXT ? msg.text.slice(0, MAX_TEXT - suffix.length) + suffix : msg.text
      this.pending.get(msg.id)?.({ ok: msg.ok, text: text || (msg.ok ? 'Completed in VS Code.' : 'VS Code declined the request.') })
    })
    send({ type: 'challenge', nonce })
  }

  async request(command: string, args: Record<string, unknown>): Promise<CodeBridgeResult> {
    if (!COMMANDS.has(command)) return fail('That command is not supported by the VS Code bridge.')
    if (!isRecord(args)) return fail('VS Code command arguments must be an object.')
    const client = this.client
    if (!client || client.readyState !== WebSocket.OPEN) return fail('VS Code is offline. Open the paired extension and try again.')
    if (this.pending.size >= 16) return fail('VS Code is busy. Wait for a pending request to finish.')
    const id = randomUUID()
    let frame: string
    try {
      // Check while serializing too: a large (or heavily shared) IPC object
      // must not expand into an unbounded intermediate string in Electron main.
      let units = 0
      frame = JSON.stringify({ type: 'request', id, command, args }, function (key, value) {
        units += 1 + (Array.isArray(this) ? 0 : key.length) + (typeof value === 'string' ? value.length : 0)
        if (units > MAX_FRAME) throw new RangeError()
        return value
      })
    } catch (err) {
      return err instanceof RangeError ? fail('This VS Code request is too large or deeply nested.') : fail('VS Code command arguments must be JSON data.')
    }
    if (Buffer.byteLength(frame) > MAX_FRAME) return fail('This request exceeds the VS Code bridge limit of 128 KiB.')
    return new Promise(resolve => {
      const finish = (result: CodeBridgeResult) => {
        clearTimeout(timer)
        this.pending.delete(id)
        resolve(result)
      }
      const timer = setTimeout(() => finish(fail('VS Code did not reply within 120 seconds. Check VS Code before retrying.')), REQUEST_MS)
      this.pending.set(id, finish)
      try { client.send(frame, err => { if (err) finish(fail('Could not deliver the request to VS Code.')) }) }
      catch { finish(fail('Could not deliver the request to VS Code.')) }
    })
  }

  private detach(reason: string): void {
    this.client = undefined
    for (const finish of this.pending.values()) finish(fail(reason))
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping
    this.detach('The VS Code bridge stopped before a reply arrived. Check VS Code before retrying.')
    this.key.fill(0)
    this.stopping = (async () => {
      // listen() may still be in flight. Close upgraded and ordinary HTTP connections.
      try { await this.ready } catch { /* bind failed */ }
      this.ws?.close()
      for (const socket of this.ws?.clients ?? []) socket.terminate()
      const http = this.http
      if (http?.listening) await new Promise<void>(resolve => {
        http.close(() => resolve())
        http.closeAllConnections()
      })
    })()
    return this.stopping
  }
}
