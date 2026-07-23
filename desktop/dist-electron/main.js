import { existsSync as w, readFileSync as B, mkdirSync as H, writeFileSync as V, unlinkSync as q, readdirSync as ee, rmdirSync as te, statSync as re } from "fs";
import { spawn as O, execFile as N } from "child_process";
import W from "http";
import f from "os";
import ne from "electron";
import d from "path";
import { fileURLToPath as oe } from "url";
const { app: u, BrowserWindow: J, screen: Y, ipcMain: l, globalShortcut: E, safeStorage: T, session: I, shell: se, Tray: ae, Menu: ie, nativeImage: $, powerSaveBlocker: L } = ne, le = oe(import.meta.url), P = d.dirname(le), _ = process.env.VITE_DEV_SERVER_URL, K = "http://localhost:5173";
let t = null, F = "";
const ce = {
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
}, ue = 47615;
function de(r) {
  return new Promise((e, n) => {
    const o = W.createServer((a, i) => {
      try {
        let p = decodeURIComponent((a.url || "/").split("?")[0]);
        (p === "/" || p === "") && (p = "/index.html");
        const h = d.normalize(p).replace(/^([/\\])+/, ""), m = d.join(r, h);
        if (!m.startsWith(r) || !w(m)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const Z = B(m);
        i.writeHead(200, {
          "Content-Type": ce[d.extname(m).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(Z);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let s = ue, c = 0;
    o.on("error", (a) => {
      a.code === "EADDRINUSE" && c < 12 ? (c++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(a);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const k = () => d.join(u.getPath("userData"), "device.token");
function pe(r) {
  try {
    return H(d.dirname(k()), { recursive: !0 }), T.isEncryptionAvailable() ? (V(k(), T.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function Q() {
  try {
    return !w(k()) || !T.isEncryptionAvailable() ? null : T.decryptString(B(k()));
  } catch {
    return null;
  }
}
function fe() {
  try {
    w(k()) && q(k());
  } catch {
  }
}
const A = () => d.join(u.getPath("userData"), "setup.json");
function he() {
  var r;
  try {
    return w(A()) ? ((r = JSON.parse(B(A(), "utf8"))) == null ? void 0 : r.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function me(r) {
  try {
    H(d.dirname(A()), { recursive: !0 }), V(A(), JSON.stringify({ setupCompleted: !!r }));
  } catch {
  }
}
let x = null;
const ge = 2e4;
function be() {
  var o, s;
  const r = f.totalmem() / 1073741824, e = f.freemem() / 1024 ** 3, n = r - e;
  return {
    os: `${f.type()} ${f.release()}`,
    cpu: ((s = (o = f.cpus()[0]) == null ? void 0 : o.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: f.cpus().length,
    ramTotalGB: +r.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / r * 100),
    uptimeHours: +(f.uptime() / 3600).toFixed(1)
  };
}
function ke() {
  const r = `
$ErrorActionPreference='SilentlyContinue'
$d = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
     ForEach-Object { [pscustomobject]@{ drive=$_.DeviceID; totalGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.FreeSpace/1GB,1) } }
$p = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 6 |
     ForEach-Object { [pscustomobject]@{ name=$_.ProcessName; memMB=[math]::Round($_.WorkingSet/1MB) } }
$s = (Get-CimInstance Win32_StartupCommand | Measure-Object).Count
[pscustomobject]@{ disks=@($d); topProcesses=@($p); startupApps=$s } | ConvertTo-Json -Compress -Depth 4
`;
  return new Promise((e) => {
    N(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", r],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (n, o) => {
        if (n || !o) return e({});
        try {
          const s = JSON.parse(o), c = (s.disks || []).map((a) => ({
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
const U = {
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
function ye(r) {
  if (typeof r != "string") return null;
  const e = r.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? U[e] ? U[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
function we(r) {
  const e = ye(r);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.kind === "url" ? se.openExternal(e.target) : O("cmd", ["/c", "start", "", e.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const z = 2e4;
function Se() {
  const r = [f.tmpdir(), d.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (c, a) => {
    if (a > 6 || Date.now() - e > z || !/temp/i.test(c)) return;
    let i;
    try {
      i = ee(c, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const p of i) {
      if (Date.now() - e > z) return;
      const h = d.join(c, p.name);
      try {
        if (p.isSymbolicLink()) continue;
        if (p.isDirectory()) {
          s(h, a + 1);
          try {
            te(h);
          } catch {
          }
        } else if (p.isFile()) {
          const m = re(h).size;
          q(h), n += m, o++;
        }
      } catch {
      }
    }
  };
  for (const c of r) s(c, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function xe() {
  try {
    return O("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Ce(r) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${r === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${r === "up" ? 175 : r === "down" ? 174 : 173}) }`;
  try {
    return N("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const ve = {
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
function Ee(r) {
  if (typeof r != "string") return { ok: !1, error: "unknown" };
  const e = ve[r.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return O("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Te() {
  if (x && Date.now() - x.at < ge) return x.data;
  const r = be();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await ke();
    } catch {
    }
  const n = { ...r, ...e };
  return x = { at: Date.now(), data: n }, n;
}
async function _e(r) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: c = !0 } = r;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const a = { "Content-Type": "application/json" };
  if (c) {
    const i = Q();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    a.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${e}${n}`, {
      method: o,
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
let j = !0;
const Ae = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], De = "CommandOrControl+Alt+Shift+Q";
function Fe() {
  for (const r of Ae)
    try {
      E.isRegistered(r) && E.unregister(r);
    } catch {
    }
}
function b(r) {
  j = r, Fe();
}
function Re(r, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), c = () => {
      W.get(r, (p) => {
        p.statusCode === 200 ? n() : a();
      }).on("error", a);
    }, a = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(c, 300);
    };
    c();
  });
}
function X() {
  const { width: r, height: e } = Y.getPrimaryDisplay().workAreaSize, n = d.join(P, "preload.cjs");
  t = new J({
    width: r,
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
      preload: n,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1,
      // CRITICAL: Windows throttles hidden/occluded windows to ~1fps, which
      // stalls the always-listening audio loop. Senti has to keep hearing you
      // while it sits quietly in the corner, so throttling stays OFF.
      backgroundThrottling: !1
    }
  }), t.setVisibleOnAllWorkspaces(!0), t.setMenuBarVisibility(!1), t.setAlwaysOnTop(!0, "screen-saver"), _ ? t.loadURL(K).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : F ? t.loadURL(F).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), t.webContents.on("did-finish-load", () => {
    var o, s;
    t == null || t.show(), t == null || t.focus(), _ && ((s = (o = t == null ? void 0 : t.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
  }), t.webContents.on("did-fail-load", (o, s, c, a, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: c, validatedURL: a, isMainFrame: i });
  }), t.webContents.on("console-message", (o, s, c) => {
    const a = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${a}] ${c}`);
  }), t.webContents.on("render-process-gone", (o, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), t.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), t.on("close", (o) => {
    D || (o.preventDefault(), t == null || t.hide());
  });
}
u.requestSingleInstanceLock() ? u.on("second-instance", () => {
  t && !t.isDestroyed() && R();
}) : u.quit();
u.whenReady().then(async () => {
  if (_)
    try {
      await Re(K);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), u.quit();
      return;
    }
  const r = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (I.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(r(n));
  }), I.defaultSession.setPermissionCheckHandler((e, n) => r(n)), !_)
    try {
      F = await de(d.join(P, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), u.quit();
      return;
    }
  X(), b(!0);
  try {
    E.register(De, () => {
      j = !1, u.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && u.isPackaged && u.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
u.on("activate", () => {
  J.getAllWindows().length === 0 ? X() : (t == null || t.show(), t == null || t.focus());
});
u.on("window-all-closed", () => {
  D && process.platform !== "darwin" && u.quit();
});
u.on("before-quit", () => {
  D = !0;
});
u.on("before-quit", () => {
  t = null;
});
u.on("will-quit", () => {
  E.unregisterAll();
});
l.handle("senti:token-set", (r, e) => typeof e != "string" || !e.trim() ? !1 : pe(e.trim()));
l.handle("senti:token-clear", () => (fe(), !0));
l.handle("senti:token-present", () => !!Q());
l.on("senti:get-setup", (r) => {
  r.returnValue = he();
});
l.handle("senti:set-setup", (r, e) => (me(!!e), !0));
l.handle("senti:system-info", () => Te());
let g = null;
l.handle("senti:keep-awake", (r, e) => {
  try {
    return e && g === null ? g = L.start("prevent-display-sleep") : !e && g !== null && (L.stop(g), g = null), g !== null;
  } catch {
    return !1;
  }
});
l.handle("senti:open-app", (r, e) => we(e));
l.handle("senti:close-app", (r, e) => Ee(e));
l.handle("senti:clean-temp", () => Se());
l.handle("senti:lock-workstation", () => xe());
l.handle("senti:volume", (r, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? Ce(n) : !1;
});
l.handle("senti:api", (r, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : _e({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
l.handle("senti:get-platform", () => process.platform);
l.handle("senti:device-info", () => ({
  hostname: f.hostname(),
  platform: process.platform
}));
l.handle("senti:set-lock-state", (r, e) => {
  b(!!e);
});
let M = "signin", y = null, D = !1;
const C = 380, v = 132;
function G(r) {
  if (!t || t.isDestroyed()) return;
  const { workArea: e } = Y.getPrimaryDisplay();
  r ? t.setBounds({
    x: Math.round(e.x + (e.width - C) / 2),
    y: Math.round(e.y + (e.height - C) / 2 - e.height * 0.06),
    width: C,
    height: C
  }) : t.setBounds({
    x: Math.round(e.x + e.width - v - 18),
    y: Math.round(e.y + e.height - v - 18),
    width: v,
    height: v
  });
}
function S(r) {
  !t || t.isDestroyed() || (M = r, r === "hud" ? (b(!1), t.setFullScreen(!1), t.setResizable(!1), t.setSkipTaskbar(!0), t.setAlwaysOnTop(!0, "screen-saver"), t.setIgnoreMouseEvents(!0, { forward: !0 }), G(!1), t.showInactive()) : r === "setup" ? (b(!1), t.setIgnoreMouseEvents(!1), t.setAlwaysOnTop(!1), t.setFullScreen(!1), t.setResizable(!0), t.setSkipTaskbar(!1), t.setSize(980, 760), t.center(), t.show()) : r === "panel" ? (b(!1), t.setIgnoreMouseEvents(!1), t.setAlwaysOnTop(!1), t.setFullScreen(!1), t.setResizable(!1), t.setSkipTaskbar(!1), t.setSize(760, 840), t.center(), t.show(), t.focus()) : (b(!0), t.setIgnoreMouseEvents(!1), t.setFullScreen(!1), t.setAlwaysOnTop(!1), t.setResizable(!1), t.setSkipTaskbar(!1), t.setSize(680, 780), t.center(), t.show(), t.focus()));
}
function Be() {
  !t || t.isDestroyed() || M !== "hud" || (G(!0), t.showInactive(), t.setAlwaysOnTop(!0, "screen-saver"));
}
function Oe() {
  !t || t.isDestroyed() || M !== "hud" || G(!1);
}
function Pe() {
  const r = [
    d.join(process.resourcesPath || "", "build", "icon.png"),
    d.join(P, "..", "build", "icon.png")
  ];
  for (const e of r)
    try {
      if (w(e)) {
        const n = $.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return $.createEmpty();
}
function R() {
  !t || t.isDestroyed() || (t.webContents.send("senti:open-settings"), S("panel"), t.show(), t.focus());
}
function je() {
  if (!y)
    try {
      y = new ae(Pe()), y.setToolTip("Senti — listening for you"), y.setContextMenu(
        ie.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => R() },
          { label: "Sign in again", click: () => S("signin") },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              D = !0, u.quit();
            }
          }
        ])
      ), y.on("click", () => R());
    } catch {
    }
}
function Me(r) {
  S(r ? "setup" : "signin");
}
l.handle("senti:set-setup-mode", (r, e) => (Me(!!e), !0));
l.handle("senti:set-window-mode", (r, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (S(e), e === "hud" && je(), !0) : !1);
l.handle("senti:hud-show", () => (Be(), !0));
l.handle("senti:hud-hide", () => (Oe(), !0));
l.handle("senti:lock", () => {
  S("signin");
});
l.handle("senti:quit", () => j ? !1 : (u.quit(), !0));
