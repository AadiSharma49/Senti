import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_SERVER_ORIGIN,
  normalizeApiMethod,
  normalizeServerOrigin,
  resolveConfiguredOrigin,
  resolveDeviceApiUrl,
  shouldClearTokenOnServerChange,
} from '../apiGuard'

describe('apiGuard — main-process server origin pinning', () => {
  describe('normalizeServerOrigin', () => {
    it('normalizes valid HTTP and HTTPS origins and strips trailing slashes', () => {
      expect(normalizeServerOrigin('https://senti-kappa.vercel.app')).toBe('https://senti-kappa.vercel.app')
      expect(normalizeServerOrigin('https://senti-kappa.vercel.app///')).toBe('https://senti-kappa.vercel.app')
      expect(normalizeServerOrigin('  http://localhost:3000/  ')).toBe('http://localhost:3000')
      expect(normalizeServerOrigin('http://127.0.0.1:6767')).toBe('http://127.0.0.1:6767')
    })

    it('rejects non-HTTP(S) schemes, credentials, paths, queries, and fragments', () => {
      expect(normalizeServerOrigin('')).toBeNull()
      expect(normalizeServerOrigin('   ')).toBeNull()
      expect(normalizeServerOrigin(null)).toBeNull()
      expect(normalizeServerOrigin('ws://127.0.0.1:9876')).toBeNull()
      expect(normalizeServerOrigin('file:///C:/Windows/System32')).toBeNull()
      expect(normalizeServerOrigin('javascript:alert(1)')).toBeNull()
      expect(normalizeServerOrigin('https://user:pass@evil.example')).toBeNull()
      expect(normalizeServerOrigin('https://evil.example/api')).toBeNull()
      expect(normalizeServerOrigin('https://evil.example?x=1')).toBeNull()
      expect(normalizeServerOrigin('https://evil.example#frag')).toBeNull()
    })
  })

  describe('resolveConfiguredOrigin', () => {
    it('prefers valid saved override, then build env URL, then production default', () => {
      expect(resolveConfiguredOrigin('http://localhost:3000/', 'https://staging.example.com')).toBe(
        'http://localhost:3000'
      )
      expect(resolveConfiguredOrigin('', 'https://staging.example.com/')).toBe('https://staging.example.com')
      expect(resolveConfiguredOrigin('not-a-url', '')).toBe(DEFAULT_SERVER_ORIGIN)
    })
  })

  describe('resolveDeviceApiUrl', () => {
    const pinned = 'https://senti-kappa.vercel.app'

    it('builds outbound URLs on the pinned origin when baseUrl matches or is omitted', () => {
      expect(resolveDeviceApiUrl(pinned, undefined, '/api/device/chat')).toBe(
        'https://senti-kappa.vercel.app/api/device/chat'
      )
      expect(resolveDeviceApiUrl(pinned, 'https://senti-kappa.vercel.app/', '/api/device/remote/signal?id=abc')).toBe(
        'https://senti-kappa.vercel.app/api/device/remote/signal?id=abc'
      )
    })

    it('blocks renderer attempts to redirect the bearer token to another origin', () => {
      expect(resolveDeviceApiUrl(pinned, 'https://attacker.example', '/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, 'http://senti-kappa.vercel.app', '/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, 'https://senti-kappa.vercel.app:8443', '/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, 'https://senti-kappa.vercel.app.evil.example', '/api/device/chat')).toBeNull()
    })

    it('blocks paths outside /api/device/* and traversal tricks', () => {
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/account')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '//attacker.example/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device/../account')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device/%2e%2e/account')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device/chat\\..\\secret')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device/chat\r\nX-Injected: 1')).toBeNull()
    })

    it('blocks absolute URLs, non-string baseUrl tricks, and encoded backslash traversal', () => {
      expect(resolveDeviceApiUrl(pinned, pinned, 'https://attacker.example/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, 'http://attacker.example/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, { toString: () => pinned }, '/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, 42, '/api/device/chat')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device/..%5csecret')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device/%2E%2E/account')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, '/api/device/chat?x=\r\nInjected')).toBeNull()
      expect(resolveDeviceApiUrl(pinned, pinned, 123)).toBeNull()
    })

    it('accepts case/default-port variants of the SAME origin (URL normalization)', () => {
      expect(resolveDeviceApiUrl(pinned, 'HTTPS://SENTI-KAPPA.VERCEL.APP', '/api/device/chat')).toBe(
        'https://senti-kappa.vercel.app/api/device/chat'
      )
      expect(resolveDeviceApiUrl(pinned, 'https://senti-kappa.vercel.app:443', '/api/device/chat')).toBe(
        'https://senti-kappa.vercel.app/api/device/chat'
      )
    })

    it('never lets any accepted path change the outbound origin', () => {
      // Ambiguous encodings must either be rejected or stay on the pinned host.
      const adversarialPaths = [
        '/api/device/%252e%252e/account',
        '/api/device/ch\tat',
        '/api/device/@attacker.example/x',
        '/api/device/https://attacker.example',
        '/api/device/%2f%2fattacker.example/x',
        '/api/device/chat?next=https://attacker.example',
        '/api/device/chat#https://attacker.example',
      ]
      for (const p of adversarialPaths) {
        const url = resolveDeviceApiUrl(pinned, pinned, p)
        if (url !== null) {
          expect(new URL(url).origin, `${p} escaped the pinned origin`).toBe(pinned)
          expect(new URL(url).pathname.startsWith('/api/device/')).toBe(true)
        }
      }
    })
  })

  describe('normalizeApiMethod', () => {
    it('defaults an absent method to GET and accepts the device API verbs', () => {
      expect(normalizeApiMethod(undefined)).toBe('GET')
      expect(normalizeApiMethod(null)).toBe('GET')
      expect(normalizeApiMethod('GET')).toBe('GET')
      expect(normalizeApiMethod('post')).toBe('POST')
      expect(normalizeApiMethod(' Patch ')).toBe('PATCH')
      expect(normalizeApiMethod('delete')).toBe('DELETE')
    })

    it('fails shut on anything else the renderer might send', () => {
      expect(normalizeApiMethod('CONNECT')).toBeNull()
      expect(normalizeApiMethod('TRACE')).toBeNull()
      expect(normalizeApiMethod('PUT')).toBeNull()
      expect(normalizeApiMethod('')).toBeNull()
      expect(normalizeApiMethod('GET\r\nX: 1')).toBeNull()
      expect(normalizeApiMethod({})).toBeNull()
      expect(normalizeApiMethod(7)).toBeNull()
    })
  })

  describe('shouldClearTokenOnServerChange', () => {
    it('requires clearing the stored token whenever the server origin changes', () => {
      expect(shouldClearTokenOnServerChange('https://senti-kappa.vercel.app', 'http://localhost:3000')).toBe(true)
      expect(shouldClearTokenOnServerChange('https://senti-kappa.vercel.app', 'https://senti-kappa.vercel.app')).toBe(
        false
      )
    })
  })

  /**
   * Source-level invariants on main.ts, in the same spirit as
   * actionPermissions.test.ts: the pure guard functions above are only half
   * the guarantee — main must actually CALL them, in the right order, on the
   * only code path that touches the bearer token.
   */
  describe('main.ts wiring invariants', () => {
    const mainSource = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
    const apiRequestStart = mainSource.indexOf('async function apiRequest(')
    const apiRequestEnd = mainSource.indexOf('// Tap-to-talk', apiRequestStart)
    const apiRequestBody = mainSource.slice(apiRequestStart, apiRequestEnd)

    it('apiRequest exists and pins the URL before the token is ever loaded', () => {
      expect(apiRequestStart).toBeGreaterThan(-1)
      expect(apiRequestEnd).toBeGreaterThan(apiRequestStart)
      const pinAt = apiRequestBody.indexOf('resolveDeviceApiUrl(configuredServerOrigin()')
      const tokenAt = apiRequestBody.indexOf('loadToken()')
      expect(pinAt).toBeGreaterThan(-1)
      expect(tokenAt).toBeGreaterThan(-1)
      expect(pinAt, 'token loaded before the origin pin ran').toBeLessThan(tokenAt)
    })

    it('apiRequest fails shut on redirects and unwhitelisted methods', () => {
      expect(apiRequestBody).toContain("redirect: 'error'")
      expect(apiRequestBody).toContain('normalizeApiMethod(method)')
      expect(apiRequestBody).toContain('method: verb')
    })

    it('attaches the bearer token in exactly one place — the pinned apiRequest', () => {
      const bearerUses = mainSource.match(/Bearer \$\{token\}/g) ?? []
      expect(bearerUses.length).toBe(1)
      expect(apiRequestBody).toContain('Bearer ${token}')
    })

    it('server origin changes require a native confirmation before persisting', () => {
      const handlerStart = mainSource.indexOf("ipcMain.handle('senti:set-api-base'")
      const handlerEnd = mainSource.indexOf("ipcMain.handle('senti:system-info'", handlerStart)
      expect(handlerStart).toBeGreaterThan(-1)
      const handler = mainSource.slice(handlerStart, handlerEnd)
      const confirmAt = handler.indexOf('confirmServerChange(')
      const writeAt = handler.indexOf('writeServerOverride(')
      expect(confirmAt).toBeGreaterThan(-1)
      expect(writeAt).toBeGreaterThan(-1)
      expect(confirmAt, 'server override persisted without native confirmation').toBeLessThan(writeAt)
      // Both branches (explicit URL and reset-to-default) must confirm.
      expect((handler.match(/await confirmServerChange\(/g) ?? []).length).toBe(2)
    })
  })
})
