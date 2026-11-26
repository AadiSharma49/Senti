/**
 * Renderer navigation lockdown for all Sentinel webContents.
 *
 * A compromised or injected renderer must not be able to `window.open()` a
 * fresh Electron window or steer the existing one to an attacker URL — a
 * phishing page drawn inside Senti's trusted, always-on-top chrome. Enforced
 * in the main process via `setWindowOpenHandler` + `will-navigate` (hooked on
 * `app.on('web-contents-created')`, mirroring the session-created CSP in
 * `csp.ts`), never relying on renderer-side link handling:
 *
 *  - `window.open()` is denied outright. No renderer code calls it, so there
 *    is no whitelisted case. Legitimate "open this in a browser" requests go
 *    through `shell.openExternal` in the main process (see `openApp`), never
 *    through a real in-app window.
 *  - Navigation is allowed only to the app's own origin: the Vite dev server
 *    in development, the local static server when packaged. Everything
 *    else — remote sites, `file://`, other loopback ports — is blocked.
 */

export interface NavigationGuardContents {
  setWindowOpenHandler(handler: (details: { url: string }) => { action: 'deny' }): void
  on(event: 'will-navigate', listener: (event: { preventDefault(): void }, url: string) => void): void
}

/**
 * True only when `rawUrl` parses to exactly the origin of `appUrl` (scheme +
 * host + port). `appUrl` must itself be a valid http(s) URL — an empty or
 * malformed app origin (e.g. before the packaged static server has started)
 * fails shut and denies everything.
 */
export function isAppContentUrl(rawUrl: unknown, appUrl: unknown): boolean {
  if (typeof rawUrl !== 'string' || typeof appUrl !== 'string' || !appUrl) return false
  try {
    const base = new URL(appUrl)
    if (base.protocol !== 'http:' && base.protocol !== 'https:') return false
    return new URL(rawUrl).origin === base.origin
  } catch {
    return false
  }
}

/**
 * Attach the window-open denial and navigation guard to one webContents.
 * `getAppUrl` is read lazily on every navigation so the packaged app's
 * late-bound static-server origin is picked up without re-installing.
 */
export function installNavigationGuards(
  contents: NavigationGuardContents,
  getAppUrl: () => string,
  onBlocked?: (kind: 'window-open' | 'navigate', url: string) => void
): void {
  contents.setWindowOpenHandler(({ url }) => {
    onBlocked?.('window-open', url)
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (isAppContentUrl(url, getAppUrl())) return
    event.preventDefault()
    onBlocked?.('navigate', url)
  })
}