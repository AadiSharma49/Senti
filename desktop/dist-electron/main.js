import { existsSync } from "fs";
import http from "http";
import electron from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
const { app, BrowserWindow, screen, ipcMain } = electron;
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const DEV_SERVER_URL = "http://localhost:5173";
let mainWindow = null;
let backendProcess = null;
let backendReady = false;
let modelLoaded = false;
let stdoutBuffer = "";
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
  const preloadPath = path.join(__dirname$1, "preload.js");
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
  console.log("[Electron] preload path:", preloadPath, "exists:", existsSync(preloadPath));
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.setMenuBarVisibility(false);
  if (VITE_DEV_SERVER_URL) {
    console.log("[Electron] Development mode - loading from:", DEV_SERVER_URL);
    mainWindow.loadURL(DEV_SERVER_URL).catch((err) => {
      console.error("[Electron] Failed to load dev server:", err.message);
    });
  } else {
    const prodPath = path.join(__dirname$1, "../dist/index.html");
    console.log("[Electron] Production mode - loading:", prodPath);
    if (existsSync(prodPath)) {
      mainWindow.loadFile(prodPath).catch((err) => {
        console.error("[Electron] Failed to load production file:", err.message);
      });
    } else {
      console.error("[Electron] Production build not found at:", prodPath);
    }
  }
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[Electron] Renderer loaded successfully");
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error("[Electron] Renderer load failed:", errorCode, errorDescription);
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
function getBackendScriptPath() {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, "..", "backend", "server", "main.py"),
    path.join(appPath, "backend", "server", "main.py"),
    path.join(process.cwd(), "..", "backend", "server", "main.py"),
    path.join(process.cwd(), "backend", "server", "main.py")
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}
function getPythonExecutable() {
  if (process.env.SENTI_PYTHON) return process.env.SENTI_PYTHON;
  const appPath = app.getAppPath();
  const candidates = process.platform === "win32" ? [
    path.join(appPath, "..", ".venv", "Scripts", "python.exe"),
    path.join(process.cwd(), "..", ".venv", "Scripts", "python.exe"),
    path.join(process.cwd(), ".venv", "Scripts", "python.exe")
  ] : [
    path.join(appPath, "..", ".venv", "bin", "python"),
    path.join(process.cwd(), "..", ".venv", "bin", "python"),
    path.join(process.cwd(), ".venv", "bin", "python")
  ];
  return candidates.find((candidate) => existsSync(candidate)) || "python";
}
function sendBackendCommand(command, payload = {}) {
  console.log("[Electron] sendBackendCommand:", command, "payload:", payload);
  if (!backendProcess || backendProcess.killed || !backendProcess.stdin.writable) {
    console.error("[Electron] Backend process not available for command:", command);
    mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", {
      event: "backend:error",
      backendConnected: false,
      modelLoaded,
      message: "Voice backend is not running"
    });
    return false;
  }
  const cmd = JSON.stringify({ command, ...payload }) + "\n";
  console.log("[Electron] Writing to backend stdin:", cmd.substring(0, 100));
  backendProcess.stdin.write(cmd);
  return true;
}
function handleBackendLine(line) {
  if (!line.trim()) return;
  try {
    const data = JSON.parse(line);
    if (typeof data.backendConnected === "boolean") backendReady = data.backendConnected;
    if (typeof data.modelLoaded === "boolean") modelLoaded = data.modelLoaded;
    if (data.event === "voice:transcript") {
      mainWindow == null ? void 0 : mainWindow.webContents.send("voice:transcript", data);
    } else if (data.event && data.event.startsWith("backend:")) {
      mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", data);
    } else {
      mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", data);
    }
  } catch {
    mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", {
      event: "backend:log",
      backendConnected: backendReady,
      modelLoaded,
      message: line
    });
  }
}
function spawnBackend() {
  console.log("[Electron] spawnBackend() called");
  if (backendProcess && !backendProcess.killed) {
    console.log("[Electron] Backend already running, returning existing process");
    return backendProcess;
  }
  console.log("[Electron] Locating backend script");
  const scriptPath = getBackendScriptPath();
  if (!existsSync(scriptPath)) {
    console.error("[Electron] Backend script not found:", scriptPath);
    mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", {
      event: "backend:error",
      message: `Backend script not found: ${scriptPath}`,
      backendConnected: false,
      modelLoaded: false
    });
    return null;
  }
  const pythonExecutable = getPythonExecutable();
  console.log("[Electron] Backend executable:", pythonExecutable);
  console.log("[Electron] Backend script:", scriptPath);
  console.log("[Electron] Starting voice backend...");
  backendProcess = spawn(pythonExecutable, [scriptPath], {
    cwd: path.dirname(path.dirname(scriptPath)),
    stdio: ["pipe", "pipe", "pipe"]
  });
  backendReady = true;
  modelLoaded = false;
  console.log("[Electron] Backend process spawned, setting up listeners");
  backendProcess.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf-8");
    console.log("[Backend stdout]", text.substring(0, 200));
    stdoutBuffer += text;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || "";
    lines.forEach(handleBackendLine);
  });
  backendProcess.stderr.on("data", (chunk) => {
    const message = chunk.toString("utf-8").trim();
    if (message) {
      console.error("[Backend stderr]", message);
      mainWindow == null ? void 0 : mainWindow.webContents.send("backend:alert", { message });
      mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", { event: "backend:error", message });
    }
  });
  backendProcess.on("error", (err) => {
    console.error("[Electron] Backend process error:", err.message);
    mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", {
      event: "backend:error",
      message: `Backend process error: ${err.message}`,
      backendConnected: false
    });
  });
  backendProcess.on("exit", (code) => {
    console.warn("[Electron] Voice backend exited with code:", code);
    backendReady = false;
    modelLoaded = false;
    mainWindow == null ? void 0 : mainWindow.webContents.send("backend:status", {
      event: "backend:exit",
      backendConnected: false,
      modelLoaded: false,
      message: `Voice backend exited with code ${code}`
    });
    backendProcess = null;
  });
  return backendProcess;
}
app.whenReady().then(async () => {
  console.log("[Electron] App ready - initializing");
  console.log("[Electron] Platform:", process.platform);
  console.log("[Electron] VITE_DEV_SERVER_URL:", VITE_DEV_SERVER_URL || "not set (production mode)");
  if (VITE_DEV_SERVER_URL) {
    try {
      console.log("[Electron] Waiting for Vite dev server:", DEV_SERVER_URL);
      await waitForVite(DEV_SERVER_URL);
      console.log("[Electron] Vite dev server is reachable");
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
  backendProcess = spawnBackend();
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
  try {
    sendBackendCommand("voice:stop");
    backendProcess == null ? void 0 : backendProcess.kill();
  } catch {
  }
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
ipcMain.handle("senti:backend-health", () => {
  return {
    backendConnected: backendReady && !!backendProcess && !backendProcess.killed,
    modelLoaded
  };
});
ipcMain.handle("senti:play-greeting", async () => {
  return null;
});
ipcMain.handle("voice:start", () => {
  console.log("[Electron] voice:start IPC invoked");
  const backend = spawnBackend();
  console.log("[Electron] Backend spawned:", backend !== null);
  const result = sendBackendCommand("voice:start");
  console.log("[Electron] voice:start backend command sent:", result);
  return result;
});
ipcMain.handle("voice:stop", () => {
  console.log("[Electron] voice:stop IPC invoked");
  const result = sendBackendCommand("voice:stop");
  console.log("[Electron] voice:stop result:", result);
  return result;
});
ipcMain.handle("voice:transcribe", (_event, payload) => {
  console.log("[Electron] voice:transcribe IPC invoked, chunkId:", payload.chunkId);
  const result = sendBackendCommand("voice:transcribe", payload);
  console.log("[Electron] voice:transcribe result:", result);
  return result;
});
