import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import http from 'http'
import electron from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
const { app, BrowserWindow, screen, ipcMain } = electron
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'

// ESM compatibility: Define __dirname and __filename
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow: BrowserWindowType | null = null
let backendProcess: ChildProcessWithoutNullStreams | null = null
let backendReady = false
let modelLoaded = false
let stdoutBuffer = ''


function loadConfig<T>(fileName: string, defaultContent: T): T {
  const userConfigDir = path.join(app.getPath('userData'), 'config')
  const userConfigPath = path.join(userConfigDir, fileName)

  const writeDefault = () => {
    try {
      console.warn('[Electron] Config file missing, creating default at ' + userConfigPath)
      mkdirSync(userConfigDir, { recursive: true })
      writeFileSync(userConfigPath, JSON.stringify(defaultContent, null, 2), 'utf-8')
    } catch (e) {
      console.error('[Electron] Failed to write default config', fileName, e)
    }
    return defaultContent
  }

  try {
    if (existsSync(userConfigPath)) {
      const raw = readFileSync(userConfigPath, 'utf-8')
      return JSON.parse(raw) as T
    }
  } catch (err) {
    console.error('[Electron] Error reading user config', fileName, err)
  }

  try {
    const devPath = path.join(app.getAppPath(), 'src', 'config', fileName)
    if (existsSync(devPath)) {
      const raw = readFileSync(devPath, 'utf-8')
      const parsed = JSON.parse(raw) as T
      try {
        mkdirSync(userConfigDir, { recursive: true })
        writeFileSync(userConfigPath, JSON.stringify(parsed, null, 2), 'utf-8')
      } catch (e) {
        console.warn('[Electron] Could not persist bundled config to user data', e)
      }
      return parsed
    }
  } catch (err) {
    console.error('[Electron] Error loading bundled config', fileName, err)
  }

  return writeDefault()
}

function waitForVite(url: string, timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const req = http.get(url, res => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Vite dev server not reachable at ${url}`));
      } else {
        setTimeout(tryConnect, 300);
      }
    };
    tryConnect();
  });
}

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const preloadPath = path.join(__dirname, 'preload.js')
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

  console.log('[Electron] preload path:', preloadPath, 'exists:', existsSync(preloadPath))
  mainWindow.setVisibleOnAllWorkspaces(true)
  mainWindow.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    // Development mode - load from Vite dev server only (wait for server)
    console.log('[Electron] Development mode - loading from:', DEV_SERVER_URL)
    mainWindow.loadURL(DEV_SERVER_URL).catch((err: Error) => {
      console.error('[Electron] Failed to load dev server:', err.message)
    })
  } else {
    // Production mode - load built index.html only
    const prodPath = path.join(__dirname, '../dist/index.html')
    console.log('[Electron] Production mode - loading:', prodPath)
    if (existsSync(prodPath)) {
      mainWindow.loadFile(prodPath).catch((err: Error) => {
        console.error('[Electron] Failed to load production file:', err.message)
      })
    } else {
      console.error('[Electron] Production build not found at:', prodPath)
    }
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Renderer loaded successfully')
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.webContents.on('did-fail-load', (_event: unknown, errorCode: number, errorDescription: string) => {
    console.error('[Electron] Renderer load failed:', errorCode, errorDescription)
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

function getBackendScriptPath(): string {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, '..', 'backend', 'server', 'main.py'),
    path.join(appPath, 'backend', 'server', 'main.py'),
    path.join(process.cwd(), '..', 'backend', 'server', 'main.py'),
    path.join(process.cwd(), 'backend', 'server', 'main.py'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0]
}

function getPythonExecutable(): string {
  if (process.env.SENTI_PYTHON) return process.env.SENTI_PYTHON

  const appPath = app.getAppPath()
  const candidates = process.platform === 'win32'
    ? [
        path.join(appPath, '..', '.venv', 'Scripts', 'python.exe'),
        path.join(process.cwd(), '..', '.venv', 'Scripts', 'python.exe'),
        path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
      ]
    : [
        path.join(appPath, '..', '.venv', 'bin', 'python'),
        path.join(process.cwd(), '..', '.venv', 'bin', 'python'),
        path.join(process.cwd(), '.venv', 'bin', 'python'),
      ]

  return candidates.find((candidate) => existsSync(candidate)) || 'python'
}

function sendBackendCommand(command: string, payload: Record<string, unknown> = {}): boolean {
  console.log('[Electron] sendBackendCommand:', command, 'payload:', payload)
  if (!backendProcess || backendProcess.killed || !backendProcess.stdin.writable) {
    console.error('[Electron] Backend process not available for command:', command)
    mainWindow?.webContents.send('backend:status', {
      event: 'backend:error',
      backendConnected: false,
      modelLoaded,
      message: 'Voice backend is not running',
    })
    return false
  }

  const cmd = JSON.stringify({ command, ...payload }) + '\n'
  console.log('[Electron] Writing to backend stdin:', cmd.substring(0, 100))
  backendProcess.stdin.write(cmd)
  return true
}

function handleBackendLine(line: string): void {
  if (!line.trim()) return
  try {
    const data = JSON.parse(line)
    // Update status flags if present
    if (typeof data.backendConnected === 'boolean') backendReady = data.backendConnected
    if (typeof data.modelLoaded === 'boolean') modelLoaded = data.modelLoaded

    // Forward specific events to renderer
    if (data.event === 'voice:transcript') {
      mainWindow?.webContents.send('voice:transcript', data)
    } else if (data.event && data.event.startsWith('backend:')) {
      mainWindow?.webContents.send('backend:status', data)
    } else {
      // Fallback for any other messages
      mainWindow?.webContents.send('backend:status', data)
    }
  } catch {
    mainWindow?.webContents.send('backend:status', {
      event: 'backend:log',
      backendConnected: backendReady,
      modelLoaded,
      message: line,
    })
  }
}

function spawnBackend(): ChildProcessWithoutNullStreams | null {
  console.log('[Electron] spawnBackend() called')
  if (backendProcess && !backendProcess.killed) {
    console.log('[Electron] Backend already running, returning existing process')
    return backendProcess
  }

  console.log('[Electron] Locating backend script')
  const scriptPath = getBackendScriptPath()
  if (!existsSync(scriptPath)) {
    console.error('[Electron] Backend script not found:', scriptPath)
    mainWindow?.webContents.send('backend:status', {
      event: 'backend:error',
      message: `Backend script not found: ${scriptPath}`,
      backendConnected: false,
      modelLoaded: false,
    })
    return null
  }

  const pythonExecutable = getPythonExecutable()
  console.log('[Electron] Backend executable:', pythonExecutable)
  console.log('[Electron] Backend script:', scriptPath)
  console.log('[Electron] Starting voice backend...')

  backendProcess = spawn(pythonExecutable, [scriptPath], {
    cwd: path.dirname(path.dirname(scriptPath)),
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  backendReady = true
  modelLoaded = false

  console.log('[Electron] Backend process spawned, setting up listeners')
  
  backendProcess.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf-8')
    console.log('[Backend stdout]', text.substring(0, 200))
    stdoutBuffer += text
    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() || ''
    lines.forEach(handleBackendLine)
  })

  backendProcess.stderr.on('data', (chunk: Buffer) => {
    const message = chunk.toString('utf-8').trim()
    if (message) {
      console.error('[Backend stderr]', message)
      mainWindow?.webContents.send('backend:alert', { message })
      mainWindow?.webContents.send('backend:status', { event: 'backend:error', message })
    }
  })

  backendProcess.on('error', (err: Error) => {
    console.error('[Electron] Backend process error:', err.message)
    mainWindow?.webContents.send('backend:status', {
      event: 'backend:error',
      message: `Backend process error: ${err.message}`,
      backendConnected: false,
    })
  })

  backendProcess.on('exit', (code) => {
    console.warn('[Electron] Voice backend exited with code:', code)
    backendReady = false
    modelLoaded = false
    mainWindow?.webContents.send('backend:status', {
      event: 'backend:exit',
      backendConnected: false,
      modelLoaded: false,
      message: `Voice backend exited with code ${code}`,
    })
    backendProcess = null
  })

  return backendProcess
}

// TODO: TTS integration - placeholder for future implementation
// async function generateTTS(text: string): Promise<string | null> { ... }

app.whenReady().then(async () => {
  console.log('[Electron] App ready - initializing')
  console.log('[Electron] Platform:', process.platform)
  console.log('[Electron] VITE_DEV_SERVER_URL:', VITE_DEV_SERVER_URL || 'not set (production mode)')

  if (VITE_DEV_SERVER_URL) {
    try {
      console.log('[Electron] Waiting for Vite dev server:', DEV_SERVER_URL)
      await waitForVite(DEV_SERVER_URL)
      console.log('[Electron] Vite dev server is reachable')
    } catch (e) {
      console.error('[Electron] Vite dev server failed to start:', e)
      app.quit()
      return
    }
  }

  createWindow()
  enforceFocus()

  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: true })
  }

  // Backend spawning disabled until architecture is implemented
  backendProcess = spawnBackend()
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
  try {
    sendBackendCommand('voice:stop')
    backendProcess?.kill()
  } catch {}
  mainWindow = null
})

ipcMain.handle('senti:get-platform', () => process.platform)

ipcMain.handle('senti:lock', () => {
  mainWindow?.show()
  mainWindow?.focus()
  mainWindow?.setFullScreen(true)
})

ipcMain.handle('senti:quit', () => {
  app.quit()
})

ipcMain.handle('senti:backend-health', () => {
  return {
    backendConnected: backendReady && !!backendProcess && !backendProcess.killed,
    modelLoaded,
  }
})

ipcMain.handle('senti:play-greeting', async () => {
  // TTS disabled until architecture is implemented
  return null
})

ipcMain.handle('voice:start', () => {
  console.log('[Electron] voice:start IPC invoked')
  const backend = spawnBackend()
  console.log('[Electron] Backend spawned:', backend !== null)
  const result = sendBackendCommand('voice:start')
  console.log('[Electron] voice:start backend command sent:', result)
  return result
})

ipcMain.handle('voice:stop', () => {
  console.log('[Electron] voice:stop IPC invoked')
  const result = sendBackendCommand('voice:stop')
  console.log('[Electron] voice:stop result:', result)
  return result
})

ipcMain.handle('voice:transcribe', (_event, payload: Record<string, unknown>) => {
  console.log('[Electron] voice:transcribe IPC invoked, chunkId:', payload.chunkId)
  const result = sendBackendCommand('voice:transcribe', payload)
  console.log('[Electron] voice:transcribe result:', result)
  return result
})
