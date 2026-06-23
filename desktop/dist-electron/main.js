import { existsSync } from "fs";
import http from "http";
import electron from "electron";
import path from "path";
import { fileURLToPath } from "url";
const { app, BrowserWindow, screen, ipcMain } = electron;
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const DEV_SERVER_URL = "http://localhost:5173";
let mainWindow = null;
function waitForVite(url, timeout = 15e3) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
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
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const preloadPath = path.join(__dirname$1, "preload.cjs");
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
      sandbox: false
    }
  });
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setMenuBarVisibility(false);
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL).catch((err) => {
      console.error("[Electron] Failed to load dev server:", err.message);
    });
  } else {
    const prodPath = path.join(__dirname$1, "../dist/index.html");
    if (existsSync(prodPath)) {
      mainWindow.loadFile(prodPath).catch((err) => {
        console.error("[Electron] Failed to load production file:", err.message);
      });
    } else {
      console.error("[Electron] Production build not found at:", prodPath);
    }
  }
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error("[Electron] Renderer load failed:", { errorCode, errorDescription, validatedURL, isMainFrame });
  });
  mainWindow.webContents.on("console-message", (_event, level, message) => {
    const prefix = ["INFO", "WARN", "ERROR", "DEBUG"][level] || "LOG";
    console.log(`[Renderer:${prefix}] ${message}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("[Electron] Renderer process gone:", details);
  });
  mainWindow.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  });
  mainWindow.on("blur", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });
  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.focus();
    }
  });
  mainWindow.on("leave-full-screen", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(true);
    }
  });
}
function enforceFocus() {
  setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isFocused() && mainWindow.isVisible()) {
        mainWindow.focus();
      }
      if (!mainWindow.isFullScreen()) {
        mainWindow.setFullScreen(true);
      }
    }
  }, 500);
}
app.whenReady().then(async () => {
  if (VITE_DEV_SERVER_URL) {
    try {
      await waitForVite(DEV_SERVER_URL);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e);
      app.quit();
      return;
    }
  }
  createWindow();
  enforceFocus();
  if (process.platform === "win32") {
    app.setLoginItemSettings({ openAtLogin: true });
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  mainWindow = null;
});
ipcMain.handle("senti:get-platform", () => process.platform);
ipcMain.handle("senti:lock", () => {
  mainWindow == null ? void 0 : mainWindow.show();
  mainWindow == null ? void 0 : mainWindow.focus();
  mainWindow == null ? void 0 : mainWindow.setFullScreen(true);
});
ipcMain.handle("senti:quit", () => {
  app.quit();
});
