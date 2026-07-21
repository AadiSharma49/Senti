import { existsSync as E, readFileSync as _, mkdirSync as P, writeFileSync as B, unlinkSync as M } from "fs";
import { spawn as q, execFile as H } from "child_process";
import O from "http";
import f from "os";
import N from "electron";
import d from "path";
import { fileURLToPath as J } from "url";
const { app: l, BrowserWindow: A, screen: m, ipcMain: c, globalShortcut: g, safeStorage: S, session: F, shell: Y } = N, K = J(import.meta.url), G = d.dirname(K), x = process.env.VITE_DEV_SERVER_URL, j = "http://localhost:5173";
let e = null, R = "", v = [];
const Q = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#070a0e;overflow:hidden;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;cursor:none}
  .w{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
  .orb{width:74px;height:74px;border-radius:50%;border:2px solid rgba(0,212,255,.55);
    box-shadow:0 0 34px rgba(0,212,255,.28) inset,0 0 44px rgba(0,212,255,.16);
    animation:p 2.6s ease-in-out infinite}
  @keyframes p{0%,100%{transform:scale(.94);opacity:.6}50%{transform:scale(1.04);opacity:1}}
  .t{color:#7e93a6;font-size:12px;letter-spacing:.34em;text-transform:uppercase}
</style></head><body><div class="w"><div class="orb"></div>
<div class="t">Locked by Senti</div></div></body></html>`);
function $() {
  for (const r of v)
    try {
      r.isDestroyed() || (r.setClosable(!0), r.destroy());
    } catch {
    }
  v = [];
}
function W() {
  $();
  const r = m.getPrimaryDisplay().id;
  for (const t of m.getAllDisplays())
    if (t.id !== r)
      try {
        const o = new A({
          x: t.bounds.x,
          y: t.bounds.y,
          width: t.bounds.width,
          height: t.bounds.height,
          frame: !1,
          resizable: !1,
          movable: !1,
          minimizable: !1,
          maximizable: !1,
          closable: !1,
          // Never take keyboard focus — the PIN box on the primary lock keeps it.
          focusable: !1,
          skipTaskbar: !0,
          alwaysOnTop: !0,
          // NOT fullscreen: on Windows `fullscreen:true` goes fullscreen on the
          // PRIMARY display (behind the lock), not the target monitor. Exact
          // bounds cover the whole second screen, taskbar included.
          enableLargerThanScreen: !0,
          backgroundColor: "#070a0e",
          show: !1,
          webPreferences: { contextIsolation: !0, nodeIntegration: !1 }
        });
        o.setAlwaysOnTop(!0, "screen-saver"), o.setVisibleOnAllWorkspaces(!0), o.setBounds(t.bounds), o.loadURL(Q), o.once("ready-to-show", () => {
          o.setBounds(t.bounds), o.showInactive(), o.moveTop();
        }), v.push(o);
      } catch {
      }
}
function w() {
  if (!b) {
    $();
    return;
  }
  const r = Math.max(0, m.getAllDisplays().length - 1);
  v.filter((o) => !o.isDestroyed()).length === r && r > 0 || W();
}
const X = {
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
}, Z = 47615;
function ee(r) {
  return new Promise((t, o) => {
    const s = O.createServer((a, i) => {
      try {
        let p = decodeURIComponent((a.url || "/").split("?")[0]);
        (p === "/" || p === "") && (p = "/index.html");
        const V = d.normalize(p).replace(/^([/\\])+/, ""), y = d.join(r, V);
        if (!y.startsWith(r) || !E(y)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const z = _(y);
        i.writeHead(200, {
          "Content-Type": X[d.extname(y).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(z);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let n = Z, u = 0;
    s.on("error", (a) => {
      a.code === "EADDRINUSE" && u < 12 ? (u++, n++, setTimeout(() => s.listen(n, "127.0.0.1"), 40)) : o(a);
    }), s.on("listening", () => t(`http://127.0.0.1:${n}`)), s.listen(n, "127.0.0.1");
  });
}
const h = () => d.join(l.getPath("userData"), "device.token");
function te(r) {
  try {
    return P(d.dirname(h()), { recursive: !0 }), S.isEncryptionAvailable() ? (B(h(), S.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function I() {
  try {
    return !E(h()) || !S.isEncryptionAvailable() ? null : S.decryptString(_(h()));
  } catch {
    return null;
  }
}
function re() {
  try {
    E(h()) && M(h());
  } catch {
  }
}
const C = () => d.join(l.getPath("userData"), "setup.json");
function oe() {
  var r;
  try {
    return E(C()) ? ((r = JSON.parse(_(C(), "utf8"))) == null ? void 0 : r.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function se(r) {
  try {
    P(d.dirname(C()), { recursive: !0 }), B(C(), JSON.stringify({ setupCompleted: !!r }));
  } catch {
  }
}
let k = null;
const ne = 2e4;
function ae() {
  var s, n;
  const r = f.totalmem() / 1073741824, t = f.freemem() / 1024 ** 3, o = r - t;
  return {
    os: `${f.type()} ${f.release()}`,
    cpu: ((n = (s = f.cpus()[0]) == null ? void 0 : s.model) == null ? void 0 : n.trim()) ?? "unknown",
    cores: f.cpus().length,
    ramTotalGB: +r.toFixed(1),
    ramUsedGB: +o.toFixed(1),
    ramUsedPct: Math.round(o / r * 100),
    uptimeHours: +(f.uptime() / 3600).toFixed(1)
  };
}
function ie() {
  const r = `
$ErrorActionPreference='SilentlyContinue'
$d = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
     ForEach-Object { [pscustomobject]@{ drive=$_.DeviceID; totalGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.FreeSpace/1GB,1) } }
$p = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 6 |
     ForEach-Object { [pscustomobject]@{ name=$_.ProcessName; memMB=[math]::Round($_.WorkingSet/1MB) } }
$s = (Get-CimInstance Win32_StartupCommand | Measure-Object).Count
[pscustomobject]@{ disks=@($d); topProcesses=@($p); startupApps=$s } | ConvertTo-Json -Compress -Depth 4
`;
  return new Promise((t) => {
    H(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", r],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (o, s) => {
        if (o || !s) return t({});
        try {
          const n = JSON.parse(s), u = (n.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          t({
            disks: u,
            topProcesses: n.topProcesses || [],
            startupApps: typeof n.startupApps == "number" ? n.startupApps : void 0
          });
        } catch {
          t({});
        }
      }
    );
  });
}
const D = {
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
function le(r) {
  if (typeof r != "string") return null;
  const t = r.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return t ? D[t] ? D[t] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(t) ? { kind: "url", target: `https://${t}`, label: t } : null : null;
}
function ce(r) {
  const t = le(r);
  if (!t) return { ok: !1, error: "unknown" };
  try {
    return t.kind === "url" ? Y.openExternal(t.target) : q("cmd", ["/c", "start", "", t.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: t.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
async function ue() {
  if (k && Date.now() - k.at < ne) return k.data;
  const r = ae();
  let t = {};
  if (process.platform === "win32")
    try {
      t = await ie();
    } catch {
    }
  const o = { ...r, ...t };
  return k = { at: Date.now(), data: o }, o;
}
async function de(r) {
  const { baseUrl: t, path: o, method: s = "GET", body: n, auth: u = !0 } = r;
  if (!/^https?:\/\//i.test(t) || !o.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const a = { "Content-Type": "application/json" };
  if (u) {
    const i = I();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    a.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${t}${o}`, {
      method: s,
      headers: a,
      body: n === void 0 ? void 0 : JSON.stringify(n)
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
let b = !0;
const L = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], pe = "CommandOrControl+Alt+Shift+Q";
function fe() {
  for (const r of L)
    try {
      g.register(r, () => {
      });
    } catch {
    }
}
function me() {
  for (const r of L)
    try {
      g.isRegistered(r) && g.unregister(r);
    } catch {
    }
}
function T(r) {
  b = r, r ? fe() : me(), w();
}
function he(r, t = 15e3) {
  return new Promise((o, s) => {
    const n = Date.now(), u = () => {
      O.get(r, (p) => {
        p.statusCode === 200 ? o() : a();
      }).on("error", a);
    }, a = () => {
      Date.now() - n > t ? s(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(u, 300);
    };
    u();
  });
}
function U() {
  const { width: r, height: t } = m.getPrimaryDisplay().workAreaSize, o = d.join(G, "preload.cjs");
  e = new A({
    width: r,
    height: t,
    fullscreen: !0,
    frame: !1,
    transparent: !1,
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
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), e.setAlwaysOnTop(!0, "screen-saver"), x ? e.loadURL(j).catch((s) => {
    console.error("[Electron] Failed to load dev server:", s.message);
  }) : R ? e.loadURL(R).catch((s) => {
    console.error("[Electron] Failed to load prod server:", s.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), e.webContents.on("did-finish-load", () => {
    var s, n;
    e == null || e.show(), e == null || e.focus(), x && ((n = (s = e == null ? void 0 : e.webContents) == null ? void 0 : s.openDevTools) == null || n.call(s));
  }), e.webContents.on("did-fail-load", (s, n, u, a, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: n, errorDescription: u, validatedURL: a, isMainFrame: i });
  }), e.webContents.on("console-message", (s, n, u) => {
    const a = ["INFO", "WARN", "ERROR", "DEBUG"][n] || "LOG";
    console.log(`[Renderer:${a}] ${u}`);
  }), e.webContents.on("render-process-gone", (s, n) => {
    console.error("[Electron] Renderer process gone:", n);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (s) => {
    s.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("close", (s) => {
    b && (s.preventDefault(), e == null || e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function ge() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
l.requestSingleInstanceLock() ? l.on("second-instance", () => {
  e && !e.isDestroyed() && (e.show(), e.focus());
}) : l.quit();
l.whenReady().then(async () => {
  if (x)
    try {
      await he(j);
    } catch (t) {
      console.error("[Electron] Vite dev server failed to start:", t), l.quit();
      return;
    }
  const r = (t) => t === "media" || t === "microphone" || t === "audioCapture";
  if (F.defaultSession.setPermissionRequestHandler((t, o, s) => {
    s(r(o));
  }), F.defaultSession.setPermissionCheckHandler((t, o) => r(o)), !x)
    try {
      R = await ee(d.join(G, "../dist"));
    } catch (t) {
      console.error("[Electron] Failed to start static server:", t), l.quit();
      return;
    }
  U(), ge(), m.on("display-added", () => w()), m.on("display-removed", () => w()), m.on("display-metrics-changed", () => w()), T(!0);
  try {
    g.register(pe, () => {
      b = !1, l.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && l.isPackaged && l.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
l.on("activate", () => {
  A.getAllWindows().length === 0 ? U() : (e == null || e.show(), e == null || e.focus());
});
l.on("window-all-closed", () => {
  process.platform !== "darwin" && l.quit();
});
l.on("before-quit", () => {
  e = null;
});
l.on("will-quit", () => {
  g.unregisterAll();
});
c.handle("senti:token-set", (r, t) => typeof t != "string" || !t.trim() ? !1 : te(t.trim()));
c.handle("senti:token-clear", () => (re(), !0));
c.handle("senti:token-present", () => !!I());
c.on("senti:get-setup", (r) => {
  r.returnValue = oe();
});
c.handle("senti:set-setup", (r, t) => (se(!!t), !0));
c.handle("senti:system-info", () => ue());
c.handle("senti:open-app", (r, t) => ce(t));
c.handle("senti:api", (r, t) => {
  const o = t ?? {};
  return typeof o.baseUrl != "string" || typeof o.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : de({
    baseUrl: o.baseUrl,
    path: o.path,
    method: typeof o.method == "string" ? o.method : "GET",
    body: o.body,
    auth: o.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: f.hostname(),
  platform: process.platform
}));
c.handle("senti:set-lock-state", (r, t) => {
  T(!!t);
});
function be(r) {
  !e || e.isDestroyed() || (r ? (T(!1), e.setAlwaysOnTop(!1), e.setFullScreen(!1), e.setResizable(!0), e.setSkipTaskbar(!1), e.setSize(980, 760), e.center()) : (e.setResizable(!1), e.setSkipTaskbar(!0), e.setAlwaysOnTop(!0, "screen-saver"), e.setFullScreen(!0), e.focus()));
}
c.handle("senti:set-setup-mode", (r, t) => (be(!!t), !0));
c.handle("senti:lock", () => {
  T(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
c.handle("senti:quit", () => b ? !1 : (l.quit(), !0));
