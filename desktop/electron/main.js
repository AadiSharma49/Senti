import { app, BrowserWindow, ipcMain, screen } from 'electron'
import path from 'path'
import fs from 'fs'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
const DEV_SERVER_URL = 'http://localhost:5173'

let mainWindow = null

function createWindow() {
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
    console.log('[Electron] Development mode - loading from:', DEV_SERVER_URL)
    mainWindow.loadURL(DEV_SERVER_URL).catch((err) => {
      console.error('[Electron] Failed to load dev server:', err.message)
    })
  } else {
    const prodPath = path.join(app.getAppPath(), 'dist/index.html')
    console.log('[Electron] Production mode - loading:', prodPath)
    if (fs.existsSync(prodPath)) {
      mainWindow.loadFile(prodPath).catch((err) => {
        console.error('[Electron] Failed to load production file:', err.message)
      })
    } else {
      console.error('[Electron] Production build not found at:', prodPath)
    }
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] Renderer loaded successfully')
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Electron] Renderer load failed:', errorCode, errorDescription)
  })

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus()
    }
  })

  mainWindow.on('minimize', (event) => {
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

function enforceFocus() {
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

app.whenReady().then(() => {
  console.log('[Electron] App ready - initializing')
  console.log('[Electron] Platform:', process.platform)
  console.log('[Electron] VITE_DEV_SERVER_URL:', VITE_DEV_SERVER_URL || 'not set (production mode)')

  createWindow()
  enforceFocus()

  if (process.platform === 'win32') {
    app.setLoginItemSettings({ openAtLogin: true })
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
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
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.setFullScreen(true)
  }
})

ipcMain.handle('senti:quit', () => {
  app.quit()
})

ipcMain.handle('senti:backend-health', () => {
  console.log('[Electron] Backend health requested')
  return false
})

ipcMain.handle('voice:start', () => {
  console.log('[Electron] voice:start handler invoked')
  return false
})

ipcMain.handle('voice:stop', () => {
  console.log('[Electron] voice:stop handler invoked')
  return false
})

ipcMain.handle('voice:transcribe', (_event, payload) => {
  console.log('[Electron] voice:transcribe handler invoked', payload)
  return false
})

ipcMain.handle('senti:play-greeting', async () => {
  return null
})