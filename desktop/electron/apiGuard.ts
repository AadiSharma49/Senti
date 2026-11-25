/**
 * Server-origin pinning for Electron main-process device API requests.
 *
 * The device bearer token lives only in the main process (DPAPI-encrypted on
 * disk) so renderer scripts cannot read it. That boundary only holds if the
 * renderer ALSO cannot tell main to send authenticated requests to an arbitrary
 * `baseUrl`, or swap the configured server while keeping an existing token.
 */
export const DEFAULT_SERVER_ORIGIN = 'https://senti-kappa.vercel.app'

/**
 * Parse and validate a configured Sentinel server URL into a bare origin
 * (`scheme://host[:port]`). Rejects non-HTTP(S) schemes, embedded credentials,
 * path prefixes, query strings, and fragments.
 */
export function normalizeServerOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (parsed.username || parsed.password) return null
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) return null
  if (!parsed.hostname) return null

  return parsed.origin
}

/**
 * Precedence: user override stored by main -> build/env URL -> production default.
 */
export function resolveConfiguredOrigin(savedOverride: unknown, envUrl?: unknown): string {
  return (
    normalizeServerOrigin(savedOverride) ??
    normalizeServerOrigin(envUrl) ??
    DEFAULT_SERVER_ORIGIN
  )
}

/**
 * Build the exact outbound URL for a `/api/device/*` call, pinned to main's
 * configured server origin. Returns null when the path escapes `/api/device/`
 * or when the caller supplies a `baseUrl` that does not match `configuredOrigin`.
 */
export function resolveDeviceApiUrl(
  configuredOrigin: string,
  requestedBaseUrl: unknown,
  requestedPath: unknown
): string | null {
  const origin = normalizeServerOrigin(configuredOrigin)
  if (!origin) return null

  if (requestedBaseUrl !== undefined && requestedBaseUrl !== null && requestedBaseUrl !== '') {
    const callerOrigin = normalizeServerOrigin(requestedBaseUrl)
    if (!callerOrigin || callerOrigin !== origin) return null
  }

  if (typeof requestedPath !== 'string') return null
  if (!requestedPath.startsWith('/api/device/') || requestedPath.startsWith('//')) return null
  if (/[\r\n\\\0]/.test(requestedPath)) return null

  // Reject encoded dot-segments before URL normalization as defense in depth.
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(requestedPath.split('?')[0] ?? '')
  } catch {
    return null
  }
  if (decodedPath.includes('..') || decodedPath.includes('\\')) return null

  let target: URL
  try {
    target = new URL(requestedPath, origin)
  } catch {
    return null
  }

  if (target.origin !== origin) return null
  if (!target.pathname.startsWith('/api/device/')) return null

  return target.toString()
}

/**
 * Changing which server this install talks to invalidates any stored pairing
 * token: a token belongs to one server's database, and keeping it across an
 * origin change would let a compromised renderer redirect the bearer token to
 * an attacker-controlled host.
 */
export function shouldClearTokenOnServerChange(previousOrigin: string, nextOrigin: string): boolean {
  return previousOrigin !== nextOrigin
}

/** The only methods the device API uses. Anything else fails shut. */
const ALLOWED_API_METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const
export type ApiMethod = (typeof ALLOWED_API_METHODS)[number]

/**
 * Normalize a renderer-supplied HTTP method against the device API whitelist.
 * Absent method defaults to GET; anything unrecognized returns null so main
 * never forwards an arbitrary verb from a potentially compromised renderer.
 */
export function normalizeApiMethod(method: unknown): ApiMethod | null {
  if (method === undefined || method === null) return 'GET'
  if (typeof method !== 'string') return null
  const upper = method.trim().toUpperCase()
  return (ALLOWED_API_METHODS as readonly string[]).includes(upper) ? (upper as ApiMethod) : null
}
