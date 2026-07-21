import { existsSync as T, readFileSync as D, mkdirSync as j, writeFileSync as L, unlinkSync as $, readdirSync as J, rmdirSync as W, statSync as Y } from "fs";
import { spawn as F, execFile as G } from "child_process";
import I from "http";
import f from "os";
import K from "electron";
import p from "path";
import { fileURLToPath as Q } from "url";
const { app: u, BrowserWindow: R, screen: m, ipcMain: c, globalShortcut: y, safeStorage: x, session: O, shell: X } = K, Z = Q(import.meta.url), U = p.dirname(Z), v = process.env.VITE_DEV_SERVER_URL, V = "http://localhost:5173";
let t = null, A = "", C = [];
const ee = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
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
function M() {
  for (const r of C)
    try {
      r.isDestroyed() || (r.setClosable(!0), r.destroy());
    } catch {
    }
  C = [];
}
function te() {
  M();
  const r = m.getPrimaryDisplay().id;
  for (const e of m.getAllDisplays())
    if (e.id !== r)
      try {
        const o = new R({
          x: e.bounds.x,
          y: e.bounds.y,
          width: e.bounds.width,
          height: e.bounds.height,
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
        o.setAlwaysOnTop(!0, "screen-saver"), o.setVisibleOnAllWorkspaces(!0), o.setBounds(e.bounds), o.loadURL(ee), o.once("ready-to-show", () => {
          o.setBounds(e.bounds), o.showInactive(), o.moveTop();
        }), C.push(o);
      } catch {
      }
}
function S() {
  if (!k) {
    M();
    return;
  }
  const r = Math.max(0, m.getAllDisplays().length - 1);
  C.filter((o) => !o.isDestroyed()).length === r && r > 0 || te();
}
const re = {
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
}, oe = 47615;
function se(r) {
  return new Promise((e, o) => {
    const s = I.createServer((a, i) => {
      try {
        let d = decodeURIComponent((a.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const h = p.normalize(d).replace(/^([/\\])+/, ""), g = p.join(r, h);
        if (!g.startsWith(r) || !T(g)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const H = D(g);
        i.writeHead(200, {
          "Content-Type": re[p.extname(g).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(H);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let n = oe, l = 0;
    s.on("error", (a) => {
      a.code === "EADDRINUSE" && l < 12 ? (l++, n++, setTimeout(() => s.listen(n, "127.0.0.1"), 40)) : o(a);
    }), s.on("listening", () => e(`http://127.0.0.1:${n}`)), s.listen(n, "127.0.0.1");
  });
}
const b = () => p.join(u.getPath("userData"), "device.token");
function ne(r) {
  try {
    return j(p.dirname(b()), { recursive: !0 }), x.isEncryptionAvailable() ? (L(b(), x.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function z() {
  try {
    return !T(b()) || !x.isEncryptionAvailable() ? null : x.decryptString(D(b()));
  } catch {
    return null;
  }
}
function ae() {
  try {
    T(b()) && $(b());
  } catch {
  }
}
const E = () => p.join(u.getPath("userData"), "setup.json");
function ie() {
  var r;
  try {
    return T(E()) ? ((r = JSON.parse(D(E(), "utf8"))) == null ? void 0 : r.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function le(r) {
  try {
    j(p.dirname(E()), { recursive: !0 }), L(E(), JSON.stringify({ setupCompleted: !!r }));
  } catch {
  }
}
let w = null;
const ce = 2e4;
function ue() {
  var s, n;
  const r = f.totalmem() / 1073741824, e = f.freemem() / 1024 ** 3, o = r - e;
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
function de() {
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
    G(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", r],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (o, s) => {
        if (o || !s) return e({});
        try {
          const n = JSON.parse(s), l = (n.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          e({
            disks: l,
            topProcesses: n.topProcesses || [],
            startupApps: typeof n.startupApps == "number" ? n.startupApps : void 0
          });
        } catch {
          e({});
        }
      }
    );
  });
}
const B = {
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
function pe(r) {
  if (typeof r != "string") return null;
  const e = r.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? B[e] ? B[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
function fe(r) {
  const e = pe(r);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.kind === "url" ? X.openExternal(e.target) : F("cmd", ["/c", "start", "", e.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const P = 2e4;
function me() {
  const r = [f.tmpdir(), p.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let o = 0, s = 0;
  const n = (l, a) => {
    if (a > 6 || Date.now() - e > P || !/temp/i.test(l)) return;
    let i;
    try {
      i = J(l, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of i) {
      if (Date.now() - e > P) return;
      const h = p.join(l, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          n(h, a + 1);
          try {
            W(h);
          } catch {
          }
        } else if (d.isFile()) {
          const g = Y(h).size;
          $(h), o += g, s++;
        }
      } catch {
      }
    }
  };
  for (const l of r) n(l, 0);
  return { freedMB: Math.round(o / 1024 / 1024), files: s };
}
function he() {
  try {
    return F("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function ge(r) {
  const s = `$w = New-Object -ComObject WScript.Shell; 1..${r === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${r === "up" ? 175 : r === "down" ? 174 : 173}) }`;
  try {
    return G("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", s], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const be = {
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
function ye(r) {
  if (typeof r != "string") return { ok: !1, error: "unknown" };
  const e = be[r.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return F("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function ke() {
  if (w && Date.now() - w.at < ce) return w.data;
  const r = ue();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await de();
    } catch {
    }
  const o = { ...r, ...e };
  return w = { at: Date.now(), data: o }, o;
}
async function we(r) {
  const { baseUrl: e, path: o, method: s = "GET", body: n, auth: l = !0 } = r;
  if (!/^https?:\/\//i.test(e) || !o.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const a = { "Content-Type": "application/json" };
  if (l) {
    const i = z();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    a.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${e}${o}`, {
      method: s,
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
let k = !0;
const N = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Se = "CommandOrControl+Alt+Shift+Q";
function xe() {
  for (const r of N)
    try {
      y.register(r, () => {
      });
    } catch {
    }
}
function ve() {
  for (const r of N)
    try {
      y.isRegistered(r) && y.unregister(r);
    } catch {
    }
}
function _(r) {
  k = r, r ? xe() : ve(), S();
}
function Ce(r, e = 15e3) {
  return new Promise((o, s) => {
    const n = Date.now(), l = () => {
      I.get(r, (d) => {
        d.statusCode === 200 ? o() : a();
      }).on("error", a);
    }, a = () => {
      Date.now() - n > e ? s(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(l, 300);
    };
    l();
  });
}
function q() {
  const { width: r, height: e } = m.getPrimaryDisplay().workAreaSize, o = p.join(U, "preload.cjs");
  t = new R({
    width: r,
    height: e,
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
  }), t.setVisibleOnAllWorkspaces(!0), t.setMenuBarVisibility(!1), t.setAlwaysOnTop(!0, "screen-saver"), v ? t.loadURL(V).catch((s) => {
    console.error("[Electron] Failed to load dev server:", s.message);
  }) : A ? t.loadURL(A).catch((s) => {
    console.error("[Electron] Failed to load prod server:", s.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), t.webContents.on("did-finish-load", () => {
    var s, n;
    t == null || t.show(), t == null || t.focus(), v && ((n = (s = t == null ? void 0 : t.webContents) == null ? void 0 : s.openDevTools) == null || n.call(s));
  }), t.webContents.on("did-fail-load", (s, n, l, a, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: n, errorDescription: l, validatedURL: a, isMainFrame: i });
  }), t.webContents.on("console-message", (s, n, l) => {
    const a = ["INFO", "WARN", "ERROR", "DEBUG"][n] || "LOG";
    console.log(`[Renderer:${a}] ${l}`);
  }), t.webContents.on("render-process-gone", (s, n) => {
    console.error("[Electron] Renderer process gone:", n);
  }), t.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), t.on("blur", () => {
    t && !t.isDestroyed() && t.focus();
  }), t.on("minimize", (s) => {
    s.preventDefault(), t && (t.restore(), t.focus());
  }), t.on("close", (s) => {
    k && (s.preventDefault(), t == null || t.focus());
  }), t.on("leave-full-screen", () => {
    t && t.setFullScreen(!0);
  });
}
function Ee() {
  setInterval(() => {
    t && !t.isDestroyed() && (!t.isFocused() && t.isVisible() && t.focus(), t.isFullScreen() || t.setFullScreen(!0));
  }, 500);
}
u.requestSingleInstanceLock() ? u.on("second-instance", () => {
  t && !t.isDestroyed() && (t.show(), t.focus());
}) : u.quit();
u.whenReady().then(async () => {
  if (v)
    try {
      await Ce(V);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), u.quit();
      return;
    }
  const r = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (O.defaultSession.setPermissionRequestHandler((e, o, s) => {
    s(r(o));
  }), O.defaultSession.setPermissionCheckHandler((e, o) => r(o)), !v)
    try {
      A = await se(p.join(U, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), u.quit();
      return;
    }
  q(), Ee(), m.on("display-added", () => S()), m.on("display-removed", () => S()), m.on("display-metrics-changed", () => S()), _(!0);
  try {
    y.register(Se, () => {
      k = !1, u.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && u.isPackaged && u.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
u.on("activate", () => {
  R.getAllWindows().length === 0 ? q() : (t == null || t.show(), t == null || t.focus());
});
u.on("window-all-closed", () => {
  process.platform !== "darwin" && u.quit();
});
u.on("before-quit", () => {
  t = null;
});
u.on("will-quit", () => {
  y.unregisterAll();
});
c.handle("senti:token-set", (r, e) => typeof e != "string" || !e.trim() ? !1 : ne(e.trim()));
c.handle("senti:token-clear", () => (ae(), !0));
c.handle("senti:token-present", () => !!z());
c.on("senti:get-setup", (r) => {
  r.returnValue = ie();
});
c.handle("senti:set-setup", (r, e) => (le(!!e), !0));
c.handle("senti:system-info", () => ke());
c.handle("senti:open-app", (r, e) => fe(e));
c.handle("senti:close-app", (r, e) => ye(e));
c.handle("senti:clean-temp", () => me());
c.handle("senti:lock-workstation", () => he());
c.handle("senti:volume", (r, e) => {
  const o = e === "up" || e === "down" || e === "mute" ? e : null;
  return o ? ge(o) : !1;
});
c.handle("senti:api", (r, e) => {
  const o = e ?? {};
  return typeof o.baseUrl != "string" || typeof o.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : we({
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
c.handle("senti:set-lock-state", (r, e) => {
  _(!!e);
});
function Te(r) {
  !t || t.isDestroyed() || (r ? (_(!1), t.setAlwaysOnTop(!1), t.setFullScreen(!1), t.setResizable(!0), t.setSkipTaskbar(!1), t.setSize(980, 760), t.center()) : (t.setResizable(!1), t.setSkipTaskbar(!0), t.setAlwaysOnTop(!0, "screen-saver"), t.setFullScreen(!0), t.focus()));
}
c.handle("senti:set-setup-mode", (r, e) => (Te(!!e), !0));
c.handle("senti:lock", () => {
  _(!0), t == null || t.show(), t == null || t.focus(), t == null || t.setFullScreen(!0);
});
c.handle("senti:quit", () => k ? !1 : (u.quit(), !0));
