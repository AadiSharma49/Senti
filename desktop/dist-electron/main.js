import { existsSync as S, readFileSync as O, mkdirSync as V, writeFileSync as H, unlinkSync as q, readdirSync as oe, rmdirSync as se, statSync as ne } from "fs";
import { spawn as P, execFile as N } from "child_process";
import W from "http";
import p from "os";
import ae from "electron";
import d from "path";
import { fileURLToPath as ie } from "url";
const { app: u, BrowserWindow: j, screen: h, ipcMain: l, globalShortcut: w, safeStorage: T, session: I, shell: le, Tray: ce, Menu: ue, nativeImage: $ } = ae, de = ie(import.meta.url), B = d.dirname(de), E = process.env.VITE_DEV_SERVER_URL, J = "http://localhost:5173";
let e = null, _ = "", D = [];
const fe = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
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
function Y() {
  for (const r of D)
    try {
      r.isDestroyed() || (r.setClosable(!0), r.destroy());
    } catch {
    }
  D = [];
}
function pe() {
  Y();
  const r = h.getPrimaryDisplay().id;
  for (const t of h.getAllDisplays())
    if (t.id !== r)
      try {
        const o = new j({
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
        o.setAlwaysOnTop(!0, "screen-saver"), o.setVisibleOnAllWorkspaces(!0), o.setBounds(t.bounds), o.loadURL(fe), o.once("ready-to-show", () => {
          o.setBounds(t.bounds), o.showInactive(), o.moveTop();
        }), D.push(o);
      } catch {
      }
}
function C() {
  if (!x) {
    Y();
    return;
  }
  const r = Math.max(0, h.getAllDisplays().length - 1);
  D.filter((o) => !o.isDestroyed()).length === r && r > 0 || pe();
}
const he = {
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
}, me = 47615;
function ge(r) {
  return new Promise((t, o) => {
    const s = W.createServer((a, i) => {
      try {
        let f = decodeURIComponent((a.url || "/").split("?")[0]);
        (f === "/" || f === "") && (f = "/index.html");
        const g = d.normalize(f).replace(/^([/\\])+/, ""), y = d.join(r, g);
        if (!y.startsWith(r) || !S(y)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const re = O(y);
        i.writeHead(200, {
          "Content-Type": he[d.extname(y).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(re);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let n = me, c = 0;
    s.on("error", (a) => {
      a.code === "EADDRINUSE" && c < 12 ? (c++, n++, setTimeout(() => s.listen(n, "127.0.0.1"), 40)) : o(a);
    }), s.on("listening", () => t(`http://127.0.0.1:${n}`)), s.listen(n, "127.0.0.1");
  });
}
const b = () => d.join(u.getPath("userData"), "device.token");
function ye(r) {
  try {
    return V(d.dirname(b()), { recursive: !0 }), T.isEncryptionAvailable() ? (H(b(), T.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function K() {
  try {
    return !S(b()) || !T.isEncryptionAvailable() ? null : T.decryptString(O(b()));
  } catch {
    return null;
  }
}
function be() {
  try {
    S(b()) && q(b());
  } catch {
  }
}
const A = () => d.join(u.getPath("userData"), "setup.json");
function ke() {
  var r;
  try {
    return S(A()) ? ((r = JSON.parse(O(A(), "utf8"))) == null ? void 0 : r.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function we(r) {
  try {
    V(d.dirname(A()), { recursive: !0 }), H(A(), JSON.stringify({ setupCompleted: !!r }));
  } catch {
  }
}
let v = null;
const Se = 2e4;
function xe() {
  var s, n;
  const r = p.totalmem() / 1073741824, t = p.freemem() / 1024 ** 3, o = r - t;
  return {
    os: `${p.type()} ${p.release()}`,
    cpu: ((n = (s = p.cpus()[0]) == null ? void 0 : s.model) == null ? void 0 : n.trim()) ?? "unknown",
    cores: p.cpus().length,
    ramTotalGB: +r.toFixed(1),
    ramUsedGB: +o.toFixed(1),
    ramUsedPct: Math.round(o / r * 100),
    uptimeHours: +(p.uptime() / 3600).toFixed(1)
  };
}
function ve() {
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
    N(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", r],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (o, s) => {
        if (o || !s) return t({});
        try {
          const n = JSON.parse(s), c = (n.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          t({
            disks: c,
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
const G = {
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
function Ce(r) {
  if (typeof r != "string") return null;
  const t = r.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return t ? G[t] ? G[t] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(t) ? { kind: "url", target: `https://${t}`, label: t } : null : null;
}
function Te(r) {
  const t = Ce(r);
  if (!t) return { ok: !1, error: "unknown" };
  try {
    return t.kind === "url" ? le.openExternal(t.target) : P("cmd", ["/c", "start", "", t.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: t.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const M = 2e4;
function Ee() {
  const r = [p.tmpdir(), d.join(process.env.SystemRoot || "C:\\Windows", "Temp")], t = Date.now();
  let o = 0, s = 0;
  const n = (c, a) => {
    if (a > 6 || Date.now() - t > M || !/temp/i.test(c)) return;
    let i;
    try {
      i = oe(c, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of i) {
      if (Date.now() - t > M) return;
      const g = d.join(c, f.name);
      try {
        if (f.isSymbolicLink()) continue;
        if (f.isDirectory()) {
          n(g, a + 1);
          try {
            se(g);
          } catch {
          }
        } else if (f.isFile()) {
          const y = ne(g).size;
          q(g), o += y, s++;
        }
      } catch {
      }
    }
  };
  for (const c of r) n(c, 0);
  return { freedMB: Math.round(o / 1024 / 1024), files: s };
}
function De() {
  try {
    return P("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Ae(r) {
  const s = `$w = New-Object -ComObject WScript.Shell; 1..${r === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${r === "up" ? 175 : r === "down" ? 174 : 173}) }`;
  try {
    return N("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", s], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const Fe = {
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
function _e(r) {
  if (typeof r != "string") return { ok: !1, error: "unknown" };
  const t = Fe[r.toLowerCase().trim()];
  if (!t) return { ok: !1, error: "unknown" };
  try {
    return P("taskkill", ["/IM", t.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: t.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Re() {
  if (v && Date.now() - v.at < Se) return v.data;
  const r = xe();
  let t = {};
  if (process.platform === "win32")
    try {
      t = await ve();
    } catch {
    }
  const o = { ...r, ...t };
  return v = { at: Date.now(), data: o }, o;
}
async function Oe(r) {
  const { baseUrl: t, path: o, method: s = "GET", body: n, auth: c = !0 } = r;
  if (!/^https?:\/\//i.test(t) || !o.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const a = { "Content-Type": "application/json" };
  if (c) {
    const i = K();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    a.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${t}${o}`, {
      method: s,
      headers: a,
      body: n === void 0 ? void 0 : JSON.stringify(n)
    }), f = await i.json().catch(() => null);
    return { ok: i.ok, status: i.status, data: f };
  } catch (i) {
    return {
      ok: !1,
      status: 0,
      data: { error: i instanceof Error ? i.message : "Network error" }
    };
  }
}
let x = !0;
const Q = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Pe = "CommandOrControl+Alt+Shift+Q";
function je() {
  for (const r of Q)
    try {
      w.register(r, () => {
      });
    } catch {
    }
}
function Be() {
  for (const r of Q)
    try {
      w.isRegistered(r) && w.unregister(r);
    } catch {
    }
}
function m(r) {
  x = r, r ? je() : Be(), C();
}
function Le(r, t = 15e3) {
  return new Promise((o, s) => {
    const n = Date.now(), c = () => {
      W.get(r, (f) => {
        f.statusCode === 200 ? o() : a();
      }).on("error", a);
    }, a = () => {
      Date.now() - n > t ? s(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(c, 300);
    };
    c();
  });
}
function X() {
  const { width: r, height: t } = h.getPrimaryDisplay().workAreaSize, o = d.join(B, "preload.cjs");
  e = new j({
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
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), e.setAlwaysOnTop(!0, "screen-saver"), E ? e.loadURL(J).catch((s) => {
    console.error("[Electron] Failed to load dev server:", s.message);
  }) : _ ? e.loadURL(_).catch((s) => {
    console.error("[Electron] Failed to load prod server:", s.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), e.webContents.on("did-finish-load", () => {
    var s, n;
    e == null || e.show(), e == null || e.focus(), E && ((n = (s = e == null ? void 0 : e.webContents) == null ? void 0 : s.openDevTools) == null || n.call(s));
  }), e.webContents.on("did-fail-load", (s, n, c, a, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: n, errorDescription: c, validatedURL: a, isMainFrame: i });
  }), e.webContents.on("console-message", (s, n, c) => {
    const a = ["INFO", "WARN", "ERROR", "DEBUG"][n] || "LOG";
    console.log(`[Renderer:${a}] ${c}`);
  }), e.webContents.on("render-process-gone", (s, n) => {
    console.error("[Electron] Renderer process gone:", n);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (s) => {
    s.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("close", (s) => {
    if (x) {
      s.preventDefault(), e == null || e.focus();
      return;
    }
    F || (s.preventDefault(), te());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function Ie() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
u.requestSingleInstanceLock() ? u.on("second-instance", () => {
  e && !e.isDestroyed() && (e.show(), e.focus());
}) : u.quit();
u.whenReady().then(async () => {
  if (E)
    try {
      await Le(J);
    } catch (t) {
      console.error("[Electron] Vite dev server failed to start:", t), u.quit();
      return;
    }
  const r = (t) => t === "media" || t === "microphone" || t === "audioCapture";
  if (I.defaultSession.setPermissionRequestHandler((t, o, s) => {
    s(r(o));
  }), I.defaultSession.setPermissionCheckHandler((t, o) => r(o)), !E)
    try {
      _ = await ge(d.join(B, "../dist"));
    } catch (t) {
      console.error("[Electron] Failed to start static server:", t), u.quit();
      return;
    }
  X(), Ie(), h.on("display-added", () => C()), h.on("display-removed", () => C()), h.on("display-metrics-changed", () => C()), m(!0);
  try {
    w.register(Pe, () => {
      x = !1, u.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && u.isPackaged && u.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
u.on("activate", () => {
  j.getAllWindows().length === 0 ? X() : (e == null || e.show(), e == null || e.focus());
});
u.on("window-all-closed", () => {
  F && process.platform !== "darwin" && u.quit();
});
u.on("before-quit", () => {
  F = !0;
});
u.on("before-quit", () => {
  e = null;
});
u.on("will-quit", () => {
  w.unregisterAll();
});
l.handle("senti:token-set", (r, t) => typeof t != "string" || !t.trim() ? !1 : ye(t.trim()));
l.handle("senti:token-clear", () => (be(), !0));
l.handle("senti:token-present", () => !!K());
l.on("senti:get-setup", (r) => {
  r.returnValue = ke();
});
l.handle("senti:set-setup", (r, t) => (we(!!t), !0));
l.handle("senti:system-info", () => Re());
l.handle("senti:open-app", (r, t) => Te(t));
l.handle("senti:close-app", (r, t) => _e(t));
l.handle("senti:clean-temp", () => Ee());
l.handle("senti:lock-workstation", () => De());
l.handle("senti:volume", (r, t) => {
  const o = t === "up" || t === "down" || t === "mute" ? t : null;
  return o ? Ae(o) : !1;
});
l.handle("senti:api", (r, t) => {
  const o = t ?? {};
  return typeof o.baseUrl != "string" || typeof o.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Oe({
    baseUrl: o.baseUrl,
    path: o.path,
    method: typeof o.method == "string" ? o.method : "GET",
    body: o.body,
    auth: o.auth !== !1
  });
});
l.handle("senti:get-platform", () => process.platform);
l.handle("senti:device-info", () => ({
  hostname: p.hostname(),
  platform: process.platform
}));
l.handle("senti:set-lock-state", (r, t) => {
  m(!!t);
});
let L = "lock", k = null, F = !1;
const z = 420, U = 150;
function Z() {
  if (!e || e.isDestroyed()) return;
  const { workArea: r } = h.getPrimaryDisplay();
  e.setBounds({
    x: r.x + r.width - z - 24,
    y: r.y + r.height - U - 24,
    width: z,
    height: U
  });
}
function ee(r) {
  !e || e.isDestroyed() || (L = r, r === "hud" ? (m(!1), e.setFullScreen(!1), e.setResizable(!1), e.setSkipTaskbar(!0), e.setAlwaysOnTop(!0, "screen-saver"), Z(), e.hide()) : r === "setup" ? (m(!1), e.setAlwaysOnTop(!1), e.setFullScreen(!1), e.setResizable(!0), e.setSkipTaskbar(!1), e.setSize(980, 760), e.center(), e.show()) : (m(!0), e.setResizable(!1), e.setSkipTaskbar(!0), e.setAlwaysOnTop(!0, "screen-saver"), e.setFullScreen(!0), e.show(), e.focus()));
}
function R() {
  !e || e.isDestroyed() || L !== "hud" || (Z(), e.showInactive(), e.setAlwaysOnTop(!0, "screen-saver"));
}
function te() {
  !e || e.isDestroyed() || L !== "hud" || e.hide();
}
function $e() {
  const r = [
    d.join(process.resourcesPath || "", "build", "icon.png"),
    d.join(B, "..", "build", "icon.png")
  ];
  for (const t of r)
    try {
      if (S(t)) {
        const o = $.createFromPath(t);
        if (!o.isEmpty()) return o.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return $.createEmpty();
}
function Ge() {
  if (!k)
    try {
      k = new ce($e()), k.setToolTip("Senti — listening for you"), k.setContextMenu(
        ue.buildFromTemplate([
          { label: "Lock now", click: () => ee("lock") },
          { label: "Show Senti", click: () => R() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              F = !0, u.quit();
            }
          }
        ])
      ), k.on("click", () => R());
    } catch {
    }
}
function Me(r) {
  !e || e.isDestroyed() || (r ? (m(!1), e.setAlwaysOnTop(!1), e.setFullScreen(!1), e.setResizable(!0), e.setSkipTaskbar(!1), e.setSize(980, 760), e.center()) : (e.setResizable(!1), e.setSkipTaskbar(!0), e.setAlwaysOnTop(!0, "screen-saver"), e.setFullScreen(!0), e.focus()));
}
l.handle("senti:set-setup-mode", (r, t) => (Me(!!t), !0));
l.handle("senti:set-window-mode", (r, t) => t === "lock" || t === "setup" || t === "hud" ? (ee(t), t === "hud" && Ge(), !0) : !1);
l.handle("senti:hud-show", () => (R(), !0));
l.handle("senti:hud-hide", () => (te(), !0));
l.handle("senti:lock", () => {
  m(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
l.handle("senti:quit", () => x ? !1 : (u.quit(), !0));
