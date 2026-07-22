import {
  existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync,
  readdirSync, statSync, rmdirSync,
} from 'fs'
import { execFile, spawn } from 'child_process'
import http from 'http'
import os from 'os'
import electron from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
const { app, BrowserWindow, screen, ipcMain, globalShortcut, safeStorage, session, shell, Tray, Menu, nativeImage } = electron
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

// (Senti used to be a lock screen that blanked every other monitor. That whole
// mechanism is gone — it is an assistant now, and it never takes your screens.)

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

// --- System awareness -------------------------------------------------
//
// This is what a cloud chatbot fundamentally cannot do: look at THIS machine.
// We collect a small, factual snapshot (memory, disk, top processes, startup
// items) so the assistant can answer "why is my PC slow?" with real numbers
// instead of generic advice.
//
// Read-only, and deliberately narrow: no file contents, no screen, no browsing
// history. Just the vitals you'd see in Task Manager.

interface SystemSnapshot {
  os: string
  cpu: string
  cores: number
  ramTotalGB: number
  ramUsedGB: number
  ramUsedPct: number
  uptimeHours: number
  disks?: { drive: string; totalGB: number; freeGB: number; usedPct: number }[]
  topProcesses?: { name: string; memMB: number }[]
  startupApps?: number
}

let sysCache: { at: number; data: SystemSnapshot } | null = null
const SYS_CACHE_MS = 20_000

function basicSystem(): SystemSnapshot {
  const totalGB = os.totalmem() / 1024 ** 3
  const freeGB = os.freemem() / 1024 ** 3
  const usedGB = totalGB - freeGB
  return {
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model?.trim() ?? 'unknown',
    cores: os.cpus().length,
    ramTotalGB: +totalGB.toFixed(1),
    ramUsedGB: +usedGB.toFixed(1),
    ramUsedPct: Math.round((usedGB / totalGB) * 100),
    uptimeHours: +(os.uptime() / 3600).toFixed(1),
  }
}

/** One PowerShell round-trip for the Windows-specific detail. */
function windowsDetail(): Promise<Partial<SystemSnapshot>> {
  const script = `
$ErrorActionPreference='SilentlyContinue'
$d = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
     ForEach-Object { [pscustomobject]@{ drive=$_.DeviceID; totalGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.FreeSpace/1GB,1) } }
$p = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 6 |
     ForEach-Object { [pscustomobject]@{ name=$_.ProcessName; memMB=[math]::Round($_.WorkingSet/1MB) } }
$s = (Get-CimInstance Win32_StartupCommand | Measure-Object).Count
[pscustomobject]@{ disks=@($d); topProcesses=@($p); startupApps=$s } | ConvertTo-Json -Compress -Depth 4
`
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 6000, windowsHide: true, maxBuffer: 1024 * 512 },
      (err, stdout) => {
        if (err || !stdout) return resolve({})
        try {
          const parsed = JSON.parse(stdout)
          const disks = (parsed.disks || []).map((d: any) => ({
            drive: d.drive,
            totalGB: d.totalGB,
            freeGB: d.freeGB,
            usedPct: d.totalGB ? Math.round(((d.totalGB - d.freeGB) / d.totalGB) * 100) : 0,
          }))
          resolve({
            disks,
            topProcesses: parsed.topProcesses || [],
            startupApps: typeof parsed.startupApps === 'number' ? parsed.startupApps : undefined,
          })
        } catch {
          resolve({})
        }
      }
    )
  })
}

// --- OS actions -------------------------------------------------------
//
// The first thing Senti can DO rather than just say. Security is the whole
// design here: the model only ever supplies a FRIENDLY NAME, which we look up
// in a whitelist. Model output never reaches a shell as a command, so a prompt
// injection ("open '; format c:'") resolves to nothing instead of executing.

type AppTarget = { kind: 'exe' | 'url'; target: string; label: string }

const APP_ALIASES: Record<string, AppTarget> = {
  // Browsers
  chrome: { kind: 'exe', target: 'chrome', label: 'Chrome' },
  'google chrome': { kind: 'exe', target: 'chrome', label: 'Chrome' },
  edge: { kind: 'exe', target: 'msedge', label: 'Edge' },
  firefox: { kind: 'exe', target: 'firefox', label: 'Firefox' },
  // Windows built-ins
  notepad: { kind: 'exe', target: 'notepad', label: 'Notepad' },
  calculator: { kind: 'exe', target: 'calc', label: 'Calculator' },
  calc: { kind: 'exe', target: 'calc', label: 'Calculator' },
  explorer: { kind: 'exe', target: 'explorer', label: 'File Explorer' },
  files: { kind: 'exe', target: 'explorer', label: 'File Explorer' },
  'file explorer': { kind: 'exe', target: 'explorer', label: 'File Explorer' },
  'task manager': { kind: 'exe', target: 'taskmgr', label: 'Task Manager' },
  settings: { kind: 'url', target: 'ms-settings:', label: 'Settings' },
  terminal: { kind: 'exe', target: 'wt', label: 'Terminal' },
  cmd: { kind: 'exe', target: 'cmd', label: 'Command Prompt' },
  paint: { kind: 'exe', target: 'mspaint', label: 'Paint' },
  // Common apps
  spotify: { kind: 'exe', target: 'spotify', label: 'Spotify' },
  discord: { kind: 'exe', target: 'discord', label: 'Discord' },
  steam: { kind: 'exe', target: 'steam', label: 'Steam' },
  code: { kind: 'exe', target: 'code', label: 'VS Code' },
  'vs code': { kind: 'exe', target: 'code', label: 'VS Code' },
  vscode: { kind: 'exe', target: 'code', label: 'VS Code' },
  // Sites
  youtube: { kind: 'url', target: 'https://youtube.com', label: 'YouTube' },
  google: { kind: 'url', target: 'https://google.com', label: 'Google' },
  gmail: { kind: 'url', target: 'https://mail.google.com', label: 'Gmail' },
  github: { kind: 'url', target: 'https://github.com', label: 'GitHub' },
  chatgpt: { kind: 'url', target: 'https://chatgpt.com', label: 'ChatGPT' },
  whatsapp: { kind: 'url', target: 'https://web.whatsapp.com', label: 'WhatsApp' },
  maps: { kind: 'url', target: 'https://maps.google.com', label: 'Maps' },
}

/** Whitelist lookup only. Unknown names are refused, never guessed into a shell. */
function resolveApp(nameRaw: unknown): AppTarget | null {
  if (typeof nameRaw !== 'string') return null
  const name = nameRaw.toLowerCase().trim().replace(/^(open|launch|start)\s+/, '')
  if (!name) return null
  if (APP_ALIASES[name]) return APP_ALIASES[name]

  // A bare domain the user asked for ("open reddit.com") is safe to open as a
  // URL — still not a command.
  if (/^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(name)) {
    return { kind: 'url', target: `https://${name}`, label: name }
  }
  return null
}

function openApp(nameRaw: unknown): { ok: boolean; label?: string; error?: string } {
  const hit = resolveApp(nameRaw)
  if (!hit) return { ok: false, error: 'unknown' }
  try {
    if (hit.kind === 'url') {
      void shell.openExternal(hit.target)
    } else {
      // `target` comes from OUR table, never from the model.
      spawn('cmd', ['/c', 'start', '', hit.target], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref()
    }
    return { ok: true, label: hit.label }
  } catch {
    return { ok: false, error: 'launch-failed' }
  }
}

// --- Cleanup ----------------------------------------------------------
//
// The other half of system awareness: Senti already tells you the disk is full
// and what's eating it — this lets it actually fix that. Only temp directories,
// the same thing Windows Disk Cleanup targets.
//
// Safety: every path is checked to be inside a directory whose name contains
// "temp" before a single file is touched, symlinks are never followed, and any
// file in use is skipped rather than forced.

const MAX_CLEAN_MS = 20_000

function cleanTempDirs(): { freedMB: number; files: number } {
  const targets = [os.tmpdir(), path.join(process.env.SystemRoot || 'C:\\Windows', 'Temp')]
  const started = Date.now()
  let freedBytes = 0
  let files = 0

  const walk = (dir: string, depth: number): void => {
    if (depth > 6 || Date.now() - started > MAX_CLEAN_MS) return
    // Hard guard: never delete outside a temp directory.
    if (!/temp/i.test(dir)) return

    let entries: import('fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (Date.now() - started > MAX_CLEAN_MS) return
      const full = path.join(dir, entry.name)
      try {
        if (entry.isSymbolicLink()) continue // never follow links out of temp
        if (entry.isDirectory()) {
          walk(full, depth + 1)
          try {
            rmdirSync(full) // only succeeds once it's empty
          } catch {
            // still has locked contents — fine
          }
        } else if (entry.isFile()) {
          const size = statSync(full).size
          unlinkSync(full)
          freedBytes += size
          files++
        }
      } catch {
        // In use or protected — skip it. Never force.
      }
    }
  }

  for (const t of targets) walk(t, 0)
  return { freedMB: Math.round(freedBytes / 1024 / 1024), files }
}

/** Lock the workstation — the real Windows lock, not our window. */
function lockWorkstation(): boolean {
  try {
    spawn('rundll32.exe', ['user32.dll,LockWorkStation'], { detached: true, stdio: 'ignore' }).unref()
    return true
  } catch {
    return false
  }
}

/** Volume via media-key virtual codes: simple, no extra dependency. */
function changeVolume(direction: 'up' | 'down' | 'mute'): boolean {
  const key = direction === 'up' ? 175 : direction === 'down' ? 174 : 173
  const repeat = direction === 'mute' ? 1 : 5 // ~10% per step
  const ps = `$w = New-Object -ComObject WScript.Shell; 1..${repeat} | ForEach-Object { $w.SendKeys([char]${key}) }`
  try {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      timeout: 4000,
      windowsHide: true,
    })
    return true
  } catch {
    return false
  }
}

/** Close an app — whitelisted process names only, never arbitrary input. */
const CLOSABLE: Record<string, { proc: string; label: string }> = {
  chrome: { proc: 'chrome.exe', label: 'Chrome' },
  edge: { proc: 'msedge.exe', label: 'Edge' },
  firefox: { proc: 'firefox.exe', label: 'Firefox' },
  notepad: { proc: 'notepad.exe', label: 'Notepad' },
  spotify: { proc: 'Spotify.exe', label: 'Spotify' },
  discord: { proc: 'Discord.exe', label: 'Discord' },
  steam: { proc: 'steam.exe', label: 'Steam' },
  calculator: { proc: 'CalculatorApp.exe', label: 'Calculator' },
  paint: { proc: 'mspaint.exe', label: 'Paint' },
}

function closeApp(nameRaw: unknown): { ok: boolean; label?: string; error?: string } {
  if (typeof nameRaw !== 'string') return { ok: false, error: 'unknown' }
  const hit = CLOSABLE[nameRaw.toLowerCase().trim()]
  if (!hit) return { ok: false, error: 'unknown' }
  try {
    // /IM takes a value from OUR table; the model's text never reaches a shell.
    spawn('taskkill', ['/IM', hit.proc, '/F'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    return { ok: true, label: hit.label }
  } catch {
    return { ok: false, error: 'failed' }
  }
}

async function systemSnapshot(): Promise<SystemSnapshot> {
  if (sysCache && Date.now() - sysCache.at < SYS_CACHE_MS) return sysCache.data
  const base = basicSystem()
  let extra: Partial<SystemSnapshot> = {}
  if (process.platform === 'win32') {
    try {
      extra = await windowsDetail()
    } catch {
      // Fall back to the os-module basics.
    }
  }
  const data = { ...base, ...extra }
  sysCache = { at: Date.now(), data }
  return data
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


function unregisterLockShortcuts(): void {
  for (const accel of LOCK_SHORTCUTS) {
    try {
      if (globalShortcut.isRegistered(accel)) globalShortcut.unregister(accel)
    } catch {
      // ignore
    }
  }
}

/**
 * Senti is NOT a lock screen.
 *
 * It used to hold the machine hostage: fullscreen on every monitor, swallowing
 * Alt+Tab, blocking close, forcing focus. That framing is gone. All this tracks
 * now is whether you've signed in yet, so Senti knows it's really you before it
 * acts. It never blanks your screens and never traps you.
 */
function setLocked(locked: boolean): void {
  isLocked = locked
  unregisterLockShortcuts()

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
    transparent: true,
    backgroundColor: '#00000000',
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

  // Senti is not a lock screen: it never steals focus back, never refuses to
  // minimise, and never forces itself fullscreen. Closing the window just
  // sends it to the tray — it keeps listening. Only Quit actually exits.
  mainWindow.on('close', (event: any) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
}

// (The old enforceFocus loop — which yanked focus back every 500ms and forced
// fullscreen — is gone. Senti no longer fights you for your own screen.)

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

  // A monitor plugged in (or unplugged) while locked must not open a hole.
  // (No display listeners any more — Senti never blanks your other monitors.)

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
  // Senti lives in the tray and keeps listening; it does not exit with its
  // window. Quitting happens from the tray menu (which sets `quitting`).
  if (quitting && process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  quitting = true
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

// Real machine vitals, so the assistant can answer about THIS computer.
ipcMain.handle('senti:system-info', () => systemSnapshot())

// OS actions. Each is whitelisted or scoped in main; the renderer (and the
// model behind it) can only ask, never dictate a command.
ipcMain.handle('senti:open-app', (_e: unknown, name: unknown) => openApp(name))
ipcMain.handle('senti:close-app', (_e: unknown, name: unknown) => closeApp(name))
ipcMain.handle('senti:clean-temp', () => cleanTempDirs())
ipcMain.handle('senti:lock-workstation', () => lockWorkstation())
ipcMain.handle('senti:volume', (_e: unknown, dir: unknown) => {
  const d = dir === 'up' || dir === 'down' || dir === 'mute' ? dir : null
  return d ? changeVolume(d) : false
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

// --- Window modes + tray ---------------------------------------------
//
// Senti has to keep running after you unlock, or it can't hear you. So the
// window is never destroyed — it becomes a small HUD that stays hidden until
// the wake word fires, and the app lives in the tray.

type WindowMode = 'signin' | 'setup' | 'hud'
let windowMode: WindowMode = 'signin'
let tray: InstanceType<typeof Tray> | null = null
let quitting = false

// Square, so the floating orb has room to breathe.
const HUD_W = 400
const HUD_H = 400

/** Centre the orb, slightly above middle — where your eyes already are. */
function positionHud(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { workArea } = screen.getPrimaryDisplay()
  mainWindow.setBounds({
    x: Math.round(workArea.x + (workArea.width - HUD_W) / 2),
    y: Math.round(workArea.y + (workArea.height - HUD_H) / 2 - workArea.height * 0.06),
    width: HUD_W,
    height: HUD_H,
  })
}

function setWindowMode(mode: WindowMode): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  windowMode = mode

  if (mode === 'hud') {
    // Small, frameless, out of the way — and hidden until Senti is spoken to.
    setLocked(false)
    mainWindow.setFullScreen(false)
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(true)
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    positionHud()
    mainWindow.hide()
  } else if (mode === 'setup') {
    setLocked(false)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setSize(980, 760)
    mainWindow.center()
    mainWindow.show()
  } else {
    // Sign-in: a normal window you can move, minimise or Alt+Tab away from.
    // Shown once when Senti starts, then it goes to the tray. Not a lock.
    setLocked(true)
    mainWindow.setFullScreen(false)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setSize(680, 780)
    mainWindow.center()
    mainWindow.show()
    mainWindow.focus()
  }
}

/** Bring the HUD up (without stealing focus from what you're doing). */
function showHud(): void {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'hud') return
  positionHud()
  mainWindow.showInactive()
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
}

function hideHud(): void {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'hud') return
  mainWindow.hide()
}

function trayIcon(): Electron.NativeImage {
  const candidates = [
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        const img = nativeImage.createFromPath(p)
        if (!img.isEmpty()) return img.resize({ width: 16, height: 16 })
      }
    } catch {
      // try the next one
    }
  }
  return nativeImage.createEmpty()
}

function buildTray(): void {
  if (tray) return
  try {
    tray = new Tray(trayIcon())
    tray.setToolTip('Senti — listening for you')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Sign in again', click: () => setWindowMode('signin') },
        { label: 'Show Senti', click: () => showHud() },
        { type: 'separator' },
        {
          label: 'Quit Senti',
          click: () => {
            quitting = true
            app.quit()
          },
        },
      ])
    )
    tray.on('click', () => showHud())
  } catch {
    // A missing tray shouldn't stop Senti from running.
  }
}

/**
 * Setup mode: a normal, resizable window instead of a fullscreen lock.
 *
 * First-time setup is not a lock — it's a form. Forcing it fullscreen and
 * swallowing Alt+Tab makes a new user feel trapped before they've even
 * linked their account. So the renderer tells us when it's in setup, and we
 * behave like an ordinary app until they're done.
 */
function setSetupMode(inSetup: boolean): void {
  // Superseded by setWindowMode. Kept so the older renderer call still works,
  // and deliberately no longer forces fullscreen.
  setWindowMode(inSetup ? 'setup' : 'signin')
}

ipcMain.handle('senti:set-setup-mode', (_e: unknown, inSetup: unknown) => {
  setSetupMode(!!inSetup)
  return true
})

// Background operation: after unlock Senti becomes a hidden HUD in the tray so
// it can keep listening. The renderer drives these.
ipcMain.handle('senti:set-window-mode', (_e: unknown, mode: unknown) => {
  if (mode === 'signin' || mode === 'setup' || mode === 'hud') {
    setWindowMode(mode)
    if (mode === 'hud') buildTray()
    return true
  }
  return false
})
ipcMain.handle('senti:hud-show', () => {
  showHud()
  return true
})
ipcMain.handle('senti:hud-hide', () => {
  hideHud()
  return true
})

/** "Sign in again" — shows the normal sign-in window, never a fullscreen lock. */
ipcMain.handle('senti:lock', () => {
  setWindowMode('signin')
})

ipcMain.handle('senti:quit', () => {
  // Quitting is only permitted once unlocked; while locked, exiting the
  // app must go through authentication (or the recovery hatch).
  if (isLocked) return false
  app.quit()
  return true
})