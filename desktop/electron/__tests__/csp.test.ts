import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SERVER_ORIGIN } from '../apiGuard'
import {
  applyCspResponseHeaders,
  buildContentSecurityPolicy,
  installSessionCsp,
  shouldApplyCspToUrl,
  type CspHeadersReceivedDetails,
  type CspHeadersReceivedResponse,
  type CspWebRequestSession,
} from '../csp'

function parseDirectives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (!tokens.length) continue
    const [name, ...values] = tokens
    map.set(name, values)
  }
  return map
}

describe('csp — session-enforced Content-Security-Policy', () => {
  describe('buildContentSecurityPolicy', () => {
    it('restricts script-src to bundled code, blocks inline scripts and eval, and pins connect-src to our API host', () => {
      const policy = buildContentSecurityPolicy({ apiOrigin: DEFAULT_SERVER_ORIGIN })
      const d = parseDirectives(policy)

      expect(d.get('default-src')).toEqual(["'none'"])
      expect(d.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"])
      expect(d.get('script-src')).not.toContain("'unsafe-inline'")
      expect(d.get('script-src')).not.toContain("'unsafe-eval'")
      expect(d.get('script-src')).not.toContain('blob:')
      expect(d.get('script-src')).not.toContain('data:')

      expect(d.get('worker-src')).toEqual(["'self'"])
      expect(d.get('connect-src')).toEqual(["'self'", 'https://senti-kappa.vercel.app'])
      expect(d.get('connect-src')).not.toContain('https:')
      expect(d.get('connect-src')).not.toContain('blob:')

      expect(d.get('object-src')).toEqual(["'none'"])
      expect(d.get('frame-src')).toEqual(["'none'"])
      expect(d.get('frame-ancestors')).toEqual(["'none'"])
      expect(d.get('base-uri')).toEqual(["'none'"])
      expect(d.get('form-action')).toEqual(["'none'"])
    })

    it('updates connect-src when a custom self-hosted API origin is configured', () => {
      const policy = buildContentSecurityPolicy({ apiOrigin: 'https://sentinel.internal.example:8443/' })
      const d = parseDirectives(policy)
      expect(d.get('connect-src')).toEqual(["'self'", 'https://sentinel.internal.example:8443'])
    })

    it('fails shut to self-only connect-src on malformed or injection-laden apiOrigin inputs', () => {
      const hostileInputs: unknown[] = [
        "https://evil.example; script-src 'unsafe-inline' 'unsafe-eval'",
        'https://user:pass@evil.example',
        'https://evil.example/api',
        'javascript:alert(1)',
        '',
        null,
        undefined,
      ]
      for (const raw of hostileInputs) {
        const d = parseDirectives(buildContentSecurityPolicy({ apiOrigin: raw }))
        expect(d.get('connect-src')).toEqual(["'self'"])
        expect(d.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'"])
      }
    })

    it('adds exact loopback HTTP + WS origins in development only and ignores non-loopback dev URLs', () => {
      const devPolicy = buildContentSecurityPolicy({
        apiOrigin: DEFAULT_SERVER_ORIGIN,
        devServerUrls: ['http://localhost:5173/', 'https://attacker.example:5173/'],
      })
      const d = parseDirectives(devPolicy)
      expect(d.get('connect-src')).toEqual([
        "'self'",
        'https://senti-kappa.vercel.app',
        'http://localhost:5173',
        'ws://localhost:5173',
      ])
    })
  })

  describe('shouldApplyCspToUrl & applyCspResponseHeaders', () => {
    it('applies CSP to app and web URLs while sparing internal DevTools schemes', () => {
      expect(shouldApplyCspToUrl('http://127.0.0.1:47615/index.html')).toBe(true)
      expect(shouldApplyCspToUrl('http://localhost:5173/')).toBe(true)
      expect(shouldApplyCspToUrl('https://attacker.example/page')).toBe(true)
      expect(shouldApplyCspToUrl('file:///C:/app/index.html')).toBe(true)
      expect(shouldApplyCspToUrl('about:blank')).toBe(true)

      expect(shouldApplyCspToUrl('devtools://devtools/bundled/inspector.html')).toBe(false)
      expect(shouldApplyCspToUrl('chrome://gpu')).toBe(false)
      expect(shouldApplyCspToUrl('chrome-extension://abcdef/popup.html')).toBe(false)
    })

    it('replaces any pre-existing CSP header case-insensitively while preserving other headers', () => {
      const enforced = buildContentSecurityPolicy({ apiOrigin: DEFAULT_SERVER_ORIGIN })
      const merged = applyCspResponseHeaders(
        {
          'Content-Type': ['text/html; charset=utf-8'],
          'content-security-policy': ["default-src * 'unsafe-inline' 'unsafe-eval'"],
          'Content-Security-Policy-Report-Only': ['default-src *'],
          'Cache-Control': 'no-store',
        },
        enforced
      )

      expect(Object.keys(merged).filter((k) => k.toLowerCase().startsWith('content-security-policy'))).toEqual([
        'Content-Security-Policy',
      ])
      expect(merged['Content-Security-Policy']).toEqual([enforced])
      expect(merged['Content-Type']).toEqual(['text/html; charset=utf-8'])
      expect(merged['Cache-Control']).toEqual(['no-store'])
    })
  })

  describe('installSessionCsp', () => {
    it('enforces CSP via webRequest.onHeadersReceived, reflects dynamic server changes, and installs once per session', () => {
      let registeredListener:
        | ((details: CspHeadersReceivedDetails, cb: (res: CspHeadersReceivedResponse) => void) => void)
        | null = null
      const onHeadersReceived = vi.fn((listener) => {
        registeredListener = listener
      })
      const fakeSession: CspWebRequestSession = { webRequest: { onHeadersReceived } }

      let currentOrigin = 'https://senti-kappa.vercel.app'
      const getPolicy = () => buildContentSecurityPolicy({ apiOrigin: currentOrigin })

      expect(installSessionCsp(fakeSession, getPolicy)).toBe(true)
      expect(installSessionCsp(fakeSession, getPolicy)).toBe(false)
      expect(onHeadersReceived).toHaveBeenCalledTimes(1)

      let firstRes: CspHeadersReceivedResponse | undefined
      registeredListener!(
        {
          url: 'http://127.0.0.1:47615/',
          responseHeaders: { 'content-security-policy': ["script-src 'unsafe-inline'"] },
        },
        (r) => {
          firstRes = r
        }
      )
      expect(firstRes?.cancel).toBe(false)
      expect(firstRes?.responseHeaders?.['content-security-policy']).toBeUndefined()
      expect(firstRes?.responseHeaders?.['Content-Security-Policy']).toEqual([
        buildContentSecurityPolicy({ apiOrigin: 'https://senti-kappa.vercel.app' }),
      ])

      // Simulate user confirming a server origin change in Settings.
      currentOrigin = 'http://localhost:3000'
      let secondRes: CspHeadersReceivedResponse | undefined
      registeredListener!({ url: 'http://127.0.0.1:47615/' }, (r) => {
        secondRes = r
      })
      const updated = (secondRes?.responseHeaders?.['Content-Security-Policy'] as string[])[0]
      expect(parseDirectives(updated).get('connect-src')).toEqual(["'self'", 'http://localhost:3000'])

      // DevTools URLs pass through untouched.
      const devToolsHeaders = { 'Content-Type': ['text/html'] }
      let devToolsRes: CspHeadersReceivedResponse | undefined
      registeredListener!({ url: 'devtools://devtools/bundled/inspector.html', responseHeaders: devToolsHeaders }, (r) => {
        devToolsRes = r
      })
      expect(devToolsRes?.responseHeaders).toBe(devToolsHeaders)
    })
  })

  describe('wiring invariants across main.ts, index.html, and transformersEnv.ts', () => {
    const mainSource = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    const indexHtml = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf8')
    const transformersEnv = readFileSync(join(__dirname, '..', '..', 'src', 'services', 'transformersEnv.ts'), 'utf8')

    it('installs CSP on session-created and defaultSession before createWindow() runs', () => {
      expect(mainSource).toContain("app.on('session-created'")
      const readyStart = mainSource.indexOf('app.whenReady().then(')
      const installAt = mainSource.indexOf('installSessionCsp(session.defaultSession', readyStart)
      const createAt = mainSource.indexOf('createWindow()', readyStart)
      expect(readyStart).toBeGreaterThan(-1)
      expect(installAt).toBeGreaterThan(readyStart)
      expect(createAt).toBeGreaterThan(installAt)
    })

    it('does not leave a strippable or permissive CSP meta tag or inline script in index.html', () => {
      expect(indexHtml.toLowerCase()).not.toContain('content-security-policy')
      const scriptTags = indexHtml.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? []
      expect(scriptTags.length).toBeGreaterThan(0)
      for (const tag of scriptTags) {
        expect(tag).toMatch(/\bsrc=["'][^"']+["']/)
        expect(tag.replace(/<script\b[^>]*>|<\/script>/gi, '').trim()).toBe('')
      }
    })

    it('disables blob-based WASM factory caching so bundled ORT loads cleanly under script-src self', () => {
      expect(transformersEnv).toContain('env.useWasmCache = false')
    })
  })
})
