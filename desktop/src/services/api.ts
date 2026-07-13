import { apiBase } from '../config'
import type { ApiResponse } from '../vite-env'

/**
 * The renderer's only route to the backend.
 *
 * It does NOT fetch. It asks the Electron main process to make the call, which
 * matters for two reasons:
 *
 *  1. The device token lives in main (OS-encrypted) and is attached there — so
 *     renderer code, DevTools, and any XSS can never read the credential.
 *  2. Main is Node, not a browser, so requests carry no Origin header and are
 *     not CORS requests. That lets the server reject browsers outright instead
 *     of advertising `Access-Control-Allow-Origin: *` to the whole web.
 */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<ApiResponse<T>> {
  const bridge = window.senti
  if (!bridge?.api) {
    return { ok: false, status: 0, data: { error: 'Senti bridge unavailable' } as T }
  }
  return bridge.api<T>({
    baseUrl: apiBase(),
    path,
    method: opts.method || 'GET',
    body: opts.body,
    auth: opts.auth,
  })
}

/** Is this device linked to an account? (The token itself is never readable.) */
export async function isLinked(): Promise<boolean> {
  try {
    return await window.senti.tokenPresent()
  } catch {
    return false
  }
}

/** Save the pairing token. Returns false if the OS keystore refused. */
export async function saveToken(token: string): Promise<boolean> {
  try {
    return await window.senti.tokenSet(token)
  } catch {
    return false
  }
}

export async function clearToken(): Promise<void> {
  try {
    await window.senti.tokenClear()
  } catch {
    // ignore
  }
}
