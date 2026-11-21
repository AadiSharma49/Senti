import type { ServerConfigResult } from './vite-env'

/**
 * Where Sentinel's backend lives.
 *
 * Resolution order:
 *   1. A URL the user saved in Settings (persisted by Electron main in
 *      `userData/server.json`, so it survives ephemeral localhost port changes
 *      and pins main's bearer-token attachment to that exact origin).
 *   2. VITE_SENTI_API_URL, baked in at build time.
 *   3. Production (`https://senti-kappa.vercel.app`) as the safe default.
 *
 * Nothing else in the app may hardcode a host.
 */
const OVERRIDE_KEY = 'senti:apiUrl'

const BUILD_TIME_URL = (import.meta.env.VITE_SENTI_API_URL as string | undefined) || ''

const DEFAULT_URL = 'https://senti-kappa.vercel.app'

/** Strip trailing slashes so callers can safely append `/api/...`. */
function clean(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function readLocalOverride(): string {
  try {
    return clean(localStorage.getItem(OVERRIDE_KEY) || '')
  } catch {
    return ''
  }
}

function readBootConfig(): { baseUrl: string; override: string } | null {
  try {
    const boot = window.senti?.serverAtBoot
    if (boot && typeof boot.baseUrl === 'string' && boot.baseUrl) {
      return { baseUrl: clean(boot.baseUrl), override: clean(boot.override || '') }
    }
  } catch {
    // Not in Electron or bridge unavailable — fall back below.
  }
  return null
}

let cachedMainConfig: { baseUrl: string; override: string } | null = readBootConfig()

/** The base URL of the Sentinel backend, e.g. "https://senti-kappa.vercel.app". */
export function apiBase(): string {
  if (cachedMainConfig) return cachedMainConfig.baseUrl
  return readLocalOverride() || clean(BUILD_TIME_URL) || DEFAULT_URL
}

/** Build a full endpoint URL: apiUrl('/api/device/chat'). */
export function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
}

/** The user's saved override, or '' when following the build/default server. */
export function apiOverride(): string {
  if (cachedMainConfig) return cachedMainConfig.override
  return readLocalOverride()
}

/**
 * Validate and persist a backend server URL through Electron main when
 * available. Changing the server origin unlinks any stored device token first.
 */
export async function saveServerOrigin(url: string): Promise<ServerConfigResult> {
  const trimmed = clean(url)
  if (window.senti?.setApiBase) {
    const res = await window.senti.setApiBase(trimmed)
    if (res.ok) {
      cachedMainConfig = { baseUrl: clean(res.baseUrl), override: clean(res.override) }
      try {
        if (res.override) localStorage.setItem(OVERRIDE_KEY, res.override)
        else localStorage.removeItem(OVERRIDE_KEY)
      } catch {}
    }
    return res
  }

  // Browser/test fallback when Electron preload is not present.
  if (trimmed) {
    try {
      const parsed = new URL(trimmed)
      if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        return {
          ok: false,
          baseUrl: apiBase(),
          override: apiOverride(),
          unlinked: false,
          error: 'Enter a bare origin such as https://your-sentinel.vercel.app or http://localhost:3000.',
        }
      }
      localStorage.setItem(OVERRIDE_KEY, parsed.origin)
    } catch {
      return {
        ok: false,
        baseUrl: apiBase(),
        override: apiOverride(),
        unlinked: false,
        error: 'Enter a valid server URL.',
      }
    }
  } else {
    try {
      localStorage.removeItem(OVERRIDE_KEY)
    } catch {}
  }

  return { ok: true, baseUrl: apiBase(), override: apiOverride(), unlinked: false }
}
