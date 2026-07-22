import { existsSync as k, readFileSync as D, mkdirSync as I, writeFileSync as U, unlinkSync as H, readdirSync as X, rmdirSync as Z, statSync as ee } from "fs";
import { spawn as F, execFile as V } from "child_process";
import q from "http";
import f from "os";
import te from "electron";
import d from "path";
import { fileURLToPath as re } from "url";
const { app: u, BrowserWindow: N, screen: z, ipcMain: l, globalShortcut: S, safeStorage: x, session: B, shell: oe, Tray: ne, Menu: se, nativeImage: O } = te, ae = re(import.meta.url), R = d.dirname(ae), C = process.env.VITE_DEV_SERVER_URL, W = "http://localhost:5173";
let r = null, _ = "";
const ie = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".data": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".map": "application/json"
}, le = 47615;
function ce(t) {
  return new Promise((e, o) => {
    const n = q.createServer((a, i) => {
      try {
        let p = decodeURIComponent((a.url || "/").split("?")[0]);
        (p === "/" || p === "") && (p = "/index.html");
        const h = d.normalize(p).replace(/^([/\\])+/, ""), m = d.join(t, h);
        if (!m.startsWith(t) || !k(m)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const Q = D(m);
        i.writeHead(200, {
          "Content-Type": ie[d.extname(m).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(Q);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let s = le, c = 0;
    n.on("error", (a) => {
      a.code === "EADDRINUSE" && c < 12 ? (c++, s++, setTimeout(() => n.listen(s, "127.0.0.1"), 40)) : o(a);
    }), n.on("listening", () => e(`http://127.0.0.1:${s}`)), n.listen(s, "127.0.0.1");
  });
}
const g = () => d.join(u.getPath("userData"), "device.token");
function ue(t) {
  try {
    return I(d.dirname(g()), { recursive: !0 }), x.isEncryptionAvailable() ? (U(g(), x.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function J() {
  try {
    return !k(g()) || !x.isEncryptionAvailable() ? null : x.decryptString(D(g()));
  } catch {
    return null;
  }
}
function de() {
  try {
    k(g()) && H(g());
  } catch {
  }
}
const v = () => d.join(u.getPath("userData"), "setup.json");
function pe() {
  var t;
  try {
    return k(v()) ? ((t = JSON.parse(D(v(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function fe(t) {
  try {
    I(d.dirname(v()), { recursive: !0 }), U(v(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
let w = null;
const he = 2e4;
function me() {
  var n, s;
  const t = f.totalmem() / 1073741824, e = f.freemem() / 1024 ** 3, o = t - e;
  return {
    os: `${f.type()} ${f.release()}`,
    cpu: ((s = (n = f.cpus()[0]) == null ? void 0 : n.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: f.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +o.toFixed(1),
    ramUsedPct: Math.round(o / t * 100),
    uptimeHours: +(f.uptime() / 3600).toFixed(1)
  };
}
function ge() {
  const t = `
$ErrorActionPreference='SilentlyContinue'
$d = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
     ForEach-Object { [pscustomobject]@{ drive=$_.DeviceID; totalGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.FreeSpace/1GB,1) } }
$p = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 6 |
     ForEach-Object { [pscustomobject]@{ name=$_.ProcessName; memMB=[math]::Round($_.WorkingSet/1MB) } }
$s = (Get-CimInstance Win32_StartupCommand | Measure-Object).Count
[pscustomobject]@{ disks=@($d); topProcesses=@($p); startupApps=$s } | ConvertTo-Json -Compress -Depth 4
`;
  return new Promise((e) => {
    V(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", t],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (o, n) => {
        if (o || !n) return e({});
        try {
          const s = JSON.parse(n), c = (s.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          e({
            disks: c,
            topProcesses: s.topProcesses || [],
            startupApps: typeof s.startupApps == "number" ? s.startupApps : void 0
          });
        } catch {
          e({});
        }
      }
    );
  });
}
const $ = {
  // Browsers
  chrome: { kind: "exe", target: "chrome", label: "Chrome" },
  "google chrome": { kind: "exe", target: "chrome", label: "Chrome" },
  edge: { kind: "exe", target: "msedge", label: "Edge" },
  firefox: { kind: "exe", target: "firefox", label: "Firefox" },
  // Windows built-ins
  notepad: { kind: "exe", target: "notepad", label: "Notepad" },
  calculator: { kind: "exe", target: "calc", label: "Calculator" },
  calc: { kind: "exe", target: "calc", label: "Calculator" },
  explorer: { kind: "exe", target: "explorer", label: "File Explorer" },
  files: { kind: "exe", target: "explorer", label: "File Explorer" },
  "file explorer": { kind: "exe", target: "explorer", label: "File Explorer" },
  "task manager": { kind: "exe", target: "taskmgr", label: "Task Manager" },
  settings: { kind: "url", target: "ms-settings:", label: "Settings" },
  terminal: { kind: "exe", target: "wt", label: "Terminal" },
  cmd: { kind: "exe", target: "cmd", label: "Command Prompt" },
  paint: { kind: "exe", target: "mspaint", label: "Paint" },
  // Common apps
  spotify: { kind: "exe", target: "spotify", label: "Spotify" },
  discord: { kind: "exe", target: "discord", label: "Discord" },
  steam: { kind: "exe", target: "steam", label: "Steam" },
  code: { kind: "exe", target: "code", label: "VS Code" },
  "vs code": { kind: "exe", target: "code", label: "VS Code" },
  vscode: { kind: "exe", target: "code", label: "VS Code" },
  // Sites
  youtube: { kind: "url", target: "https://youtube.com", label: "YouTube" },
  google: { kind: "url", target: "https://google.com", label: "Google" },
  gmail: { kind: "url", target: "https://mail.google.com", label: "Gmail" },
  github: { kind: "url", target: "https://github.com", label: "GitHub" },
  chatgpt: { kind: "url", target: "https://chatgpt.com", label: "ChatGPT" },
  whatsapp: { kind: "url", target: "https://web.whatsapp.com", label: "WhatsApp" },
  maps: { kind: "url", target: "https://maps.google.com", label: "Maps" }
};
function be(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? $[e] ? $[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
function ye(t) {
  const e = be(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.kind === "url" ? oe.openExternal(e.target) : F("cmd", ["/c", "start", "", e.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const G = 2e4;
function ke() {
  const t = [f.tmpdir(), d.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let o = 0, n = 0;
  const s = (c, a) => {
    if (a > 6 || Date.now() - e > G || !/temp/i.test(c)) return;
    let i;
    try {
      i = X(c, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const p of i) {
      if (Date.now() - e > G) return;
      const h = d.join(c, p.name);
      try {
        if (p.isSymbolicLink()) continue;
        if (p.isDirectory()) {
          s(h, a + 1);
          try {
            Z(h);
          } catch {
          }
        } else if (p.isFile()) {
          const m = ee(h).size;
          H(h), o += m, n++;
        }
      } catch {
      }
    }
  };
  for (const c of t) s(c, 0);
  return { freedMB: Math.round(o / 1024 / 1024), files: n };
}
function we() {
  try {
    return F("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Se(t) {
  const n = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return V("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", n], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const xe = {
  chrome: { proc: "chrome.exe", label: "Chrome" },
  edge: { proc: "msedge.exe", label: "Edge" },
  firefox: { proc: "firefox.exe", label: "Firefox" },
  notepad: { proc: "notepad.exe", label: "Notepad" },
  spotify: { proc: "Spotify.exe", label: "Spotify" },
  discord: { proc: "Discord.exe", label: "Discord" },
  steam: { proc: "steam.exe", label: "Steam" },
  calculator: { proc: "CalculatorApp.exe", label: "Calculator" },
  paint: { proc: "mspaint.exe", label: "Paint" }
};
function Ce(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = xe[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return F("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function ve() {
  if (w && Date.now() - w.at < he) return w.data;
  const t = me();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await ge();
    } catch {
    }
  const o = { ...t, ...e };
  return w = { at: Date.now(), data: o }, o;
}
async function Ee(t) {
  const { baseUrl: e, path: o, method: n = "GET", body: s, auth: c = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !o.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const a = { "Content-Type": "application/json" };
  if (c) {
    const i = J();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    a.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${e}${o}`, {
      method: n,
      headers: a,
      body: s === void 0 ? void 0 : JSON.stringify(s)
    }), p = await i.json().catch(() => null);
    return { ok: i.ok, status: i.status, data: p };
  } catch (i) {
    return {
      ok: !1,
      status: 0,
      data: { error: i instanceof Error ? i.message : "Network error" }
    };
  }
}
let P = !0;
const Te = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], _e = "CommandOrControl+Alt+Shift+Q";
function Ae() {
  for (const t of Te)
    try {
      S.isRegistered(t) && S.unregister(t);
    } catch {
    }
}
function y(t) {
  P = t, Ae();
}
function De(t, e = 15e3) {
  return new Promise((o, n) => {
    const s = Date.now(), c = () => {
      q.get(t, (p) => {
        p.statusCode === 200 ? o() : a();
      }).on("error", a);
    }, a = () => {
      Date.now() - s > e ? n(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(c, 300);
    };
    c();
  });
}
function Y() {
  const { width: t, height: e } = z.getPrimaryDisplay().workAreaSize, o = d.join(R, "preload.cjs");
  r = new N({
    width: t,
    height: e,
    fullscreen: !0,
    frame: !1,
    transparent: !0,
    backgroundColor: "#00000000",
    resizable: !1,
    maximizable: !1,
    minimizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    thickFrame: !1,
    show: !1,
    webPreferences: {
      preload: o,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), C ? r.loadURL(W).catch((n) => {
    console.error("[Electron] Failed to load dev server:", n.message);
  }) : _ ? r.loadURL(_).catch((n) => {
    console.error("[Electron] Failed to load prod server:", n.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var n, s;
    r == null || r.show(), r == null || r.focus(), C && ((s = (n = r == null ? void 0 : r.webContents) == null ? void 0 : n.openDevTools) == null || s.call(n));
  }), r.webContents.on("did-fail-load", (n, s, c, a, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: c, validatedURL: a, isMainFrame: i });
  }), r.webContents.on("console-message", (n, s, c) => {
    const a = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${a}] ${c}`);
  }), r.webContents.on("render-process-gone", (n, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), r.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), r.on("close", (n) => {
    E || (n.preventDefault(), r == null || r.hide());
  });
}
u.requestSingleInstanceLock() ? u.on("second-instance", () => {
  r && !r.isDestroyed() && (r.show(), r.focus());
}) : u.quit();
u.whenReady().then(async () => {
  if (C)
    try {
      await De(W);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), u.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (B.defaultSession.setPermissionRequestHandler((e, o, n) => {
    n(t(o));
  }), B.defaultSession.setPermissionCheckHandler((e, o) => t(o)), !C)
    try {
      _ = await ce(d.join(R, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), u.quit();
      return;
    }
  Y(), y(!0);
  try {
    S.register(_e, () => {
      P = !1, u.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && u.isPackaged && u.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
u.on("activate", () => {
  N.getAllWindows().length === 0 ? Y() : (r == null || r.show(), r == null || r.focus());
});
u.on("window-all-closed", () => {
  E && process.platform !== "darwin" && u.quit();
});
u.on("before-quit", () => {
  E = !0;
});
u.on("before-quit", () => {
  r = null;
});
u.on("will-quit", () => {
  S.unregisterAll();
});
l.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : ue(e.trim()));
l.handle("senti:token-clear", () => (de(), !0));
l.handle("senti:token-present", () => !!J());
l.on("senti:get-setup", (t) => {
  t.returnValue = pe();
});
l.handle("senti:set-setup", (t, e) => (fe(!!e), !0));
l.handle("senti:system-info", () => ve());
l.handle("senti:open-app", (t, e) => ye(e));
l.handle("senti:close-app", (t, e) => Ce(e));
l.handle("senti:clean-temp", () => ke());
l.handle("senti:lock-workstation", () => we());
l.handle("senti:volume", (t, e) => {
  const o = e === "up" || e === "down" || e === "mute" ? e : null;
  return o ? Se(o) : !1;
});
l.handle("senti:api", (t, e) => {
  const o = e ?? {};
  return typeof o.baseUrl != "string" || typeof o.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Ee({
    baseUrl: o.baseUrl,
    path: o.path,
    method: typeof o.method == "string" ? o.method : "GET",
    body: o.body,
    auth: o.auth !== !1
  });
});
l.handle("senti:get-platform", () => process.platform);
l.handle("senti:device-info", () => ({
  hostname: f.hostname(),
  platform: process.platform
}));
l.handle("senti:set-lock-state", (t, e) => {
  y(!!e);
});
let j = "signin", b = null, E = !1;
const M = 400, L = 400;
function K() {
  if (!r || r.isDestroyed()) return;
  const { workArea: t } = z.getPrimaryDisplay();
  r.setBounds({
    x: Math.round(t.x + (t.width - M) / 2),
    y: Math.round(t.y + (t.height - L) / 2 - t.height * 0.06),
    width: M,
    height: L
  });
}
function T(t) {
  !r || r.isDestroyed() || (j = t, t === "hud" ? (y(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), K(), r.hide()) : t === "setup" ? (y(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : (y(!0), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()));
}
function A() {
  !r || r.isDestroyed() || j !== "hud" || (K(), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function Fe() {
  !r || r.isDestroyed() || j !== "hud" || r.hide();
}
function Re() {
  const t = [
    d.join(process.resourcesPath || "", "build", "icon.png"),
    d.join(R, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (k(e)) {
        const o = O.createFromPath(e);
        if (!o.isEmpty()) return o.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return O.createEmpty();
}
function Pe() {
  if (!b)
    try {
      b = new ne(Re()), b.setToolTip("Senti — listening for you"), b.setContextMenu(
        se.buildFromTemplate([
          { label: "Sign in again", click: () => T("signin") },
          { label: "Show Senti", click: () => A() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              E = !0, u.quit();
            }
          }
        ])
      ), b.on("click", () => A());
    } catch {
    }
}
function je(t) {
  T(t ? "setup" : "signin");
}
l.handle("senti:set-setup-mode", (t, e) => (je(!!e), !0));
l.handle("senti:set-window-mode", (t, e) => e === "signin" || e === "setup" || e === "hud" ? (T(e), e === "hud" && Pe(), !0) : !1);
l.handle("senti:hud-show", () => (A(), !0));
l.handle("senti:hud-hide", () => (Fe(), !0));
l.handle("senti:lock", () => {
  T("signin");
});
l.handle("senti:quit", () => P ? !1 : (u.quit(), !0));
