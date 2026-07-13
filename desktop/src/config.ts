/**
 * Where Senti's backend lives.
 *
 * Resolution order:
 *   1. A URL the user saved in Settings (survives restarts) — lets an INSTALLED
 *      build be pointed at production without a rebuild.
 *   2. VITE_SENTI_API_URL, baked in at build time (what release builds ship).
 *   3. localhost:3000 — the dev dashboard.
 *
 * Nothing else in the app may hardcode a host.
 */
const OVERRIDE_KEY = 'senti:apiUrl'

const BUILD_TIME_URL = (import.meta.env.VITE_SENTI_API_URL as string | undefined) || ''
const DEFAULT_URL = 'http://localhost:3000'

/** Strip a trailing slash so callers can safely append `/api/...`. */
function clean(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function savedOverride(): string {
  try {
    return clean(localStorage.getItem(OVERRIDE_KEY) || '')
  } catch {
    return ''
  }
}

/** The base URL of the Senti backend, e.g. "https://senti.vercel.app". */
export function apiBase(): string {
  return savedOverride() || clean(BUILD_TIME_URL) || DEFAULT_URL
}

/** Build a full endpoint URL: apiUrl('/api/device/chat'). */
export function apiUrl(path: string): string {
  return `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
}

/** Point this install at a different backend (persisted). Empty clears it. */
export function setApiBase(url: string): void {
  try {
    const v = clean(url)
    if (v) localStorage.setItem(OVERRIDE_KEY, v)
    else localStorage.removeItem(OVERRIDE_KEY)
  } catch {}
}

/** The user's saved override, or '' when following the build default. */
export function apiOverride(): string {
  return savedOverride()
}
