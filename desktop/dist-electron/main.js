import { existsSync as E, readFileSync as _, mkdirSync as B, writeFileSync as O, unlinkSync as q } from "fs";
import { execFile as z } from "child_process";
import A from "http";
import p from "os";
import M from "electron";
import f from "path";
import { fileURLToPath as N } from "url";
const { app: l, BrowserWindow: D, screen: m, ipcMain: u, globalShortcut: y, safeStorage: S, session: F } = M, H = N(import.meta.url), j = f.dirname(H), k = process.env.VITE_DEV_SERVER_URL, P = "http://localhost:5173";
let e = null, T = "", C = [];
const J = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
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
function G() {
  for (const t of C)
    try {
      t.isDestroyed() || (t.setClosable(!0), t.destroy());
    } catch {
    }
  C = [];
}
function Y() {
  G();
  const t = m.getPrimaryDisplay().id;
  for (const s of m.getAllDisplays())
    if (s.id !== t)
      try {
        const r = new D({
          x: s.bounds.x,
          y: s.bounds.y,
          width: s.bounds.width,
          height: s.bounds.height,
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
        r.setAlwaysOnTop(!0, "screen-saver"), r.setVisibleOnAllWorkspaces(!0), r.setBounds(s.bounds), r.loadURL(J), r.once("ready-to-show", () => {
          r.setBounds(s.bounds), r.showInactive(), r.moveTop();
        }), C.push(r);
      } catch {
      }
}
function w() {
  if (!g) {
    G();
    return;
  }
  const t = Math.max(0, m.getAllDisplays().length - 1);
  C.filter((r) => !r.isDestroyed()).length === t && t > 0 || Y();
}
const K = {
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
}, Q = 47615;
function W(t) {
  return new Promise((s, r) => {
    const o = A.createServer((a, i) => {
      try {
        let d = decodeURIComponent((a.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const L = f.normalize(d).replace(/^([/\\])+/, ""), b = f.join(t, L);
        if (!b.startsWith(t) || !E(b)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const V = _(b);
        i.writeHead(200, {
          "Content-Type": K[f.extname(b).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(V);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let n = Q, c = 0;
    o.on("error", (a) => {
      a.code === "EADDRINUSE" && c < 12 ? (c++, n++, setTimeout(() => o.listen(n, "127.0.0.1"), 40)) : r(a);
    }), o.on("listening", () => s(`http://127.0.0.1:${n}`)), o.listen(n, "127.0.0.1");
  });
}
const h = () => f.join(l.getPath("userData"), "device.token");
function X(t) {
  try {
    return B(f.dirname(h()), { recursive: !0 }), S.isEncryptionAvailable() ? (O(h(), S.encryptString(t)), !0) : !1;
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
function Z() {
  try {
    E(h()) && q(h());
  } catch {
  }
}
const x = () => f.join(l.getPath("userData"), "setup.json");
function ee() {
  var t;
  try {
    return E(x()) ? ((t = JSON.parse(_(x(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function te(t) {
  try {
    B(f.dirname(x()), { recursive: !0 }), O(x(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
let v = null;
const se = 2e4;
function re() {
  var o, n;
  const t = p.totalmem() / 1073741824, s = p.freemem() / 1024 ** 3, r = t - s;
  return {
    os: `${p.type()} ${p.release()}`,
    cpu: ((n = (o = p.cpus()[0]) == null ? void 0 : o.model) == null ? void 0 : n.trim()) ?? "unknown",
    cores: p.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +r.toFixed(1),
    ramUsedPct: Math.round(r / t * 100),
    uptimeHours: +(p.uptime() / 3600).toFixed(1)
  };
}
function oe() {
  const t = `
$ErrorActionPreference='SilentlyContinue'
$d = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
     ForEach-Object { [pscustomobject]@{ drive=$_.DeviceID; totalGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.FreeSpace/1GB,1) } }
$p = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 6 |
     ForEach-Object { [pscustomobject]@{ name=$_.ProcessName; memMB=[math]::Round($_.WorkingSet/1MB) } }
$s = (Get-CimInstance Win32_StartupCommand | Measure-Object).Count
[pscustomobject]@{ disks=@($d); topProcesses=@($p); startupApps=$s } | ConvertTo-Json -Compress -Depth 4
`;
  return new Promise((s) => {
    z(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", t],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (r, o) => {
        if (r || !o) return s({});
        try {
          const n = JSON.parse(o), c = (n.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          s({
            disks: c,
            topProcesses: n.topProcesses || [],
            startupApps: typeof n.startupApps == "number" ? n.startupApps : void 0
          });
        } catch {
          s({});
        }
      }
    );
  });
}
async function ne() {
  if (v && Date.now() - v.at < se) return v.data;
  const t = re();
  let s = {};
  if (process.platform === "win32")
    try {
      s = await oe();
    } catch {
    }
  const r = { ...t, ...s };
  return v = { at: Date.now(), data: r }, r;
}
async function ae(t) {
  const { baseUrl: s, path: r, method: o = "GET", body: n, auth: c = !0 } = t;
  if (!/^https?:\/\//i.test(s) || !r.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const a = { "Content-Type": "application/json" };
  if (c) {
    const i = I();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    a.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${s}${r}`, {
      method: o,
      headers: a,
      body: n === void 0 ? void 0 : JSON.stringify(n)
    }), d = await i.json().catch(() => null);
    return { ok: i.ok, status: i.status, data: d };
  } catch (i) {
    return {
      ok: !1,
      status: 0,
      data: { error: i instanceof Error ? i.message : "Network error" }
    };
  }
}
let g = !0;
const $ = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], ie = "CommandOrControl+Alt+Shift+Q";
function le() {
  for (const t of $)
    try {
      y.register(t, () => {
      });
    } catch {
    }
}
function ce() {
  for (const t of $)
    try {
      y.isRegistered(t) && y.unregister(t);
    } catch {
    }
}
function R(t) {
  g = t, t ? le() : ce(), w();
}
function ue(t, s = 15e3) {
  return new Promise((r, o) => {
    const n = Date.now(), c = () => {
      A.get(t, (d) => {
        d.statusCode === 200 ? r() : a();
      }).on("error", a);
    }, a = () => {
      Date.now() - n > s ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(c, 300);
    };
    c();
  });
}
function U() {
  const { width: t, height: s } = m.getPrimaryDisplay().workAreaSize, r = f.join(j, "preload.cjs");
  e = new D({
    width: t,
    height: s,
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
      preload: r,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), e.setAlwaysOnTop(!0, "screen-saver"), k ? e.loadURL(P).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : T ? e.loadURL(T).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), e.webContents.on("did-finish-load", () => {
    var o, n;
    e == null || e.show(), e == null || e.focus(), k && ((n = (o = e == null ? void 0 : e.webContents) == null ? void 0 : o.openDevTools) == null || n.call(o));
  }), e.webContents.on("did-fail-load", (o, n, c, a, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: n, errorDescription: c, validatedURL: a, isMainFrame: i });
  }), e.webContents.on("console-message", (o, n, c) => {
    const a = ["INFO", "WARN", "ERROR", "DEBUG"][n] || "LOG";
    console.log(`[Renderer:${a}] ${c}`);
  }), e.webContents.on("render-process-gone", (o, n) => {
    console.error("[Electron] Renderer process gone:", n);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (o) => {
    o.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("close", (o) => {
    g && (o.preventDefault(), e == null || e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function fe() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
l.requestSingleInstanceLock() ? l.on("second-instance", () => {
  e && !e.isDestroyed() && (e.show(), e.focus());
}) : l.quit();
l.whenReady().then(async () => {
  if (k)
    try {
      await ue(P);
    } catch (s) {
      console.error("[Electron] Vite dev server failed to start:", s), l.quit();
      return;
    }
  const t = (s) => s === "media" || s === "microphone" || s === "audioCapture";
  if (F.defaultSession.setPermissionRequestHandler((s, r, o) => {
    o(t(r));
  }), F.defaultSession.setPermissionCheckHandler((s, r) => t(r)), !k)
    try {
      T = await W(f.join(j, "../dist"));
    } catch (s) {
      console.error("[Electron] Failed to start static server:", s), l.quit();
      return;
    }
  U(), fe(), m.on("display-added", () => w()), m.on("display-removed", () => w()), m.on("display-metrics-changed", () => w()), R(!0);
  try {
    y.register(ie, () => {
      g = !1, l.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && l.isPackaged && l.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
l.on("activate", () => {
  D.getAllWindows().length === 0 ? U() : (e == null || e.show(), e == null || e.focus());
});
l.on("window-all-closed", () => {
  process.platform !== "darwin" && l.quit();
});
l.on("before-quit", () => {
  e = null;
});
l.on("will-quit", () => {
  y.unregisterAll();
});
u.handle("senti:token-set", (t, s) => typeof s != "string" || !s.trim() ? !1 : X(s.trim()));
u.handle("senti:token-clear", () => (Z(), !0));
u.handle("senti:token-present", () => !!I());
u.on("senti:get-setup", (t) => {
  t.returnValue = ee();
});
u.handle("senti:set-setup", (t, s) => (te(!!s), !0));
u.handle("senti:system-info", () => ne());
u.handle("senti:api", (t, s) => {
  const r = s ?? {};
  return typeof r.baseUrl != "string" || typeof r.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : ae({
    baseUrl: r.baseUrl,
    path: r.path,
    method: typeof r.method == "string" ? r.method : "GET",
    body: r.body,
    auth: r.auth !== !1
  });
});
u.handle("senti:get-platform", () => process.platform);
u.handle("senti:device-info", () => ({
  hostname: p.hostname(),
  platform: process.platform
}));
u.handle("senti:set-lock-state", (t, s) => {
  R(!!s);
});
function de(t) {
  !e || e.isDestroyed() || (t ? (R(!1), e.setAlwaysOnTop(!1), e.setFullScreen(!1), e.setResizable(!0), e.setSkipTaskbar(!1), e.setSize(980, 760), e.center()) : (e.setResizable(!1), e.setSkipTaskbar(!0), e.setAlwaysOnTop(!0, "screen-saver"), e.setFullScreen(!0), e.focus()));
}
u.handle("senti:set-setup-mode", (t, s) => (de(!!s), !0));
u.handle("senti:lock", () => {
  R(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
u.handle("senti:quit", () => g ? !1 : (l.quit(), !0));
