import { normalizeServerOrigin } from './apiGuard'

/**
 * Session-level Content-Security-Policy for all Sentinel BrowserWindows.
 *
 * Enforced via `session.webRequest.onHeadersReceived` (not a `<meta>` tag in
 * `index.html` that DOM injection could strip or bypass, and which cannot
 * enforce `frame-ancestors` or track runtime server changes):
 *
 *  - `script-src 'self' 'wasm-unsafe-eval'`: only bundled app modules from
 *    `'self'` may execute. Inline `<script>` tags, inline event handlers,
 *    `javascript:` URLs, `blob:`/`data:` scripts, JS `eval()`, and
 *    `new Function()` are all blocked. (`'wasm-unsafe-eval'` permits compiling
 *    bundled WebAssembly bytecode for offline Whisper STT without enabling JS
 *    `eval`.)
 *  - `connect-src 'self' <configuredApiOrigin>`: renderer `fetch`, XHR,
 *    `WebSocket`, and `EventSource` are restricted to the app's own local
 *    bundle origin (`/models/...`, `.wasm`) and the single configured Sentinel
 *    API origin (plus the loopback Vite HMR socket in development only).
 */

export interface CspOptions {
  /** Configured Sentinel backend origin (validated via `normalizeServerOrigin`). */
  apiOrigin: unknown
  /** Optional Vite dev server URL(s) when running in development mode. */
  devServerUrls?: unknown | readonly unknown[]
}

export interface CspHeadersReceivedDetails {
  url: string
  responseHeaders?: Record<string, string[] | string>
}

export interface CspHeadersReceivedResponse {
  cancel?: boolean
  responseHeaders?: Record<string, string[] | string>
}

export interface CspWebRequestSession {
  webRequest: {
    onHeadersReceived(
      listener: (
        details: CspHeadersReceivedDetails,
        callback: (response: CspHeadersReceivedResponse) => void
      ) => void
    ): void
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
const EXEMPT_INTERNAL_SCHEMES = new Set(['devtools:', 'chrome:', 'chrome-extension:'])

function normalizeDevLoopbackOrigins(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return []
    if (!LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) return []
    const httpOrigin = parsed.origin
    const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsOrigin = `${wsProtocol}//${parsed.host}`
    return [httpOrigin, wsOrigin]
  } catch {
    return []
  }
}

/**
 * Build the authoritative Content-Security-Policy header string.
 * Any malformed or unnormalized `apiOrigin` is dropped rather than interpolated.
 */
export function buildContentSecurityPolicy(options: CspOptions): string {
  const connectSources = new Set<string>(["'self'"])

  const pinnedApiOrigin = normalizeServerOrigin(options.apiOrigin)
  if (pinnedApiOrigin) {
    connectSources.add(pinnedApiOrigin)
  }

  const devInputs = Array.isArray(options.devServerUrls)
    ? options.devServerUrls
    : options.devServerUrls !== undefined
      ? [options.devServerUrls]
      : []

  for (const candidate of devInputs) {
    for (const devOrigin of normalizeDevLoopbackOrigins(candidate)) {
      connectSources.add(devOrigin)
    }
  }

  return [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self' data: blob:",
    `connect-src ${Array.from(connectSources).join(' ')}`,
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

/**
 * Apply CSP to every window/frame/worker URL except Chromium's own internal
 * DevTools UI (`devtools://`, `chrome://`, `chrome-extension://`).
 */
export function shouldApplyCspToUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return true
  try {
    const { protocol } = new URL(rawUrl)
    return !EXEMPT_INTERNAL_SCHEMES.has(protocol.toLowerCase())
  } catch {
    return true
  }
}

/**
 * Return a fresh header map with any existing `Content-Security-Policy`
 * header (regardless of casing) replaced by the single enforced policy.
 */
export function applyCspResponseHeaders(
  responseHeaders: Record<string, string[] | string> | undefined,
  policy: string
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  if (responseHeaders) {
    for (const [key, value] of Object.entries(responseHeaders)) {
      const lower = key.toLowerCase()
      if (lower === 'content-security-policy' || lower === 'content-security-policy-report-only') {
        continue
      }
      next[key] = Array.isArray(value) ? [...value] : [String(value)]
    }
  }
  next['Content-Security-Policy'] = [policy]
  return next
}

const installedSessions = new WeakSet<CspWebRequestSession>()

/**
 * Attach `webRequest.onHeadersReceived` CSP enforcement to an Electron Session.
 * Idempotent per session instance so hooking both `app.on('session-created')`
 * and `session.defaultSession` never double-installs.
 */
export function installSessionCsp(
  targetSession: CspWebRequestSession,
  getPolicy: () => string
): boolean {
  if (installedSessions.has(targetSession)) return false
  installedSessions.add(targetSession)

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    if (!shouldApplyCspToUrl(details.url)) {
      callback({ cancel: false, responseHeaders: details.responseHeaders })
      return
    }
    callback({
      cancel: false,
      responseHeaders: applyCspResponseHeaders(details.responseHeaders, getPolicy()),
    })
  })
  return true
}
