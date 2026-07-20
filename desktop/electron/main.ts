import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import http from 'http'
import os from 'os'
import electron from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
const { app, BrowserWindow, screen, ipcMain, globalShortcut, safeStorage, session } = electron
import path from 'path'
import { fileURLToPath } from 'url'

// ESM compatibility: Define __dirname and __filename
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow: BrowserWindowType | null = null
// In the packaged app we serve the built files over local HTTP (see
// startStaticServer) so the renderer behaves EXACTLY like dev. Set once ready.
let prodBaseUrl = ''

// --- Multi-monitor cover ---------------------------------------------
//
// The lock lived on the primary display only, so on a second monitor the
// desktop stayed visible AND CLICKABLE while Senti claimed to be locked — a
// real bypass, not a cosmetic bug. Every non-primary display now gets an
// opaque, always-on-top cover for as long as we're locked.
let coverWindows: BrowserWindowType[] = []

const COVER_HTML =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#070a0e;overflow:hidden;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;cursor:none}
  .w{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
  .orb{width:74px;height:74px;border-radius:50%;border:2px solid rgba(0,212,255,.55);
    box-shadow:0 0 34px rgba(0,212,255,.28) inset,0 0 44px rgba(0,212,255,.16);
    animation:p 2.6s ease-in-out infinite}
  @keyframes p{0%,100%{transform:scale(.94);opacity:.6}50%{transform:scale(1.04);opacity:1}}
  .t{color:#7e93a6;font-size:12px;letter-spacing:.34em;text-transform:uppercase}
</style></head><body><div class="w"><div class="orb"></div>
<div class="t">Locked by Senti</div></div></body></html>`)

function closeCoverWindows(): void {
  for (const w of coverWindows) {
    try {
      if (!w.isDestroyed()) {
        w.setClosable(true)
        w.destroy()
      }
    } catch {
      // ignore
    }
  }
  coverWindows = []
}

function createCoverWindows(): void {
  closeCoverWindows()
  const primaryId = screen.getPrimaryDisplay().id
  for (const d of screen.getAllDisplays()) {
    if (d.id === primaryId) continue
    try {
      const w = new BrowserWindow({
        x: d.bounds.x,
        y: d.bounds.y,
        width: d.bounds.width,
        height: d.bounds.height,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        // Never take keyboard focus — the PIN box on the primary lock keeps it.
        focusable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        // NOT fullscreen: on Windows `fullscreen:true` goes fullscreen on the
        // PRIMARY display (behind the lock), not the target monitor. Exact
        // bounds cover the whole second screen, taskbar included.
        enableLargerThanScreen: true,
        backgroundColor: '#070a0e',
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      })
      // 'screen-saver' is the highest normal level — above the taskbar and
      // other apps' always-on-top windows.
      w.setAlwaysOnTop(true, 'screen-saver')
      w.setVisibleOnAllWorkspaces(true)
      w.setBounds(d.bounds) // force onto THIS display, full size
      w.loadURL(COVER_HTML)
      w.once('ready-to-show', () => {
        w.setBounds(d.bounds)
        w.showInactive() // visible, but focus stays on the lock
        w.moveTop()
      })
      coverWindows.push(w)
    } catch {
      // A display we can't cover shouldn't crash the lock.
    }
  }
}

/** Covers follow the lock state, and survive monitors being plugged in. */
function syncCovers(): void {
  if (!isLocked) {
    closeCoverWindows()
    return
  }
  // Already covering exactly the right screens? Don't recreate them — that
  // would flicker the second monitor on every lock-state push.
  const need = Math.max(0, screen.getAllDisplays().length - 1)
  const have = coverWindows.filter((w) => !w.isDestroyed()).length
  if (have === need && need > 0) return
  createCoverWindows()
}

// --- Local static server (packaged app) ------------------------------
//
// The renderer loads on-device ML models from "/models/...". Over file://
// that path resolves to the DRIVE ROOT and the models are never found —
// which is why voice worked in dev (served on http://localhost) but failed
// the moment the app was installed. Serving the built "dist" folder over
// http://localhost fixes it: /models, wasm fetches, workers — all behave like
// dev. Bound to 127.0.0.1 only, so nothing off-machine can reach it.
const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream', '.bin': 'application/octet-stream',
  '.data': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.txt': 'text/plain', '.map': 'application/json',
}

// A FIXED port, so the origin — and therefore localStorage — is STABLE across
// launches. With a random port, every start was a different origin with empty
// storage, so Senti forgot the PIN, the voiceprint, and "setup done", and made
// the user redo onboarding every single boot. Only fall back to nearby ports if
// this one is somehow taken (rare — the single-instance lock means it's ours).
const STATIC_PORT_BASE = 47615

function startStaticServer(root: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html'
        // Prevent path traversal; keep everything under root.
        const safe = path.normalize(urlPath).replace(/^([/\\])+/, '')
        const filePath = path.join(root, safe)
        if (!filePath.startsWith(root) || !existsSync(filePath)) {
          res.writeHead(404); res.end('Not found'); return
        }
        const body = readFileSync(filePath)
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        res.end(body)
      } catch {
        res.writeHead(500); res.end('Error')
      }
    })

    let port = STATIC_PORT_BASE
    let attempts = 0
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempts < 12) {
        attempts++
        port++
        setTimeout(() => server.listen(port, '127.0.0.1'), 40)
      } else {
        reject(err)
      }
    })
    server.on('listening', () => resolve(`http://127.0.0.1:${port}`))
    server.listen(port, '127.0.0.1')
  })
}

// --- Device token vault ---------------------------------------------
//
// The device token is a bearer credential for this machine's account. It used
// to live in localStorage, where any script in the renderer — or anyone who
// opened DevTools — could read it straight out.
//
// Now it lives ONLY in the main process: encrypted at rest with the OS keystore
// (DPAPI on Windows) and never handed back to the renderer. The renderer can
// set it, clear it, and ask whether one exists — but it cannot read it. All
// backend calls are made from here, with the token attached in main.

const tokenFile = () => path.join(app.getPath('userData'), 'device.token')

function saveToken(token: string): boolean {
  try {
    mkdirSync(path.dirname(tokenFile()), { recursive: true })
    // safeStorage is unavailable on a bare Linux without a keyring; refuse to
    // silently write a credential in the clear.
    if (!safeStorage.isEncryptionAvailable()) return false
    writeFileSync(tokenFile(), safeStorage.encryptString(token))
    return true
  } catch {
    return false
  }
}

function loadToken(): string | null {
  try {
    if (!existsSync(tokenFile())) return null
    if (!safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(tokenFile()))
  } catch {
    return null
  }
}

function clearToken(): void {
  try {
    if (existsSync(tokenFile())) unlinkSync(tokenFile())
  } catch {
    // ignore
  }
}

// --- Setup-completion flag (file, NOT localStorage) ------------------
//
// "Setup done" used to live only in localStorage, which is scoped to the
// renderer ORIGIN. The packaged app serves itself over http://127.0.0.1:<port>;
// if that port ever changes between launches, the origin changes and
// localStorage is empty — so the app forgets setup and shows the first-run
// wizard AGAIN. A plain file in userData is origin-independent, so the flag
// survives no matter what port the local server ends up on.
const setupFlagFile = () => path.join(app.getPath('userData'), 'setup.json')

function readSetupFlag(): boolean {
  try {
    if (!existsSync(setupFlagFile())) return false
    return JSON.parse(readFileSync(setupFlagFile(), 'utf8'))?.setupCompleted === true
  } catch {
    return false
  }
}

function writeSetupFlag(done: boolean): void {
  try {
    mkdirSync(path.dirname(setupFlagFile()), { recursive: true })
    writeFileSync(setupFlagFile(), JSON.stringify({ setupCompleted: !!done }))
  } catch {
    // ignore
  }
}

/**
 * The ONLY path from Senti to its backend.
 *
 * Runs in Node, not a browser context — so these requests carry no Origin
 * header and are not subject to CORS. That is what lets the server refuse
 * every browser outright instead of publishing `Access-Control-Allow-Origin: *`.
 */
async function apiRequest(opts: {
  baseUrl: string
  path: string
  method?: string
  body?: unknown
  auth?: boolean
}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { baseUrl, path: p, method = 'GET', body, auth = true } = opts

  // Only ever talk to the configured backend, and only to the device API.
  if (!/^https?:\/\//i.test(baseUrl) || !p.startsWith('/api/device/')) {
    return { ok: false, status: 400, data: { error: 'Blocked request' } }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = loadToken()
    if (!token) return { ok: false, status: 401, data: { error: 'This device is not linked' } }
    headers.Authorization = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${baseUrl}${p}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : 'Network error' },
    }
  }
}

// --- Lock hardening -------------------------------------------------
// The renderer is the source of truth for auth; it pushes lock state to
// the main process via the `senti:set-lock-state` IPC. While locked, the
// window cannot be closed and common escape hotkeys are swallowed.
let isLocked = true

// Hotkeys we try to swallow while locked. Windows reserves some
// combinations for the OS (Ctrl+Alt+Del, and the Win key alone) that no
// application can intercept — those are handled by the kernel and are out
// of our reach by design.
const LOCK_SHORTCUTS = [
  'Alt+Tab',
  'Alt+F4',
  'Alt+Escape',
  'CommandOrControl+W',
  'CommandOrControl+Shift+W',
  'CommandOrControl+Shift+Escape', // Task Manager (best-effort; OS may still win)
  'Super',                          // Win key (best-effort)
]

// Documented recovery hatch: if voice AND PIN both fail during
// development/testing, this force-quits Senti so you can never trap
// yourself on your own machine. Kept intentionally obscure.
const RECOVERY_SHORTCUT = 'CommandOrControl+Alt+Shift+Q'

function registerLockShortcuts(): void {
  for (const accel of LOCK_SHORTCUTS) {
    try {
      globalShortcut.register(accel, () => {
        // Swallow: do nothing while locked.
      })
    } catch {
      // Some accelerators are not registrable on this OS; ignore.
    }
  }
}

function unregisterLockShortcuts(): void {
  for (const accel of LOCK_SHORTCUTS) {
    try {
      if (globalShortcut.isRegistered(accel)) globalShortcut.unregister(accel)
    } catch {
      // ignore
    }
  }
}

function setLocked(locked: boolean): void {
  isLocked = locked
  if (locked) registerLockShortcuts()
  else unregisterLockShortcuts()
  // Blank every other monitor while locked; give them back on unlock.
  syncCovers()
}

function waitForVite(url: string, timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tryConnect = () => {
      const req = http.get(url, res => {
        if (res.statusCode === 200) {
          resolve()
        } else {
          retry()
        }
      })
      req.on('error', retry)
    }
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Vite dev server not reachable at ${url}`))
      } else {
        setTimeout(tryConnect, 300)
      }
    }
    tryConnect()
  })
}

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const preloadPath = path.join(__dirname, 'preload.cjs')
  mainWindow = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    frame: false,
    transparent: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    thickFrame: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setVisibleOnAllWorkspaces(true)
  mainWindow.setMenuBarVisibility(false)
  // Sit above the taskbar and every other app's always-on-top window.
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL).catch((err: Error) => {
      console.error('[Electron] Failed to load dev server:', err.message)
    })
  } else if (prodBaseUrl) {
    // Served over http://127.0.0.1 so /models and wasm resolve like dev.
    mainWindow.loadURL(prodBaseUrl).catch((err: Error) => {
      console.error('[Electron] Failed to load prod server:', err.message)
    })
  } else {
    console.error('[Electron] Static server not started; cannot load UI.')
  }

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.show()
    mainWindow?.focus()
    // DevTools grants full renderer control (a total bypass), so only
    // open it in development where the Vite dev server is running.
    if (VITE_DEV_SERVER_URL) {
      mainWindow?.webContents?.openDevTools?.()
    }
  })

  mainWindow.webContents.on('did-fail-load', (_event: unknown, errorCode: number, errorDescription: string, validatedURL: string, isMainFrame: boolean) => {
    console.error('[Electron] Renderer load failed:', { errorCode, errorDescription, validatedURL, isMainFrame })
  })

  mainWindow.webContents.on('console-message', (_event: any, level: number, message: string) => {
    const prefix = ['INFO', 'WARN', 'ERROR', 'DEBUG'][level] || 'LOG'
    console.log(`[Renderer:${prefix}] ${message}`)
  })

  mainWindow.webContents.on('render-process-gone', (_event: any, details: any) => {
    console.error('[Electron] Renderer process gone:', details)
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Electron] Renderer unresponsive')
  })

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus()
    }
  })

  mainWindow.on('minimize', (event: any) => {
    event.preventDefault()
    if (mainWindow) {
      mainWindow.restore()
      mainWindow.focus()
    }
  })

  // Block closing the window while locked (Alt+F4, taskbar close, etc.).
  // The renderer closes the window itself only after a successful unlock,
  // at which point isLocked is already false.
  mainWindow.on('close', (event: any) => {
    if (isLocked) {
      event.preventDefault()
      mainWindow?.focus()
    }
  })

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(true)
    }
  })
}

function enforceFocus(): void {
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isFocused() && mainWindow.isVisible()) {
        mainWindow.focus()
      }
      if (!mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(true)
      }
    }
  }, 500)
}

// A second Senti would fight the first for focus and the lock state. Keep one.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  if (VITE_DEV_SERVER_URL) {
    try {
      await waitForVite(DEV_SERVER_URL)
    } catch (e) {
      console.error('[Electron] Vite dev server failed to start:', e)
      app.quit()
      return
    }
  }

  // Grant the microphone. Without this, getUserMedia is DENIED in the packaged
  // app — voice unlock and the assistant fail silently, and the user is left
  // typing a PIN with no idea why. Senti is the whole app; the mic is core to
  // it, so we allow media outright rather than prompting.
  const isMedia = (p: string) => p === 'media' || p === 'microphone' || p === 'audioCapture'
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(isMedia(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => isMedia(permission))

  // Packaged app: serve the built UI over local HTTP so the ML models load.
  if (!VITE_DEV_SERVER_URL) {
    try {
      prodBaseUrl = await startStaticServer(path.join(__dirname, '../dist'))
    } catch (e) {
      console.error('[Electron] Failed to start static server:', e)
      app.quit()
      return
    }
  }

  createWindow()
  enforceFocus()

  // A monitor plugged in (or unplugged) while locked must not open a hole.
  screen.on('display-added', () => syncCovers())
  screen.on('display-removed', () => syncCovers())
  screen.on('display-metrics-changed', () => syncCovers())

  // Start locked: swallow escape hotkeys until the renderer authenticates.
  setLocked(true)

  // Recovery hatch — always available, even while locked, so a failed
  // voice/PIN attempt can never permanently trap the user.
  try {
    globalShortcut.register(RECOVERY_SHORTCUT, () => {
      isLocked = false
      app.exit(0)
    })
  } catch {
    // ignore if not registrable
  }

  // Start with Windows — but only for a real install. In development this
  // would register the Electron dev binary in the user's startup list.
  if (process.platform === 'win32' && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, args: [] })
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else {
    mainWindow?.show()
    mainWindow?.focus()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  mainWindow = null
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// --- Device token + backend access (main-process only) ---------------
// Note there is deliberately NO "get token" handler. The renderer can prove a
// token exists and can replace or delete it, but it can never read its value.

ipcMain.handle('senti:token-set', (_e: unknown, token: unknown) => {
  if (typeof token !== 'string' || !token.trim()) return false
  return saveToken(token.trim())
})

ipcMain.handle('senti:token-clear', () => {
  clearToken()
  return true
})

ipcMain.handle('senti:token-present', () => !!loadToken())

// Setup flag: sendSync so the renderer can read it synchronously at boot,
// before deciding whether to show the wizard. Set via invoke on completion.
ipcMain.on('senti:get-setup', (e: { returnValue: unknown }) => {
  e.returnValue = readSetupFlag()
})
ipcMain.handle('senti:set-setup', (_e: unknown, done: unknown) => {
  writeSetupFlag(!!done)
  return true
})

ipcMain.handle('senti:api', (_e: unknown, req: unknown) => {
  const r = (req ?? {}) as { baseUrl?: string; path?: string; method?: string; body?: unknown; auth?: boolean }
  if (typeof r.baseUrl !== 'string' || typeof r.path !== 'string') {
    return { ok: false, status: 400, data: { error: 'Bad request' } }
  }
  return apiRequest({
    baseUrl: r.baseUrl,
    path: r.path,
    method: typeof r.method === 'string' ? r.method : 'GET',
    body: r.body,
    auth: r.auth !== false,
  })
})

ipcMain.handle('senti:get-platform', () => process.platform)

ipcMain.handle('senti:device-info', () => ({
  hostname: os.hostname(),
  platform: process.platform,
}))

// The renderer reports its auth state here (locked = anything but unlocked).
ipcMain.handle('senti:set-lock-state', (_event: unknown, locked: boolean) => {
  setLocked(!!locked)
})

/**
 * Setup mode: a normal, resizable window instead of a fullscreen lock.
 *
 * First-time setup is not a lock — it's a form. Forcing it fullscreen and
 * swallowing Alt+Tab makes a new user feel trapped before they've even
 * linked their account. So the renderer tells us when it's in setup, and we
 * behave like an ordinary app until they're done.
 */
function setSetupMode(inSetup: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (inSetup) {
    setLocked(false) // no escape-key swallowing, no monitor covers
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setSize(980, 760)
    mainWindow.center()
  } else {
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(true)
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    mainWindow.setFullScreen(true)
    mainWindow.focus()
  }
}

ipcMain.handle('senti:set-setup-mode', (_e: unknown, inSetup: unknown) => {
  setSetupMode(!!inSetup)
  return true
})

ipcMain.handle('senti:lock', () => {
  setLocked(true)
  mainWindow?.show()
  mainWindow?.focus()
  mainWindow?.setFullScreen(true)
})

ipcMain.handle('senti:quit', () => {
  // Quitting is only permitted once unlocked; while locked, exiting the
  // app must go through authentication (or the recovery hatch).
  if (isLocked) return false
  app.quit()
  return true
})