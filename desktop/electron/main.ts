import { existsSync } from 'fs'
import http from 'http'
import os from 'os'
import electron from 'electron'
import type { BrowserWindow as BrowserWindowType } from 'electron'
const { app, BrowserWindow, screen, ipcMain, globalShortcut } = electron
import path from 'path'
import { fileURLToPath } from 'url'

// ESM compatibility: Define __dirname and __filename
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow: BrowserWindowType | null = null

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

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL).catch((err: Error) => {
      console.error('[Electron] Failed to load dev server:', err.message)
    })
  } else {
    const prodPath = path.join(__dirname, '../dist/index.html')
    if (existsSync(prodPath)) {
      mainWindow.loadFile(prodPath).catch((err: Error) => {
        console.error('[Electron] Failed to load production file:', err.message)
      })
    } else {
      console.error('[Electron] Production build not found at:', prodPath)
    }
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

  createWindow()
  enforceFocus()

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

ipcMain.handle('senti:get-platform', () => process.platform)

ipcMain.handle('senti:device-info', () => ({
  hostname: os.hostname(),
  platform: process.platform,
}))

// The renderer reports its auth state here (locked = anything but unlocked).
ipcMain.handle('senti:set-lock-state', (_event: unknown, locked: boolean) => {
  setLocked(!!locked)
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