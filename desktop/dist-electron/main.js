import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from "fs";
import http from "http";
import os from "os";
import electron from "electron";
import path from "path";
import { fileURLToPath } from "url";
const { app, BrowserWindow, screen, ipcMain, globalShortcut, safeStorage } = electron;
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const DEV_SERVER_URL = "http://localhost:5173";
let mainWindow = null;
const tokenFile = () => path.join(app.getPath("userData"), "device.token");
function saveToken(token) {
  try {
    mkdirSync(path.dirname(tokenFile()), { recursive: true });
    if (!safeStorage.isEncryptionAvailable()) return false;
    writeFileSync(tokenFile(), safeStorage.encryptString(token));
    return true;
  } catch {
    return false;
  }
}
function loadToken() {
  try {
    if (!existsSync(tokenFile())) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(readFileSync(tokenFile()));
  } catch {
    return null;
  }
}
function clearToken() {
  try {
    if (existsSync(tokenFile())) unlinkSync(tokenFile());
  } catch {
  }
}
async function apiRequest(opts) {
  const { baseUrl, path: p, method = "GET", body, auth = true } = opts;
  if (!/^https?:\/\//i.test(baseUrl) || !p.startsWith("/api/device/")) {
    return { ok: false, status: 400, data: { error: "Blocked request" } };
  }
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = loadToken();
    if (!token) return { ok: false, status: 401, data: { error: "This device is not linked" } };
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${baseUrl}${p}`, {
      method,
      headers,
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : "Network error" }
    };
  }
}
let isLocked = true;
const LOCK_SHORTCUTS = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
];
const RECOVERY_SHORTCUT = "CommandOrControl+Alt+Shift+Q";
function registerLockShortcuts() {
  for (const accel of LOCK_SHORTCUTS) {
    try {
      globalShortcut.register(accel, () => {
      });
    } catch {
    }
  }
}
function unregisterLockShortcuts() {
  for (const accel of LOCK_SHORTCUTS) {
    try {
      if (globalShortcut.isRegistered(accel)) globalShortcut.unregister(accel);
    } catch {
    }
  }
}
function setLocked(locked) {
  isLocked = locked;
  if (locked) registerLockShortcuts();
  else unregisterLockShortcuts();
}
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
    var _a, _b;
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
    if (VITE_DEV_SERVER_URL) {
      (_b = (_a = mainWindow == null ? void 0 : mainWindow.webContents) == null ? void 0 : _a.openDevTools) == null ? void 0 : _b.call(_a);
    }
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
  mainWindow.on("close", (event) => {
    if (isLocked) {
      event.preventDefault();
      mainWindow == null ? void 0 : mainWindow.focus();
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
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
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
  setLocked(true);
  try {
    globalShortcut.register(RECOVERY_SHORTCUT, () => {
      isLocked = false;
      app.exit(0);
    });
  } catch {
  }
  if (process.platform === "win32" && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, args: [] });
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
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
ipcMain.handle("senti:token-set", (_e, token) => {
  if (typeof token !== "string" || !token.trim()) return false;
  return saveToken(token.trim());
});
ipcMain.handle("senti:token-clear", () => {
  clearToken();
  return true;
});
ipcMain.handle("senti:token-present", () => !!loadToken());
ipcMain.handle("senti:api", (_e, req) => {
  const r = req ?? {};
  if (typeof r.baseUrl !== "string" || typeof r.path !== "string") {
    return { ok: false, status: 400, data: { error: "Bad request" } };
  }
  return apiRequest({
    baseUrl: r.baseUrl,
    path: r.path,
    method: typeof r.method === "string" ? r.method : "GET",
    body: r.body,
    auth: r.auth !== false
  });
});
ipcMain.handle("senti:get-platform", () => process.platform);
ipcMain.handle("senti:device-info", () => ({
  hostname: os.hostname(),
  platform: process.platform
}));
ipcMain.handle("senti:set-lock-state", (_event, locked) => {
  setLocked(!!locked);
});
ipcMain.handle("senti:lock", () => {
  setLocked(true);
  mainWindow == null ? void 0 : mainWindow.show();
  mainWindow == null ? void 0 : mainWindow.focus();
  mainWindow == null ? void 0 : mainWindow.setFullScreen(true);
});
ipcMain.handle("senti:quit", () => {
  if (isLocked) return false;
  app.quit();
  return true;
});
