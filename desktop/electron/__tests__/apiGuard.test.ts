import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SERVER_ORIGIN,
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
  })

  describe('shouldClearTokenOnServerChange', () => {
    it('requires clearing the stored token whenever the server origin changes', () => {
      expect(shouldClearTokenOnServerChange('https://senti-kappa.vercel.app', 'http://localhost:3000')).toBe(true)
      expect(shouldClearTokenOnServerChange('https://senti-kappa.vercel.app', 'https://senti-kappa.vercel.app')).toBe(
        false
      )
    })
  })
})
