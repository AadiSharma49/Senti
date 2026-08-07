import {
  existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync,
  readdirSync, statSync, rmdirSync,
} from 'fs'
import { execFile, execFileSync, spawn } from 'child_process'
import http from 'http'
import os from 'os'
import electron from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
const { app, BrowserWindow, screen, ipcMain, globalShortcut, safeStorage, session, shell, Tray, Menu, nativeImage, powerSaveBlocker, desktopCapturer, clipboard } = electron
import path from 'path'
import { fileURLToPath } from 'url'
import { resolveInside } from './pathSafety'

// WebSocket server for the VS Code extension (code bridge).
// Dynamic import so the desktop app can run without ws installed.
let codeBridgeWss: any = null
let codeBridgeClient: any = null

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

function firstExisting(paths: string[]): string | null {
  for (const p of paths) {
    try {
      if (p && existsSync(p)) return p
    } catch {
      // Keep trying fallbacks.
    }
  }
  return null
}

function powershellPath(): string | null {
  if (process.platform !== 'win32') return null
  const windir = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
  const system32 = path.join(windir, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const sysnative = path.join(windir, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  return firstExisting([system32, sysnative, 'powershell.exe'])
}

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

// --- Senti's memory ---------------------------------------------------
//
// The facts Senti keeps about you, so it stops asking twice and can act on
// what it already knows: "my main drive is D", "I hate auto-start apps", your
// name. Plain text in a local file — no API, no cloud, no embeddings service.
// The model decides what is worth keeping (the `remember` tool) and the file
// is read back into every conversation as context. Yours to see and wipe in
// the Control Center.
export interface Memory {
  id: string
  text: string
  createdAt: number
}

const MEMORY_CAP = 200
const memoryFile = () => path.join(app.getPath('userData'), 'memories.json')

function loadMemories(): Memory[] {
  try {
    if (!existsSync(memoryFile())) return []
    const parsed = JSON.parse(readFileSync(memoryFile(), 'utf8'))
    return Array.isArray(parsed) ? parsed.filter((m) => m && typeof m.text === 'string') : []
  } catch {
    return []
  }
}

function saveMemories(list: Memory[]): void {
  try {
    mkdirSync(path.dirname(memoryFile()), { recursive: true })
    writeFileSync(memoryFile(), JSON.stringify(list.slice(-MEMORY_CAP)))
  } catch {
    // ignore
  }
}

// --- Activity journal -------------------------------------------------
//
// How Senti comes to know you without being told: a rolling, AGGREGATED
// record of which apps you use, when, and for how long. "VS Code, 4.2 hours,
// mostly evenings" — not a transcript of your day.
//
// Aggregation is the privacy design, not a shortcut. Storing every window
// title with a timestamp would be a surveillance log of everything you opened,
// which is exactly what this must never be. Buckets are per app, per day, per
// rough time-of-day, and old days are dropped entirely.
//
// This file never leaves the machine. Only the short summary Senti reflects on
// (see `remember`) is ever sent anywhere.
export interface ActivityBucket {
  /** YYYY-MM-DD */
  day: string
  process: string
  /** morning | afternoon | evening | night */
  part: string
  minutes: number
  /** A few representative titles, for flavour — capped hard. */
  samples: string[]
}

const JOURNAL_DAYS = 21
const MAX_SAMPLES = 3
const journalFile = () => path.join(app.getPath('userData'), 'activity.json')

function loadJournal(): ActivityBucket[] {
  try {
    if (!existsSync(journalFile())) return []
    const parsed = JSON.parse(readFileSync(journalFile(), 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveJournal(list: ActivityBucket[]): void {
  try {
    mkdirSync(path.dirname(journalFile()), { recursive: true })
    writeFileSync(journalFile(), JSON.stringify(list))
  } catch {
    // ignore
  }
}

function partOfDay(d: Date): string {
  const h = d.getHours()
  if (h < 6) return 'night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

/** Fold one observation into the aggregate, and prune anything old. */
function recordActivity(processRaw: unknown, titleRaw: unknown, minutesRaw: unknown): ActivityBucket[] {
  const process = String(processRaw ?? '').slice(0, 60).toLowerCase()
  const title = String(titleRaw ?? '').slice(0, 120)
  const minutes = Math.max(0, Math.min(120, Number(minutesRaw) || 0))
  if (!process || !minutes) return loadJournal()

  const now = new Date()
  const day = now.toISOString().slice(0, 10)
  const part = partOfDay(now)

  const cutoff = new Date(now.getTime() - JOURNAL_DAYS * 86_400_000).toISOString().slice(0, 10)
  const list = loadJournal().filter((b) => b.day >= cutoff)

  let bucket = list.find((b) => b.day === day && b.process === process && b.part === part)
  if (!bucket) {
    bucket = { day, process, part, minutes: 0, samples: [] }
    list.push(bucket)
  }
  bucket.minutes = Math.round((bucket.minutes + minutes) * 10) / 10
  if (title && !bucket.samples.includes(title) && bucket.samples.length < MAX_SAMPLES) {
    bucket.samples.push(title)
  }

  saveJournal(list)
  return list
}

/** Add a fact, skipping near-duplicates. Returns the updated list. */
function addMemory(textRaw: string): Memory[] {
  const text = String(textRaw || '').trim().slice(0, 300)
  if (!text) return loadMemories()
  const list = loadMemories()
  const norm = text.toLowerCase().replace(/\s+/g, ' ')
  if (list.some((m) => m.text.toLowerCase().replace(/\s+/g, ' ') === norm)) return list
  list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, createdAt: Date.now() })
  const trimmed = list.slice(-MEMORY_CAP)
  saveMemories(trimmed)
  return trimmed
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
  const psExe = powershellPath()
  if (!psExe) return Promise.resolve({})
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
      psExe,
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

// --- Installed-app discovery ------------------------------------------
//
// The whitelist covers the common apps, but you also want "open Spider-Man" or
// "open Rockstar" to just work. So we scan the Start Menu for whatever is
// ACTUALLY installed and match the spoken name against it. This is still just
// launching a real shortcut Windows already created — never an arbitrary
// command the model made up.
interface InstalledApp {
  name: string
  path: string
}
let installedCache: InstalledApp[] | null = null
let installedScannedAt = 0
const APP_STOPWORDS = new Set([
  'game', 'games', 'app', 'application', 'launcher', 'the', 'my', 'a', 'open',
  'launch', 'start', 'play', 'run', 'up',
])

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** The Start Menu folders where Windows keeps every installed app's shortcut. */
function startMenuDirs(): string[] {
  const dirs: string[] = []
  if (process.env.ProgramData)
    dirs.push(path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  if (process.env.APPDATA)
    dirs.push(path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  return dirs
}

/** Every .lnk in the Start Menu = an installed app. Cached for 5 minutes. */
function scanInstalledApps(): InstalledApp[] {
  const now = Date.now()
  if (installedCache && now - installedScannedAt < 5 * 60_000) return installedCache
  const found: InstalledApp[] = []
  const started = now
  const walk = (dir: string, depth: number): void => {
    if (depth > 4 || Date.now() - started > 4000) return
    let entries: import('fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full, depth + 1)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.lnk')) found.push({ name: e.name.slice(0, -4), path: full })
    }
  }
  for (const d of startMenuDirs()) walk(d, 0)
  installedCache = found
  installedScannedAt = now
  return found
}

/** Match a spoken name ("spider man", "rockstar") to a real installed app. */
function resolveInstalledApp(nameRaw: unknown): InstalledApp | null {
  if (typeof nameRaw !== 'string') return null
  const query = nameRaw.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, '').trim()
  const qNorm = norm(query)
  const qTokens = query.split(/\s+/).map(norm).filter((t) => t.length >= 2 && !APP_STOPWORDS.has(t))
  if (!qNorm && !qTokens.length) return null

  let best: { app: InstalledApp; score: number } | null = null
  for (const app of scanInstalledApps()) {
    const nNorm = norm(app.name)
    let score = 0
    if (nNorm === qNorm) score = 100
    else if (qNorm.length >= 3 && nNorm.includes(qNorm)) score = 60 - Math.min(25, nNorm.length - qNorm.length)
    else {
      let hits = 0
      for (const t of qTokens) if (t.length >= 3 && nNorm.includes(t)) hits++
      if (hits) score = 20 + hits * 12 - Math.min(15, Math.floor(nNorm.length / 6))
    }
    if (score > 0 && (!best || score > best.score)) best = { app, score }
  }
  return best && best.score >= 20 ? best.app : null
}

async function openApp(nameRaw: unknown): Promise<{ ok: boolean; label?: string; focused?: boolean; error?: string }> {
  const hit = resolveApp(nameRaw)
  if (hit) {
    try {
      if (hit.kind === 'url') {
        void shell.openExternal(hit.target)
        return { ok: true, label: hit.label }
      }

      // Already running? Switch to it. "Open VS Code" when VS Code is open
      // means "show me VS Code", never "give me a second copy".
      if (await focusApp(hit.label, hit.target)) {
        return { ok: true, label: hit.label, focused: true }
      }

      // Prefer the real Start Menu shortcut over the bare command name.
      //
      // Several tools put a .cmd SHIM on PATH rather than the executable —
      // `code` is the notorious one — and launching that through `cmd /c
      // start` leaves a console window sitting on screen next to the app.
      // The shortcut points at the actual .exe, so nothing extra opens.
      const viaShortcut = resolveInstalledApp(hit.label) || resolveInstalledApp(hit.target)
      if (viaShortcut) {
        void shell.openPath(viaShortcut.path)
        return { ok: true, label: hit.label }
      }

      // `target` comes from OUR table, never from the model.
      spawn('cmd', ['/c', 'start', '', hit.target], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
      return { ok: true, label: hit.label }
    } catch {
      return { ok: false, error: 'launch-failed' }
    }
  }

  // Not in the curated list — try whatever is actually installed (games too).
  const installed = resolveInstalledApp(nameRaw)
  if (installed) {
    try {
      void shell.openPath(installed.path)
      return { ok: true, label: installed.name }
    } catch {
      return { ok: false, error: 'launch-failed' }
    }
  }

  return { ok: false, error: 'unknown' }
}

/**
 * Bring an already-running app to the front instead of starting another copy.
 *
 * "Open VS Code" when VS Code is already open should switch to it — launching
 * a second window is never what someone means. Windows guards
 * SetForegroundWindow against apps stealing focus, so we nudge it with a
 * synthetic ALT press, which is the long-standing way to satisfy that check.
 */
const FOCUS_PS = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SentiFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
}
"@
$p = $null
foreach ($n in $names) {
  $p = Get-Process -Name $n | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p) { break }
}
if (-not $p) { Write-Output 'no'; exit }
$h = $p.MainWindowHandle
if ([SentiFocus]::IsIconic($h)) { [void][SentiFocus]::ShowWindow($h, 9) }
[SentiFocus]::keybd_event(0x12, 0, 0, [IntPtr]::Zero)
[void][SentiFocus]::SetForegroundWindow($h)
[SentiFocus]::keybd_event(0x12, 0, 2, [IntPtr]::Zero)
Write-Output 'yes'
`

/** Process names to look for, per app. Several apps run under another name. */
const FOCUS_NAMES: Record<string, string[]> = {
  'VS Code': ['Code'],
  Chrome: ['chrome'],
  Edge: ['msedge'],
  Firefox: ['firefox'],
  Spotify: ['Spotify'],
  Discord: ['Discord'],
  Steam: ['steam'],
  Notepad: ['notepad'],
  'File Explorer': ['explorer'],
  'Task Manager': ['Taskmgr'],
  Terminal: ['WindowsTerminal', 'wt'],
  Paint: ['mspaint'],
  Calculator: ['CalculatorApp', 'Calculator'],
}

function focusApp(label: string, target: string): Promise<boolean> {
  const psExe = powershellPath()
  if (!psExe) return Promise.resolve(false)
  // Names come from our own tables, but they're being spliced into a script,
  // so strip anything that isn't a plain process name regardless.
  const names = (FOCUS_NAMES[label] ?? [target.replace(/\.exe$/i, '')])
    .map((n) => n.replace(/[^A-Za-z0-9_.-]/g, ''))
    .filter(Boolean)
  if (!names.length) return Promise.resolve(false)

  const prelude = `$names = @(${names.map((n) => `'${n}'`).join(',')})\n`
  return new Promise((resolve) => {
    try {
      execFile(
        psExe,
        ['-NoProfile', '-NonInteractive', '-Command', prelude + FOCUS_PS],
        { timeout: 6000, windowsHide: true },
        (err, stdout) => resolve(!err && String(stdout).trim() === 'yes')
      )
    } catch {
      resolve(false)
    }
  })
}

// --- Files & folders --------------------------------------------------
//
// "Open my downloads", "show me my documents", "find that invoice". Senti
// resolves a spoken place-name to a REAL folder on this machine and opens it
// in Explorer — it never builds a path out of the model's words, so there is
// nothing to inject.

/** Spoken folder names → the real path, resolved from the OS at call time. */
function resolveFolder(nameRaw: unknown): { path?: string; shell?: string; label: string } | null {
  if (typeof nameRaw !== 'string') return null
  const name = nameRaw
    .toLowerCase()
    .trim()
    .replace(/^(open|show|go to|reveal)\s+/, '')
    .replace(/^(my|the)\s+/, '')
    .replace(/\s+(folder|directory)$/, '')
    .trim()

  // Special shell locations that aren't plain paths.
  const special: Record<string, { shell: string; label: string }> = {
    temp: { shell: os.tmpdir(), label: 'your Temp folder' },
    'temp files': { shell: os.tmpdir(), label: 'your Temp folder' },
    'temporary files': { shell: os.tmpdir(), label: 'your Temp folder' },
    'recycle bin': { shell: 'shell:RecycleBinFolder', label: 'Recycle Bin' },
    trash: { shell: 'shell:RecycleBinFolder', label: 'Recycle Bin' },
    'this pc': { shell: 'shell:MyComputerFolder', label: 'This PC' },
    'my computer': { shell: 'shell:MyComputerFolder', label: 'This PC' },
    computer: { shell: 'shell:MyComputerFolder', label: 'This PC' },
  }
  if (special[name]) return special[name]

  // Real user folders, resolved live from the OS (never a hardcoded C:\Users).
  const known: Record<string, { key: Parameters<typeof app.getPath>[0]; label: string }> = {
    documents: { key: 'documents', label: 'Documents' },
    docs: { key: 'documents', label: 'Documents' },
    downloads: { key: 'downloads', label: 'Downloads' },
    download: { key: 'downloads', label: 'Downloads' },
    desktop: { key: 'desktop', label: 'Desktop' },
    pictures: { key: 'pictures', label: 'Pictures' },
    photos: { key: 'pictures', label: 'Pictures' },
    images: { key: 'pictures', label: 'Pictures' },
    music: { key: 'music', label: 'Music' },
    videos: { key: 'videos', label: 'Videos' },
    movies: { key: 'videos', label: 'Videos' },
    home: { key: 'home', label: 'your home folder' },
    user: { key: 'home', label: 'your home folder' },
  }
  const hit = known[name]
  if (hit) {
    try {
      return { path: app.getPath(hit.key), label: hit.label }
    } catch {
      return null
    }
  }
  return null
}

function openFolder(nameRaw: unknown): { ok: boolean; label?: string; error?: string } {
  const hit = resolveFolder(nameRaw)
  if (!hit) return { ok: false, error: 'unknown' }
  try {
    if (hit.shell) {
      spawn('explorer.exe', [hit.shell], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    } else if (hit.path) {
      void shell.openPath(hit.path)
    }
    return { ok: true, label: hit.label }
  } catch {
    return { ok: false, error: 'launch-failed' }
  }
}

// --- Serving files to your other devices ------------------------------
//
// Answering "list my Documents" / "send me that PDF" from the laptop.
//
// The whole risk here is path traversal: a caller that can name any path can
// read your entire drive. So the caller never sends a path. It sends a ROOT
// KEY ('documents') plus a relative path, we resolve the root ourselves, join,
// and then verify the result is still INSIDE that root — a relative path full
// of `..` resolves out of the folder, and this is what catches it.
const FILE_ROOTS: Record<string, Parameters<typeof app.getPath>[0]> = {
  desktop: 'desktop',
  documents: 'documents',
  downloads: 'downloads',
  pictures: 'pictures',
  videos: 'videos',
  music: 'music',
}
/** ~15 MB. Bigger files need chunking, which this deliberately doesn't do yet. */
const MAX_SERVE_BYTES = 15 * 1024 * 1024

function safeResolve(rootKey: string, relPath: string): { base: string; full: string } | null {
  const key = FILE_ROOTS[rootKey]
  if (!key) return null
  let base: string
  try {
    base = app.getPath(key)
  } catch {
    return null
  }
  // The containment check lives in pathSafety.ts so it can be unit-tested
  // without Electron — see the note there on why that matters.
  const full = resolveInside(base, relPath)
  return full ? { base, full } : null
}

function listRemoteFolder(rootKey: string, relPath: string): string {
  const r = safeResolve(rootKey, relPath)
  if (!r) throw new Error('Not allowed')
  const entries = readdirSync(r.full, { withFileTypes: true })
  const items = entries
    .filter((e) => !e.name.startsWith('.'))
    .slice(0, 500)
    .map((e) => {
      let size = 0
      let modified = 0
      try {
        const st = statSync(path.join(r.full, e.name))
        size = st.size
        modified = st.mtimeMs
      } catch {
        // unreadable entry — still list it, just without details
      }
      return { name: e.name, dir: e.isDirectory(), size, modified }
    })
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  return JSON.stringify({ root: rootKey, relPath, items })
}

function readRemoteFile(rootKey: string, relPath: string): string {
  const r = safeResolve(rootKey, relPath)
  if (!r) throw new Error('Not allowed')
  const st = statSync(r.full)
  if (!st.isFile()) throw new Error('Not a file')
  if (st.size > MAX_SERVE_BYTES) throw new Error('File is too large to send (15 MB limit)')
  const data = readFileSync(r.full)
  return JSON.stringify({
    name: path.basename(r.full),
    size: st.size,
    base64: data.toString('base64'),
  })
}

/**
 * Find a file by name across your real folders and open the best match with
 * its default app. The search reads filenames off disk and only ever opens a
 * path it actually found — the model's words are used to FILTER, never to
 * build a path or a command.
 */
const FIND_MAX_MS = 8_000
const FIND_MAX_HITS = 40

function openFile(queryRaw: unknown): { ok: boolean; label?: string; count?: number; error?: string } {
  const q = String(queryRaw ?? '').toLowerCase().trim()
  if (!q) return { ok: false, error: 'empty' }

  const roots = (['desktop', 'documents', 'downloads', 'pictures', 'videos', 'music'] as const)
    .map((k) => {
      try {
        return app.getPath(k)
      } catch {
        return null
      }
    })
    .filter((p): p is string => !!p)

  const started = Date.now()
  const skip = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i
  const hits: { name: string; path: string }[] = []

  const walk = (dir: string, depth: number): void => {
    if (depth > 4 || Date.now() - started > FIND_MAX_MS || hits.length >= FIND_MAX_HITS) return
    let entries: import('fs').Dirent[]
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (Date.now() - started > FIND_MAX_MS || hits.length >= FIND_MAX_HITS) return
      if (e.name.startsWith('.') || skip.test(e.name)) continue
      const full = path.join(dir, e.name)
      try {
        if (e.isSymbolicLink()) continue
        if (e.isDirectory()) walk(full, depth + 1)
        else if (e.isFile() && e.name.toLowerCase().includes(q)) hits.push({ name: e.name, path: full })
      } catch {
        // unreadable — skip
      }
    }
  }
  for (const r of roots) walk(r, 0)

  if (hits.length === 0) return { ok: false, error: 'not-found', count: 0 }

  // Rank: exact name (minus extension) first, then shortest name (closest match).
  hits.sort((a, b) => {
    const an = a.name.toLowerCase()
    const bn = b.name.toLowerCase()
    const aExact = an === q || an.replace(/\.[^.]+$/, '') === q
    const bExact = bn === q || bn.replace(/\.[^.]+$/, '') === q
    if (aExact !== bExact) return aExact ? -1 : 1
    return a.name.length - b.name.length
  })

  try {
    void shell.openPath(hits[0].path)
    return { ok: true, label: hits[0].name, count: hits.length }
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

/**
 * Empty the Windows Recycle Bin — for real, on all drives.
 *
 * It counts what's in there first (via the Shell namespace) so Senti can tell
 * you exactly what it removed — "42 items, 1.3 GB" — instead of a vague "done".
 * Clear-RecycleBin runs with -Force so it never stops on a confirmation prompt.
 * Unlike the temp sweep this is genuinely destructive: these are files you
 * already chose to delete, but it is gated behind the Cleanup permission all
 * the same, and it only ever empties the bin — it can touch nothing else.
 */
function emptyRecycleBin(): { freedMB: number; files: number } {
  const psExe = powershellPath()
  if (!psExe) return { freedMB: 0, files: 0 }
  const ps = [
    "$ErrorActionPreference='SilentlyContinue'",
    '$sh = New-Object -ComObject Shell.Application',
    '$bin = $sh.NameSpace(10)', // 0xA = ssfBITBUCKET
    '$count = 0; $bytes = 0',
    'foreach ($i in @($bin.Items())) {',
    '  $count++',
    "  $s = $i.ExtendedProperty('Size'); if (-not $s) { $s = $i.Size }",
    '  if ($s) { $bytes += [int64]$s }',
    '}',
    'Clear-RecycleBin -Force -ErrorAction SilentlyContinue',
    "Write-Output ('{0} {1}' -f $count, $bytes)",
  ].join('; ')

  try {
    const out = execFileSync(psExe, ['-NoProfile', '-NonInteractive', '-Command', ps], {
      timeout: 30_000,
      windowsHide: true,
      encoding: 'utf8',
    })
    const line = (out || '').trim().split(/\r?\n/).pop() || ''
    const [files, bytes] = line.split(/\s+/).map((n) => parseInt(n, 10))
    return {
      files: Number.isFinite(files) ? files : 0,
      freedMB: Number.isFinite(bytes) ? Math.round(bytes / 1024 / 1024) : 0,
    }
  } catch {
    return { freedMB: 0, files: 0 }
  }
}

// --- What you're doing right now --------------------------------------
//
// The foreground window's title and process — "Marvel's Spider-Man",
// "main.ts - Senti - Visual Studio Code", "Some Video - YouTube - Chrome".
//
// This is deliberately the TITLE BAR and nothing else. Senti does not read
// your screen: it can tell you're in VS Code, or which video is playing,
// because Windows already puts that in the title. Reading screen CONTENT
// would be a different thing entirely — that's surveillance, and it isn't
// built. Everything here stays on the machine and is never uploaded raw.
const ACTIVE_WINDOW_PS = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SentiWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
}
"@
$h = [SentiWin]::GetForegroundWindow()
$sb = New-Object Text.StringBuilder 512
[void][SentiWin]::GetWindowText($h, $sb, 512)
$pid2 = 0
[void][SentiWin]::GetWindowThreadProcessId($h, [ref]$pid2)
$proc = (Get-Process -Id $pid2).ProcessName
[Console]::Out.Write((ConvertTo-Json @{ title = $sb.ToString(); process = $proc } -Compress))
`

function activeWindow(): Promise<{ title: string; process: string } | null> {
  const psExe = powershellPath()
  if (!psExe) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      execFile(
        psExe,
        ['-NoProfile', '-NonInteractive', '-Command', ACTIVE_WINDOW_PS],
        { timeout: 5000, windowsHide: true },
        (err, stdout) => {
          if (err || !stdout) return resolve(null)
          try {
            const parsed = JSON.parse(stdout.trim())
            const title = String(parsed.title || '').slice(0, 200)
            const proc = String(parsed.process || '').slice(0, 60)
            resolve(title || proc ? { title, process: proc } : null)
          } catch {
            resolve(null)
          }
        }
      )
    } catch {
      resolve(null)
    }
  })
}

// --- Remote input injection -------------------------------------------
//
// Driving this machine from another one: real mouse moves, clicks, scrolls and
// keystrokes delivered to Windows itself.
//
// Done through ONE long-lived PowerShell process reading commands on stdin.
// Two reasons: spawning a process per event would add ~200ms to every mouse
// move (unusable), and the alternative — a native input module — needs a
// per-Electron-version rebuild that breaks on upgrade. This needs neither.
//
// Positions arrive NORMALIZED (0..1) and go out as MOUSEEVENTF_ABSOLUTE, whose
// 0..65535 coordinate space is DPI-independent. That sidesteps display-scaling
// maths entirely, which is where this kind of code usually goes wrong.
const INPUT_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SentiIn {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);
}
"@
$MOVE=0x0001; $ABS=0x8000; $LD=0x0002; $LU=0x0004; $RD=0x0008; $RU=0x0010
$MD=0x0020; $MU=0x0040; $WHEEL=0x0800; $HWHEEL=0x01000; $KEYUP=0x0002

function Send-Key([byte]$vk, [int]$shiftState) {
  if ($shiftState -band 1) { [SentiIn]::keybd_event(0x10,0,0,[IntPtr]::Zero) }
  if ($shiftState -band 2) { [SentiIn]::keybd_event(0x11,0,0,[IntPtr]::Zero) }
  if ($shiftState -band 4) { [SentiIn]::keybd_event(0x12,0,0,[IntPtr]::Zero) }
  [SentiIn]::keybd_event($vk,0,0,[IntPtr]::Zero)
  [SentiIn]::keybd_event($vk,0,$KEYUP,[IntPtr]::Zero)
  if ($shiftState -band 4) { [SentiIn]::keybd_event(0x12,0,$KEYUP,[IntPtr]::Zero) }
  if ($shiftState -band 2) { [SentiIn]::keybd_event(0x11,0,$KEYUP,[IntPtr]::Zero) }
  if ($shiftState -band 1) { [SentiIn]::keybd_event(0x10,0,$KEYUP,[IntPtr]::Zero) }
}

function Key-Down([byte]$vk) { [SentiIn]::keybd_event($vk,0,0,[IntPtr]::Zero) }
function Key-Up([byte]$vk)   { [SentiIn]::keybd_event($vk,0,0x0002,[IntPtr]::Zero) }

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $p = $line.Trim().Split(' ')
  switch ($p[0]) {
    'M' {
      $x = [int]([double]$p[1] * 65535); $y = [int]([double]$p[2] * 65535)
      [SentiIn]::mouse_event($MOVE -bor $ABS, $x, $y, 0, [IntPtr]::Zero)
    }
    'R' {
      [SentiIn]::mouse_event($MOVE, [int]$p[1], [int]$p[2], 0, [IntPtr]::Zero)
    }
    'C' {
      if ([double]$p[2] -ge 0) {
        $x = [int]([double]$p[2] * 65535); $y = [int]([double]$p[3] * 65535)
        [SentiIn]::mouse_event($MOVE -bor $ABS, $x, $y, 0, [IntPtr]::Zero)
      }
      $down = $LD; $up = $LU
      if ($p[1] -eq 'right') { $down = $RD; $up = $RU }
      elseif ($p[1] -eq 'middle') { $down = $MD; $up = $MU }
      $times = 1
      if ($p.Length -gt 4 -and $p[4] -eq '2') { $times = 2 }
      for ($i = 0; $i -lt $times; $i++) {
        [SentiIn]::mouse_event($down, 0, 0, 0, [IntPtr]::Zero)
        [SentiIn]::mouse_event($up, 0, 0, 0, [IntPtr]::Zero)
      }
    }
    'S' { [SentiIn]::mouse_event($WHEEL, 0, 0, [int]$p[1], [IntPtr]::Zero) }
    'H' { [SentiIn]::mouse_event($HWHEEL, 0, 0, [int]$p[1], [IntPtr]::Zero) }
    'T' {
      $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))
      foreach ($ch in $text.ToCharArray()) {
        if ($ch -eq "\`n") { Send-Key 0x0D 0; continue }
        $scan = [SentiIn]::VkKeyScan($ch)
        if ($scan -eq -1) { continue }
        Send-Key ([byte]($scan -band 0xFF)) (($scan -shr 8) -band 0xFF)
      }
    }
    'D' {
      $vk = [byte]([Convert]::ToInt32($p[1], 16))
      Key-Down $vk
    }
    'U' {
      $vk = [byte]([Convert]::ToInt32($p[1], 16))
      Key-Up $vk
    }
  }
}
`

let inputProc: import('child_process').ChildProcess | null = null

/** Start (or reuse) the injector. Returns false if PowerShell won't start. */
function ensureInputProc(): boolean {
  if (inputProc && !inputProc.killed) return true
  const psExe = powershellPath()
  if (!psExe) {
    console.error('[RemoteInput] PowerShell not found; remote control input disabled.')
    return false
  }
  try {
    const file = path.join(app.getPath('userData'), 'input.ps1')
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, INPUT_SCRIPT, 'utf8')
    inputProc = spawn(
      psExe,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
      { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true }
    )
    inputProc.on('error', (err) => {
      console.error('[RemoteInput] PowerShell injector failed:', err)
      inputProc = null
    })
    inputProc.on('exit', () => {
      inputProc = null
    })
    return true
  } catch {
    inputProc = null
    return false
  }
}

function stopInputProc(): void {
  try {
    inputProc?.kill()
  } catch {
    // already gone
  }
  inputProc = null
}

/** JS key names -> Windows virtual-key codes, for keys that aren't characters. */
const VK: Record<string, number> = {
  Backspace: 0x08, Tab: 0x09, Enter: 0x0d, Escape: 0x1b, ' ': 0x20,
  PageUp: 0x21, PageDown: 0x22, End: 0x23, Home: 0x24,
  ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
  Insert: 0x2d, Delete: 0x2e, PrintScreen: 0x2c, Pause: 0x13,
  NumLock: 0x90, CapsLock: 0x14, ScrollLock: 0x91,
  Meta: 0x5b, ContextMenu: 0x5d,
  F1: 0x70, F2: 0x71, F3: 0x72, F4: 0x73, F5: 0x74, F6: 0x75,
  F7: 0x76, F8: 0x77, F9: 0x78, F10: 0x79, F11: 0x7a, F12: 0x7b,
  Numpad0: 0x60, Numpad1: 0x61, Numpad2: 0x62, Numpad3: 0x63,
  Numpad4: 0x64, Numpad5: 0x65, Numpad6: 0x66, Numpad7: 0x67,
  Numpad8: 0x68, Numpad9: 0x69,
  NumpadMultiply: 0x6a, NumpadAdd: 0x6b, NumpadEnter: 0x0d,
  NumpadSubtract: 0x6d, NumpadDecimal: 0x6e, NumpadDivide: 0x6f,
}

interface RemoteEvent {
  t: string
  x?: number
  y?: number
  b?: string
  d?: number
  text?: string
  k?: string
  mods?: string[]
}

const clamp01 = (n: unknown): number => Math.max(0, Math.min(1, Number(n) || 0))

/** Translate one event into a line the injector understands. */
function inputLine(e: RemoteEvent): string | null {
  switch (e.t) {
    case 'move':
      return `M ${clamp01(e.x).toFixed(5)} ${clamp01(e.y).toFixed(5)}`
    case 'moverel': {
      // Deltas only. Clamped so a wild packet can't fling the cursor across
      // the desktop, which is the sort of thing that ruins a game.
      const dx = Math.max(-400, Math.min(400, Math.round(Number(e.x) || 0)))
      const dy = Math.max(-400, Math.min(400, Math.round(Number(e.y) || 0)))
      if (!dx && !dy) return null
      return `R ${dx} ${dy}`
    }
    case 'click': {
      const b = e.b === 'right' || e.b === 'middle' ? e.b : 'left'
      const times = e.d === 2 ? '2' : '1'
      // A negative x tells the host to click in place — see the script.
      if (typeof e.x !== 'number' || e.x < 0) return `C ${b} -1 -1 ${times}`
      return `C ${b} ${clamp01(e.x).toFixed(5)} ${clamp01(e.y).toFixed(5)} ${times}`
    }
    case 'scroll': {
      // Screen-pixel delta -> wheel notches, inverted to match Windows.
      // axis:'x' means horizontal scroll (trackpad swipe, Shift+scroll).
      const raw = Number(e.d) || 0
      const isHoriz = (e as any).axis === 'x'
      const notches = Math.max(-10, Math.min(10, Math.round(-raw / 100)))
      if (!notches) return null
      return isHoriz ? `H ${notches * 120}` : `S ${notches * 120}`
    }
    case 'type': {
      const text = String(e.text ?? '').slice(0, 500)
      if (!text) return null
      return `T ${Buffer.from(text, 'utf8').toString('base64')}`
    }
    case 'keydown': {
      const name = String(e.k)
      const vk =
        VK[name] ?? (/^[a-zA-Z0-9]$/.test(name) ? name.toUpperCase().charCodeAt(0) : undefined)
      if (vk === undefined) return null
      const mods = Array.isArray(e.mods) ? e.mods : []
      const lines: string[] = []
      if (mods.includes('shift')) lines.push(`D 0x10`)   // shift down
      if (mods.includes('ctrl'))  lines.push(`D 0x11`)   // ctrl down
      if (mods.includes('alt'))   lines.push(`D 0x12`)   // alt down
      lines.push(`D 0x${vk.toString(16)}`)               // key down
      return lines.join('\n')
    }
    case 'keyup': {
      const name = String(e.k)
      const vk =
        VK[name] ?? (/^[a-zA-Z0-9]$/.test(name) ? name.toUpperCase().charCodeAt(0) : undefined)
      if (vk === undefined) return null
      const mods = Array.isArray(e.mods) ? e.mods : []
      const lines: string[] = []
      lines.push(`U 0x${vk.toString(16)}`)               // key up first
      if (mods.includes('alt'))   lines.push(`U 0x12`)   // alt up
      if (mods.includes('ctrl'))  lines.push(`U 0x11`)   // ctrl up
      if (mods.includes('shift')) lines.push(`U 0x10`)   // shift up
      return lines.join('\n')
    }
    default:
      return null
  }
}

function injectInput(events: unknown): boolean {
  if (!Array.isArray(events) || !events.length) return false
  if (!ensureInputProc() || !inputProc?.stdin) return false
  const psLines: string[] = []
  for (const e of events) {
    const ev = e as RemoteEvent
    switch (ev.t) {
      // Keyboard: handled directly in-process for zero-latency state tracking.
      // The PowerShell script is used only for text typing (T) and mouse.
      case 'keydown':
        handleRemoteKeyDown(String(ev.k ?? ''), Array.isArray(ev.mods) ? ev.mods : [])
        continue
      case 'keyup':
        handleRemoteKeyUp(String(ev.k ?? ''), Array.isArray(ev.mods) ? ev.mods : [])
        continue
      default:
        break
    }
    const line = inputLine(ev)
    if (typeof line === 'string') {
      for (const part of line.split('\n')) {
        const trimmed = part.trim()
        if (trimmed) psLines.push(trimmed)
      }
    }
  }
  if (!psLines.length) return true
  try {
    inputProc.stdin.write(psLines.join('\n') + '\n')
    return true
  } catch {
    stopInputProc()
    return false
  }
}

// --- Host-side key state tracker -----------------------------------------
//
// The viewer sends keydown and keyup events. If a keyup is dropped in
// transit (unordered data channel, network hiccup), the host would believe
// that key is forever pressed — WASD stuck, Shift stuck, typing garbage.
// This set mirrors what the viewer told us, and a watchdog cleans up if
// the session ends without a tidy keyup.
//
// Keyboard events are sent to the long-lived PowerShell injector via stdin
// (the same path as mouse and text), but we track state HERE so the host
// can correct drift and the session cleanup can release every key.

/** Virtual-key codes currently held down on this machine. */
const heldVKs = new Set<number>()
/** Repeats for held non-modifier keys: vk -> { downTimer, repeatInterval }. */
const repeatTimers = new Map<number, { down: number; interval: number }>()
const REPEAT_INITIAL_MS = 400
const REPEAT_RATE_MS = 32

const MODIFIER_VKS = new Set([0x10, 0x11, 0x12, 0x5b, 0x5c])

function startRepeat(vk: number): void {
  stopRepeat(vk)
  // First repeat after a delay, then OS-rate repeats.
  const downId = window.setTimeout(() => {
    sendInputLine(`D 0x${vk.toString(16)}`)
    const intId = window.setInterval(() => {
      sendInputLine(`D 0x${vk.toString(16)}`)
    }, REPEAT_RATE_MS)
    repeatTimers.set(vk, { down: downId, interval: intId })
  }, REPEAT_INITIAL_MS)
  repeatTimers.set(vk, { down: downId, interval: -1 })
}

function stopRepeat(vk: number): void {
  const existing = repeatTimers.get(vk)
  if (existing) {
    clearTimeout(existing.down)
    clearInterval(existing.interval)
    repeatTimers.delete(vk)
  }
}

function sendInputLine(line: string): void {
  if (!ensureInputProc() || !inputProc?.stdin) return
  try {
    inputProc.stdin.write(line + '\n')
  } catch {
    stopInputProc()
  }
}

/** Process one keydown from the remote viewer. */
function handleRemoteKeyDown(rawK: string, mods: string[]): void {
  const vk = VK[rawK] ?? (/^[a-zA-Z0-9]$/.test(rawK) ? rawK.toUpperCase().charCodeAt(0) : undefined)
  if (vk === undefined) return

  // Press modifiers first (only if not already held), then the key.
  if (mods.includes('shift') && !heldVKs.has(0x10)) sendInputLine('D 0x10')
  if (mods.includes('ctrl')  && !heldVKs.has(0x11)) sendInputLine('D 0x11')
  if (mods.includes('alt')   && !heldVKs.has(0x12)) sendInputLine('D 0x12')
  sendInputLine(`D 0x${vk.toString(16)}`)
  heldVKs.add(vk)

  // Start key repeat for non-modifier keys (Backspace, letters, etc.).
  if (!MODIFIER_VKS.has(vk)) startRepeat(vk)
}

/** Process one keyup from the remote viewer. */
function handleRemoteKeyUp(rawK: string, mods: string[]): void {
  const vk = VK[rawK] ?? (/^[a-zA-Z0-9]$/.test(rawK) ? rawK.toUpperCase().charCodeAt(0) : undefined)
  if (vk === undefined) return

  stopRepeat(vk)
  sendInputLine(`U 0x${vk.toString(16)}`)
  heldVKs.delete(vk)

  // Release modifiers last, in reverse order.
  if (mods.includes('alt'))   { sendInputLine('U 0x12'); heldVKs.delete(0x12) }
  if (mods.includes('ctrl'))  { sendInputLine('U 0x11'); heldVKs.delete(0x11) }
  if (mods.includes('shift')) { sendInputLine('U 0x10'); heldVKs.delete(0x10) }
}

/** Call once when a remote session starts. */
export function resetRemoteKeyState(): void {
  for (const vk of heldVKs) sendInputLine(`U 0x${vk.toString(16)}`)
  heldVKs.clear()
  for (const [, timers] of repeatTimers) {
    clearTimeout(timers.down)
    clearInterval(timers.interval)
  }
  repeatTimers.clear()
}

/**
 * Doing the cleanup ON SCREEN, the way you'd do it yourself.
 *
 * Deleting files through the filesystem API is faster and more reliable, and
 * that's still the fallback — but "I freed 55 MB" asks you to take it on
 * faith. Watching the folder open, everything highlight, and the files go is
 * a different kind of trust.
 *
 * The danger is obvious: Ctrl+A followed by Delete is catastrophic in the
 * wrong window. So the foreground window is re-checked immediately before
 * EVERY destructive keystroke, and anything unexpected aborts to the silent
 * path rather than pressing on hopefully.
 */
const CONFIRM_KEY_DELAY = 900

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Is Explorer in front, showing the folder we opened? */
async function explorerShowing(expectTitle: string): Promise<boolean> {
  const win = await activeWindow()
  if (!win) return false
  const proc = win.process.toLowerCase()
  if (proc !== 'explorer' && proc !== 'cabinetwclass') return false
  return win.title.toLowerCase().includes(expectTitle.toLowerCase())
}

/**
 * Open the temp folder and clear it out visibly. Returns false if the window
 * never appeared or focus drifted, so the caller can fall back.
 */
async function visibleCleanTemp(): Promise<boolean> {
  const dir = os.tmpdir()
  const folderName = path.basename(dir) // "Temp"

  try {
    void shell.openPath(dir)
  } catch {
    return false
  }

  // Wait for the window, but not forever — a machine under load can be slow.
  let ready = false
  for (let i = 0; i < 14; i++) {
    await sleep(400)
    if (await explorerShowing(folderName)) {
      ready = true
      break
    }
  }
  if (!ready) return false

  // Select everything. Harmless on its own, which is why it goes first.
  if (!injectInput([{ t: 'key', k: 'a', mods: ['ctrl'] }])) return false
  await sleep(700)

  // Re-check RIGHT before the destructive key. If anything stole focus in the
  // last second — a notification, another app — Shift+Delete would land
  // somewhere it must never land.
  if (!(await explorerShowing(folderName))) return false

  // Shift+Delete skips the Recycle Bin. For temp files that's the point:
  // moving junk to the bin frees no space at all.
  if (!injectInput([{ t: 'key', k: 'Delete', mods: ['shift'] }])) return false

  // Windows asks "permanently delete these items?" — answer it.
  await sleep(CONFIRM_KEY_DELAY)
  injectInput([{ t: 'key', k: 'Enter' }])

  // Files in use can't be deleted and Windows raises a skip dialog for each.
  // Enter dismisses those too, so give it a few nudges rather than leaving a
  // modal sitting on screen.
  for (let i = 0; i < 3; i++) {
    await sleep(1200)
    injectInput([{ t: 'key', k: 'Enter' }])
  }
  return true
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

/**
 * Sleep / restart / shut down the machine — including from your phone.
 *
 * A short delay on restart/shutdown gives Senti a beat to speak the
 * confirmation first. Note: nothing here can turn the PC back ON — waking a
 * powered-off machine needs Wake-on-LAN set up in the BIOS/router, which
 * software alone can't do.
 */
function powerAction(modeRaw: unknown): boolean {
  const mode = String(modeRaw ?? '').toLowerCase().trim()
  try {
    if (mode === 'sleep') {
      // Suspend to RAM. (Hibernates instead if hibernation is enabled.)
      execFile('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0'], { windowsHide: true })
    } else if (mode === 'restart' || mode === 'reboot') {
      spawn('shutdown', ['/r', '/t', '4'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    } else if (mode === 'shutdown' || mode === 'shut down' || mode === 'off') {
      spawn('shutdown', ['/s', '/t', '4'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    } else {
      return false
    }
    return true
  } catch {
    return false
  }
}

/** Volume via media-key virtual codes: simple, no extra dependency. */
function changeVolume(direction: 'up' | 'down' | 'mute'): boolean {
  const psExe = powershellPath()
  if (!psExe) return false
  const key = direction === 'up' ? 175 : direction === 'down' ? 174 : 173
  const repeat = direction === 'mute' ? 1 : 5 // ~10% per step
  const ps = `$w = New-Object -ComObject WScript.Shell; 1..${repeat} | ForEach-Object { $w.SendKeys([char]${key}) }`
  try {
    execFile(psExe, ['-NoProfile', '-NonInteractive', '-Command', ps], {
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

/** Close whatever window is in the foreground right now. */
async function closeCurrentApp(): Promise<{ ok: boolean; label: string; error?: string }> {
  const win = await activeWindow()
  if (!win) return { ok: false, label: '', error: 'nothing' }
  const proc = win.process.toLowerCase().replace(/\.exe$/i, '')
  const label = win.title || proc
  // Use taskkill on the PID so we don't need a name whitelist — we're killing
  // whatever is ALREADY in front of the user, which is exactly what they asked
  // for. The PID comes from Windows itself, not from the model.
  const pidMatch = win.title.match(/pid:(\d+)/i)
  // activeWindow returns only {title, process} — no PID. Fall back to taskkill
  // by process name from the window info.
  const exeMap: Record<string, string> = {
    explorer: 'explorer.exe',
    code: 'Code.exe',
    chrome: 'chrome.exe',
    msedge: 'msedge.exe',
    firefox: 'firefox.exe',
    spotify: 'Spotify.exe',
    discord: 'Discord.exe',
    steam: 'steam.exe',
    notepad: 'notepad.exe',
    mspaint: 'mspaint.exe',
    CalculatorApp: 'CalculatorApp.exe',
    wt: 'WindowsTerminal.exe',
  }
  const exe = exeMap[proc] || (proc.endsWith('.exe') ? proc : proc + '.exe')
  try {
    spawn('taskkill', ['/IM', exe, '/F'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    return { ok: true, label }
  } catch {
    return { ok: false, label, error: 'failed' }
  }
}

function showDesktop(): boolean {
  try {
    // The VK code for the Windows "Show Desktop" shortcut (Win+D).
    const psExe = powershellPath()
    if (!psExe) return false
    execFileSync(psExe, [
      '-NoProfile', '-NonInteractive', '-Command',
      '(New-Object -ComObject Shell.Application).MinimizeAll()'
    ], { windowsHide: true, timeout: 4000 })
    return true
  } catch {
    return false
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

// Tap-to-talk. Press this anywhere and Senti opens a conversation instantly —
// no wake word, like holding the button on a walkie-talkie. The surest way to
// start talking when a room is noisy or you'd rather not say the name.
const TALK_SHORTCUT = 'CommandOrControl+Shift+Space'
// Panic button: minimise everything and close whatever is in front — the fastest
// way out of a game or a fullscreen app, reachable without touching the mouse.
const DESKTOP_SHORTCUT = 'CommandOrControl+Shift+Q'

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
      // CRITICAL: Windows throttles hidden/occluded windows to ~1fps, which
      // stalls the always-listening audio loop. Senti has to keep hearing you
      // while it sits quietly in the corner, so throttling stays OFF.
      backgroundThrottling: false,
      // Remote control plays the other machine's system audio. Chromium's
      // default policy blocks sound until the user clicks the page, which
      // would silently mute a session that looks like it's working.
      autoplayPolicy: 'no-user-gesture-required',
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
  // Launching Senti again (double-click the icon) opens the control center,
  // since a single instance is already running in the tray.
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) openSettingsWindow()
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

  // Screen share needs its own handler (getDisplayMedia, not getUserMedia) —
  // Electron requires this or the capture silently fails with no prompt at all
  // to fall back on. We hand back the primary screen with no picker UI, since
  // the whole point is "start when I say so", not a dialog to click through.
  session.defaultSession.setDisplayMediaRequestHandler((_req, callback) => {
    void desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } }).then((sources) => {
      callback(sources[0] ? { video: sources[0] } : {})
    })
  })

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

  // Tray icon from the start — Senti is always listening in the background,
  // so the tray must always be present even when the window is fully hidden.
  buildTray()

  // Tap-to-talk from anywhere.
  try {
    globalShortcut.register(TALK_SHORTCUT, () => {
      mainWindow?.webContents.send('senti:talk')
    })
  } catch {
    // ignore if the accelerator is taken by another app
  }

  // Panic button: minimise everything + close the foreground app from anywhere.
  try {
    globalShortcut.register(DESKTOP_SHORTCUT, () => {
      void closeCurrentApp()
      void showDesktop()
    })
  } catch {
    // ignore if the accelerator is taken by another app
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
  // Never leave the injector running after Senti is gone.
  stopInputProc()
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

// The OS clipboard, for cross-device sync. Text only — files and images stay
// on the machine they were copied on.
ipcMain.handle('senti:clipboard-read', () => {
  try {
    return clipboard.readText()
  } catch {
    return ''
  }
})
ipcMain.handle('senti:clipboard-write', (_e: unknown, text: unknown) => {
  try {
    if (typeof text === 'string' && text) clipboard.writeText(text)
    return true
  } catch {
    return false
  }
})

// --- Screenshots ------------------------------------------------------
//
// Senti seeing your screen, but ONLY when you ask.
//
// This is deliberately not the same thing as watching: there is no timer, no
// background capture, and nothing happens unless a request comes in from
// something you said. A single frame, at the moment you asked for it, is
// ordinary software. A loop that samples your screen unprompted is
// surveillance, and that is not built.

/** Grab the primary screen once. Returns a PNG data URL, or null. */
async function captureScreen(maxWidth = 1600): Promise<string | null> {
  try {
    const displays = screen.getPrimaryDisplay()
    const { width, height } = displays.size
    const scale = Math.min(1, maxWidth / width)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
    })
    const shot = sources[0]?.thumbnail
    if (!shot || shot.isEmpty()) return null
    return shot.toDataURL()
  } catch {
    return null
  }
}

/** Save a screenshot to Pictures\Senti and return where it went. */
async function saveScreenshot(): Promise<{ ok: boolean; path?: string }> {
  // Full resolution for a saved file — downscaling is for the vision model,
  // where the image is about to be described, not kept.
  const dataUrl = await captureScreen(4096)
  if (!dataUrl) return { ok: false }
  try {
    const dir = path.join(app.getPath('pictures'), 'Senti')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const file = path.join(dir, `screenshot-${stamp}.png`)
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
    return { ok: true, path: file }
  } catch {
    return { ok: false }
  }
}

// Screen sources for the live remote view. Returns the primary screen's source
// id, which the renderer feeds to getUserMedia to capture the desktop without a
// picker dialog. No frame ever touches main — the renderer captures and uploads.
// Save a screenshot; and grab one for the vision model to describe.
ipcMain.handle('senti:screenshot-save', () => saveScreenshot())
ipcMain.handle('senti:screenshot-grab', () => captureScreen(1600))

ipcMain.handle('senti:screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
    return sources.map((s) => ({ id: s.id, name: s.name }))
  } catch {
    return []
  }
})

// Senti's memory — read into every conversation, written by the `remember`
// tool, and yours to inspect or wipe.
ipcMain.handle('senti:memory-list', () => loadMemories())
ipcMain.handle('senti:memory-add', (_e: unknown, text: unknown) => addMemory(String(text ?? '')))
ipcMain.handle('senti:memory-forget', (_e: unknown, id: unknown) => {
  const list = loadMemories().filter((m) => m.id !== String(id))
  saveMemories(list)
  return list
})
ipcMain.handle('senti:memory-clear', () => {
  saveMemories([])
  return []
})

// The activity journal Senti learns your habits from. Local, aggregated.
ipcMain.handle('senti:activity-record', (_e: unknown, p: unknown, t: unknown, m: unknown) =>
  recordActivity(p, t, m)
)
ipcMain.handle('senti:activity-list', () => loadJournal())
ipcMain.handle('senti:activity-clear', () => {
  saveJournal([])
  return []
})

// --- Keep-awake ------------------------------------------------------
//
// If you're monitoring a long task from your phone and the PC sleeps, Senti
// goes dark and you lose the thread; same story while your screen is being
// shared. Multiple INDEPENDENT callers can want this at once (status
// reporting, screen share), so it's ref-counted by caller id rather than a
// single on/off — one finishing must never turn off another's lock. Released
// the moment nobody needs it any more, so we don't drain the battery.
let awakeBlockerId: number | null = null
const awakeHolders = new Set<string>()
ipcMain.handle('senti:keep-awake', (_e: unknown, on: unknown, holder: unknown) => {
  try {
    const key = typeof holder === 'string' && holder ? holder : 'default'
    if (on) awakeHolders.add(key)
    else awakeHolders.delete(key)

    if (awakeHolders.size > 0 && awakeBlockerId === null) {
      awakeBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    } else if (awakeHolders.size === 0 && awakeBlockerId !== null) {
      powerSaveBlocker.stop(awakeBlockerId)
      awakeBlockerId = null
    }
    return awakeBlockerId !== null
  } catch {
    return false
  }
})

// OS actions. Each is whitelisted or scoped in main; the renderer (and the
// model behind it) can only ask, never dictate a command.
ipcMain.handle('senti:open-app', (_e: unknown, name: unknown) => openApp(name))
ipcMain.handle('senti:close-app', (_e: unknown, name: unknown) => closeApp(name))
ipcMain.handle('senti:close-current-app', async () => closeCurrentApp())
ipcMain.handle('senti:show-desktop', () => showDesktop())
ipcMain.handle('senti:clean-temp', () => cleanTempDirs())
/**
 * Clean up where you can watch it. Falls back to the silent sweep when the
 * window never came up or focus drifted, then reports what was actually
 * freed either way — the visible pass can't count bytes, only the API can.
 */
ipcMain.handle('senti:clean-temp-visible', async () => {
  const shown = await visibleCleanTemp()
  // Run the API sweep regardless: it catches the locked/nested files Explorer
  // skipped, and it's the only thing that can report a real figure.
  const swept = cleanTempDirs()
  return { ...swept, shown }
})
ipcMain.handle('senti:empty-recycle-bin', () => emptyRecycleBin())
ipcMain.handle('senti:open-folder', (_e: unknown, name: unknown) => openFolder(name))
// Serving a folder listing / a file to your other devices.
ipcMain.handle('senti:serve-list', (_e: unknown, root: unknown, rel: unknown) =>
  listRemoteFolder(String(root ?? ''), String(rel ?? ''))
)
ipcMain.handle('senti:serve-read', (_e: unknown, root: unknown, rel: unknown) =>
  readRemoteFile(String(root ?? ''), String(rel ?? ''))
)
ipcMain.handle('senti:open-file', (_e: unknown, query: unknown) => openFile(query))
ipcMain.handle('senti:lock-workstation', () => lockWorkstation())
ipcMain.handle('senti:power', (_e: unknown, mode: unknown) => powerAction(mode))

// What you're focused on — so Senti can speak up about it. Title bar only.
ipcMain.handle('senti:active-window', () => activeWindow())

// Remote control: apply input from the machine driving this one.
ipcMain.handle('senti:remote-input', (_e: unknown, events: unknown) => injectInput(events))
ipcMain.handle('senti:remote-input-stop', () => {
  stopInputProc()
  return true
})
ipcMain.handle('senti:reset-remote-key-state', () => {
  resetRemoteKeyState()
  return true
})
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

// --- Window modes + tray ---------------------------------------------
//
// Senti has to keep running after you unlock, or it can't hear you. So the
// window is never destroyed — it becomes a small HUD that stays hidden until
// the wake word fires, and the app lives in the tray.

type WindowMode = 'setup' | 'hud' | 'panel'
let windowMode: WindowMode = 'setup'
let tray: InstanceType<typeof Tray> | null = null
let quitting = false

// Square, so the floating orb has room to breathe.
// Two footprints: a small always-visible orb tucked in the corner (so you can
// SEE Senti is alive and listening), and a larger centred one when you talk to
// it.
const HUD_BIG = 380
const HUD_SMALL = 132

/** Small: bottom-right corner. Big: centred, slightly high. */
function positionHud(big: boolean): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { workArea } = screen.getPrimaryDisplay()
  if (big) {
    mainWindow.setBounds({
      x: Math.round(workArea.x + (workArea.width - HUD_BIG) / 2),
      y: Math.round(workArea.y + (workArea.height - HUD_BIG) / 2 - workArea.height * 0.06),
      width: HUD_BIG,
      height: HUD_BIG,
    })
  } else {
    mainWindow.setBounds({
      x: Math.round(workArea.x + workArea.width - HUD_SMALL - 18),
      y: Math.round(workArea.y + workArea.height - HUD_SMALL - 18),
      width: HUD_SMALL,
      height: HUD_SMALL,
    })
  }
}

function setWindowMode(mode: WindowMode): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  windowMode = mode

  if (mode === 'hud') {
    // The orb LIVES here: a small, click-through presence in the corner that's
    // always visible, so you know Senti is listening. It grows to the centre
    // when you speak to it (showHud).
    mainWindow.setFullScreen(false)
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(true)
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    // Clicks pass straight through to whatever you're working in.
    mainWindow.setIgnoreMouseEvents(true, { forward: true })
    positionHud(false)
    mainWindow.showInactive()
  } else if (mode === 'setup') {
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setFullScreen(false)
    mainWindow.setResizable(true)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setSize(980, 760)
    mainWindow.center()
    mainWindow.show()
  } else if (mode === 'panel') {
    // The control center (Settings), reachable from the tray/orb once signed in.
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setFullScreen(false)
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setSize(760, 840)
    mainWindow.center()
    mainWindow.show()
    mainWindow.focus()
  } else {
    // Sign-in: a normal window you can move, minimise or Alt+Tab away from.
    mainWindow.setIgnoreMouseEvents(false)
    mainWindow.setFullScreen(false)
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setResizable(false)
    mainWindow.setSkipTaskbar(false)
    mainWindow.setSize(680, 780)
    mainWindow.center()
    mainWindow.show()
    mainWindow.focus()
  }
  updateTrayMenu()
}

/** Grow the orb to centre-screen while Senti is being spoken to. */
function showHud(): void {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'hud') return
  positionHud(true)
  mainWindow.showInactive()
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
}

/** Shrink back to the small corner presence — it stays visible, not hidden. */
function hideHud(): void {
  if (!mainWindow || mainWindow.isDestroyed() || windowMode !== 'hud') return
  positionHud(false)
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

/** Open the control center (Settings): a normal window + tell the renderer. */
function openSettingsWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('senti:open-settings')
  setWindowMode('panel')
  mainWindow.show()
  mainWindow.focus()
}

function buildTray(): void {
  if (tray) return
  try {
    tray = new Tray(trayIcon())
    updateTrayMenu()
    // Left-click the tray icon opens / restores Senti — the natural "open the app".
    tray.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        // If already visible, focus it.
        mainWindow.focus()
      } else {
        restoreWindowFromTray()
      }
    })
  } catch {
    // A missing tray shouldn't stop Senti from running.
  }
}

function updateTrayMenu(): void {
  if (!tray) return
  const isHidden = mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: isHidden ? 'Show Senti' : 'Hide Senti',
      click: () => {
        if (isHidden) restoreWindowFromTray()
        else hideWindowFromTray()
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => openSettingsWindow(),
    },
    {
      label: 'Quit Senti',
      click: () => {
        quitting = true
        app.quit()
      },
    },
  ]
  tray.setContextMenu(Menu.buildFromTemplate(template))
  tray.setToolTip(isHidden ? 'Senti — hidden, listening' : 'Senti — listening for you')
}

function hideWindowFromTray(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.hide()
  updateTrayMenu()
}

function restoreWindowFromTray(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  setWindowMode('hud')
  mainWindow.showInactive()
  updateTrayMenu()
}

// Background operation: after unlock Senti becomes a hidden HUD in the tray so
// it can keep listening. The renderer drives these.
ipcMain.handle('senti:set-window-mode', (_e: unknown, mode: unknown) => {
  if (mode === 'setup' || mode === 'hud' || mode === 'panel') {
    setWindowMode(mode)
    if (mode === 'hud') buildTray()
    return true
  }
  return false
})
/**
 * Fill the display while driving another machine.
 *
 * The control surface is a normal element in the renderer, so without this it
 * would be boxed inside whatever size the Senti window happened to be. Taking
 * control should feel like sitting at the other computer, which means the
 * other computer's screen gets the whole screen.
 */
ipcMain.handle('senti:enter-fullscreen', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  mainWindow.setAlwaysOnTop(false)
  mainWindow.setFullScreen(true)
  mainWindow.focus()
  return true
})

ipcMain.handle('senti:exit-fullscreen', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  mainWindow.setFullScreen(false)
  // The orb lives above other windows; restore that once we're done.
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  return true
})

ipcMain.handle('senti:hud-show', () => {
  showHud()
  return true
})
ipcMain.handle('senti:hud-hide', () => {
  hideHud()
  return true
})

/** Fully hide the Senti window — it keeps listening in the background. */
ipcMain.handle('senti:hide-window', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  mainWindow.hide()
  return true
})
/** Restore the Senti window to HUD mode after it was hidden. */
ipcMain.handle('senti:restore-window', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  setWindowMode('hud')
  mainWindow.showInactive()
  return true
})

/** Start/stop the background screen watcher (called from renderer). */
ipcMain.handle('senti:start-screen-context', () => {
  // The actual capture loop runs in the renderer; main just records the
  // intent so it can gate on permissions if needed later.
  return true
})
ipcMain.handle('senti:stop-screen-context', () => {
  return true
})

// --- Code Bridge: VS Code ↔ Senti via WebSocket --------------------------
//
// The VS Code extension connects to localhost:9876. Main forwards messages
// to/from the renderer via IPC so Senti's code tools can read files, write
// code, run terminal commands, etc.

ipcMain.handle('senti:start-code-bridge', async () => {
  if (codeBridgeWss) return true
  try {
    const ws = await import('ws')
    const ServerCtor = (ws as any).Server || (ws as any).default.Server
    if (!ServerCtor) return false
    codeBridgeWss = new ServerCtor({ port: 9876, host: '127.0.0.1' })

    codeBridgeWss.on('connection', (socket: any) => {
      codeBridgeClient = socket
      mainWindow?.webContents.send('senti:code-bridge-message', { type: 'connected' })

      socket.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          mainWindow?.webContents.send('senti:code-bridge-message', msg)
        } catch {
          // ignore
        }
      })

      socket.on('close', () => {
        codeBridgeClient = null
        mainWindow?.webContents.send('senti:code-bridge-message', { type: 'disconnected' })
      })
    })

    if (codeBridgeWss) {
      codeBridgeWss.on('error', () => {
        // Port in use or other error — VS Code extension will retry.
      })
    }

    return true
  } catch {
    return false
  }
})

ipcMain.handle('senti:stop-code-bridge', () => {
  if (codeBridgeWss) {
    try {
      codeBridgeWss.close()
    } catch {
      // ignore
    }
    codeBridgeWss = null
    codeBridgeClient = null
  }
  return true
})

ipcMain.handle('senti:send-to-vscode', (_e: unknown, msg: unknown) => {
  if (!codeBridgeClient || codeBridgeClient.readyState !== 1) return false
  try {
    codeBridgeClient.send(JSON.stringify(msg))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('senti:is-code-bridge-connected', () => {
  return codeBridgeClient !== null && codeBridgeClient.readyState === 1
})

ipcMain.handle('senti:quit', () => {
  app.quit()
  return true
})
