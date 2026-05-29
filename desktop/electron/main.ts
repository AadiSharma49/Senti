import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { app, BrowserWindow, screen, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

// ESM compatibility: Define __dirname and __filename
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow: BrowserWindow | null = null


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

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.setVisibleOnAllWorkspaces(true)
  mainWindow.setMenuBarVisibility(false)

  if (VITE_DEV_SERVER_URL) {
    // Development mode - load from Vite dev server only
    console.log('[Electron] Development mode - loading from:', DEV_SERVER_URL)
    mainWindow.loadURL(DEV_SERVER_URL).catch((err) => {
      console.error('[Electron] Failed to load dev server:', err.message)
    })
  } else {
    // Production mode - load built index.html only
    const prodPath = path.join(__dirname, '../dist/index.html')
    console.log('[Electron] Production mode - loading:', prodPath)
    if (existsSync(prodPath)) {
      mainWindow.loadFile(prodPath).catch((err) => {
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

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
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

// TODO: Backend integration - placeholder for future implementation
// function spawnBackend(): import('child_process').ChildProcess | null { ... }

// TODO: TTS integration - placeholder for future implementation
// async function generateTTS(text: string): Promise<string | null> { ... }

app.whenReady().then(() => {
  console.log('[Electron] App ready - initializing')
  console.log('[Electron] Platform:', process.platform)
  console.log('[Electron] VITE_DEV_SERVER_URL:', VITE_DEV_SERVER_URL || 'not set (production mode)')

  createWindow()
  enforceFocus()

  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: true })
  }

  // Backend spawning disabled until architecture is implemented
  // backendProcess = spawnBackend()
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
  // Backend health check disabled until architecture is implemented
  return false
})

ipcMain.handle('senti:play-greeting', async () => {
  // TTS disabled until architecture is implemented
  return null
})
