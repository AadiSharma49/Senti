import { describe, expect, it, vi } from 'vitest'
import {
  installNavigationGuards,
  isAppContentUrl,
  type NavigationGuardContents,
} from '../navigationGuard'

const DEV_URL = 'http://localhost:5173'
const PROD_URL = 'http://127.0.0.1:47615'

/** Fake webContents capturing the installed handlers, like the CSP session fakes. */
function fakeContents() {
  let windowOpenHandler: ((details: { url: string }) => { action: string }) | null = null
  let navigateListener: ((event: { preventDefault(): void }, url: string) => void) | null = null
  const contents: NavigationGuardContents = {
    setWindowOpenHandler(handler) { windowOpenHandler = handler },
    on(event, listener) {
      expect(event).toBe('will-navigate')
      navigateListener = listener
    },
  }
  return {
    contents,
    openWindow: (url: string) => {
      if (!windowOpenHandler) throw new Error('no window-open handler installed')
      return windowOpenHandler({ url })
    },
    navigate: (url: string) => {
      if (!navigateListener) throw new Error('no will-navigate listener installed')
      const event = { preventDefault: vi.fn() }
      navigateListener(event, url)
      return event
    },
  }
}

describe('navigationGuard — renderer window/navigation lockdown', () => {
  describe('isAppContentUrl', () => {
    it('allows only exact-origin matches of the loaded app content', () => {
      expect(isAppContentUrl('http://localhost:5173/', DEV_URL)).toBe(true)
      expect(isAppContentUrl('http://localhost:5173/index.html?x=1#frag', DEV_URL)).toBe(true)
      expect(isAppContentUrl('http://127.0.0.1:47615/models/whisper', PROD_URL)).toBe(true)
    })

    it('blocks remote sites, other loopback ports, and lookalike hosts', () => {
      const hostile = [
        'https://evil.example/login',
        'http://localhost:5174/',
        'http://127.0.0.1:47616/',
        'http://localhost:5173.evil.example/',
        'http://localhost:5173@evil.example/',
        'https://localhost:5173/',
        'http://127.0.0.1:5173/',
      ]
      for (const url of hostile) {
        expect(isAppContentUrl(url, DEV_URL)).toBe(false)
        expect(isAppContentUrl(url, PROD_URL)).toBe(false)
      }
    })

    it('blocks non-http schemes and unparseable URLs', () => {
      const hostile = [
        'file:///C:/Windows/System32/cmd.exe',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'about:blank',
        'chrome://gpu',
        'not a url',
        '',
      ]
      for (const url of hostile) expect(isAppContentUrl(url, DEV_URL)).toBe(false)
      expect(isAppContentUrl(null, DEV_URL)).toBe(false)
      expect(isAppContentUrl(undefined, DEV_URL)).toBe(false)
    })

    it('fails shut when the app origin is unset or malformed', () => {
      for (const appUrl of ['', 'not a url', 'file:///C:/app/index.html', null, undefined]) {
        expect(isAppContentUrl('http://localhost:5173/', appUrl)).toBe(false)
        expect(isAppContentUrl('file:///C:/app/index.html', appUrl)).toBe(false)
      }
    })
  })

  describe('installNavigationGuards', () => {
    it('denies every window.open, even to the app origin (no whitelisted case)', () => {
      const fake = fakeContents()
      installNavigationGuards(fake.contents, () => DEV_URL)
      for (const url of ['https://evil.example/', 'http://localhost:5173/', 'about:blank']) {
        expect(fake.openWindow(url)).toEqual({ action: 'deny' })
      }
    })

    it('blocks navigation away from the app origin and lets same-origin through', () => {
      const fake = fakeContents()
      installNavigationGuards(fake.contents, () => PROD_URL)

      expect(fake.navigate('http://127.0.0.1:47615/other-page').preventDefault).not.toHaveBeenCalled()

      for (const url of ['https://evil.example/', 'http://127.0.0.1:9999/', 'file:///C:/x']) {
        expect(fake.navigate(url).preventDefault).toHaveBeenCalledTimes(1)
      }
    })

    it('reads the app origin lazily so the late-bound packaged server is picked up', () => {
      const fake = fakeContents()
      let prodBaseUrl = ''
      installNavigationGuards(fake.contents, () => prodBaseUrl)

      // Before the static server starts, everything is denied.
      expect(fake.navigate('http://127.0.0.1:47615/').preventDefault).toHaveBeenCalledTimes(1)

      prodBaseUrl = PROD_URL
      expect(fake.navigate('http://127.0.0.1:47615/').preventDefault).not.toHaveBeenCalled()
    })

    it('reports blocked attempts with their kind and URL', () => {
      const fake = fakeContents()
      const onBlocked = vi.fn()
      installNavigationGuards(fake.contents, () => DEV_URL, onBlocked)

      fake.openWindow('https://evil.example/popup')
      fake.navigate('https://evil.example/phish')
      fake.navigate('http://localhost:5173/ok')

      expect(onBlocked.mock.calls).toEqual([
        ['window-open', 'https://evil.example/popup'],
        ['navigate', 'https://evil.example/phish'],
      ])
    })
  })
})