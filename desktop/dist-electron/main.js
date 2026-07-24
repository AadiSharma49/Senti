import { existsSync as k, readFileSync as O, mkdirSync as P, writeFileSync as j, unlinkSync as J, readdirSync as oe, rmdirSync as se, statSync as ae } from "fs";
import { spawn as I, execFileSync as ie, execFile as Y } from "child_process";
import K from "http";
import f from "os";
import le from "electron";
import d from "path";
import { fileURLToPath as ce } from "url";
const { app: u, BrowserWindow: Q, screen: X, ipcMain: a, globalShortcut: S, safeStorage: T, session: z, shell: ue, Tray: de, Menu: pe, nativeImage: H, powerSaveBlocker: V } = le, fe = ce(import.meta.url), G = d.dirname(fe), A = process.env.VITE_DEV_SERVER_URL, Z = "http://localhost:5173";
let t = null, R = "";
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
  return new Promise((e, n) => {
    const o = K.createServer((i, c) => {
      try {
        let p = decodeURIComponent((i.url || "/").split("?")[0]);
        (p === "/" || p === "") && (p = "/index.html");
        const h = d.normalize(p).replace(/^([/\\])+/, ""), m = d.join(r, h);
        if (!m.startsWith(r) || !k(m)) {
          c.writeHead(404), c.end("Not found");
          return;
        }
        const ne = O(m);
        c.writeHead(200, {
          "Content-Type": he[d.extname(m).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), c.end(ne);
      } catch {
        c.writeHead(500), c.end("Error");
      }
    });
    let s = me, l = 0;
    o.on("error", (i) => {
      i.code === "EADDRINUSE" && l < 12 ? (l++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(i);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const b = () => d.join(u.getPath("userData"), "device.token");
function ye(r) {
  try {
    return P(d.dirname(b()), { recursive: !0 }), T.isEncryptionAvailable() ? (j(b(), T.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function ee() {
  try {
    return !k(b()) || !T.isEncryptionAvailable() ? null : T.decryptString(O(b()));
  } catch {
    return null;
  }
}
function be() {
  try {
    k(b()) && J(b());
  } catch {
  }
}
const _ = () => d.join(u.getPath("userData"), "setup.json");
function ke() {
  var r;
  try {
    return k(_()) ? ((r = JSON.parse(O(_(), "utf8"))) == null ? void 0 : r.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function we(r) {
  try {
    P(d.dirname(_()), { recursive: !0 }), j(_(), JSON.stringify({ setupCompleted: !!r }));
  } catch {
  }
}
const te = 200, $ = () => d.join(u.getPath("userData"), "memories.json");
function F() {
  try {
    if (!k($())) return [];
    const r = JSON.parse(O($(), "utf8"));
    return Array.isArray(r) ? r.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function L(r) {
  try {
    P(d.dirname($()), { recursive: !0 }), j($(), JSON.stringify(r.slice(-te)));
  } catch {
  }
}
function Se(r) {
  const e = String(r || "").trim().slice(0, 300);
  if (!e) return F();
  const n = F(), o = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((l) => l.text.toLowerCase().replace(/\s+/g, " ") === o)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-te);
  return L(s), s;
}
let C = null;
const xe = 2e4;
function Ce() {
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
  return new Promise((e) => {
    Y(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", r],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (n, o) => {
        if (n || !o) return e({});
        try {
          const s = JSON.parse(o), l = (s.disks || []).map((i) => ({
            drive: i.drive,
            totalGB: i.totalGB,
            freeGB: i.freeGB,
            usedPct: i.totalGB ? Math.round((i.totalGB - i.freeGB) / i.totalGB * 100) : 0
          }));
          e({
            disks: l,
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
const q = {
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
function Ee(r) {
  if (typeof r != "string") return null;
  const e = r.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? q[e] ? q[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
function Te(r) {
  const e = Ee(r);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.kind === "url" ? ue.openExternal(e.target) : I("cmd", ["/c", "start", "", e.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const W = 2e4;
function Ae() {
  const r = [f.tmpdir(), d.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (l, i) => {
    if (i > 6 || Date.now() - e > W || !/temp/i.test(l)) return;
    let c;
    try {
      c = oe(l, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const p of c) {
      if (Date.now() - e > W) return;
      const h = d.join(l, p.name);
      try {
        if (p.isSymbolicLink()) continue;
        if (p.isDirectory()) {
          s(h, i + 1);
          try {
            se(h);
          } catch {
          }
        } else if (p.isFile()) {
          const m = ae(h).size;
          J(h), n += m, o++;
        }
      } catch {
      }
    }
  };
  for (const l of r) s(l, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function _e() {
  const r = [
    "$ErrorActionPreference='SilentlyContinue'",
    "$sh = New-Object -ComObject Shell.Application",
    "$bin = $sh.NameSpace(10)",
    // 0xA = ssfBITBUCKET
    "$count = 0; $bytes = 0",
    "foreach ($i in @($bin.Items())) {",
    "  $count++",
    "  $s = $i.ExtendedProperty('Size'); if (-not $s) { $s = $i.Size }",
    "  if ($s) { $bytes += [int64]$s }",
    "}",
    "Clear-RecycleBin -Force -ErrorAction SilentlyContinue",
    "Write-Output ('{0} {1}' -f $count, $bytes)"
  ].join("; ");
  try {
    const n = (ie("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", r], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [o, s] = n.split(/\s+/).map((l) => parseInt(l, 10));
    return {
      files: Number.isFinite(o) ? o : 0,
      freedMB: Number.isFinite(s) ? Math.round(s / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
function $e() {
  try {
    return I("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Fe(r) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${r === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${r === "up" ? 175 : r === "down" ? 174 : 173}) }`;
  try {
    return Y("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const De = {
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
function Oe(r) {
  if (typeof r != "string") return { ok: !1, error: "unknown" };
  const e = De[r.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return I("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Me() {
  if (C && Date.now() - C.at < xe) return C.data;
  const r = Ce();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await ve();
    } catch {
    }
  const n = { ...r, ...e };
  return C = { at: Date.now(), data: n }, n;
}
async function Re(r) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: l = !0 } = r;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const i = { "Content-Type": "application/json" };
  if (l) {
    const c = ee();
    if (!c) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    i.Authorization = `Bearer ${c}`;
  }
  try {
    const c = await fetch(`${e}${n}`, {
      method: o,
      headers: i,
      body: s === void 0 ? void 0 : JSON.stringify(s)
    }), p = await c.json().catch(() => null);
    return { ok: c.ok, status: c.status, data: p };
  } catch (c) {
    return {
      ok: !1,
      status: 0,
      data: { error: c instanceof Error ? c.message : "Network error" }
    };
  }
}
let D = !0;
const Be = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Pe = "CommandOrControl+Alt+Shift+Q", je = "CommandOrControl+Shift+Space";
function Ie() {
  for (const r of Be)
    try {
      S.isRegistered(r) && S.unregister(r);
    } catch {
    }
}
function y(r) {
  D = r, Ie();
}
function Ge(r, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), l = () => {
      K.get(r, (p) => {
        p.statusCode === 200 ? n() : i();
      }).on("error", i);
    }, i = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(l, 300);
    };
    l();
  });
}
function re() {
  const { width: r, height: e } = X.getPrimaryDisplay().workAreaSize, n = d.join(G, "preload.cjs");
  t = new Q({
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
  }), t.setVisibleOnAllWorkspaces(!0), t.setMenuBarVisibility(!1), t.setAlwaysOnTop(!0, "screen-saver"), A ? t.loadURL(Z).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : R ? t.loadURL(R).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), t.webContents.on("did-finish-load", () => {
    var o, s;
    t == null || t.show(), t == null || t.focus(), A && ((s = (o = t == null ? void 0 : t.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
  }), t.webContents.on("did-fail-load", (o, s, l, i, c) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: l, validatedURL: i, isMainFrame: c });
  }), t.webContents.on("console-message", (o, s, l) => {
    const i = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${i}] ${l}`);
  }), t.webContents.on("render-process-gone", (o, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), t.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), t.on("close", (o) => {
    M || (o.preventDefault(), t == null || t.hide());
  });
}
u.requestSingleInstanceLock() ? u.on("second-instance", () => {
  t && !t.isDestroyed() && B();
}) : u.quit();
u.whenReady().then(async () => {
  if (A)
    try {
      await Ge(Z);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), u.quit();
      return;
    }
  const r = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (z.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(r(n));
  }), z.defaultSession.setPermissionCheckHandler((e, n) => r(n)), !A)
    try {
      R = await ge(d.join(G, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), u.quit();
      return;
    }
  re(), y(!0);
  try {
    S.register(Pe, () => {
      D = !1, u.exit(0);
    });
  } catch {
  }
  try {
    S.register(je, () => {
      D || t == null || t.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && u.isPackaged && u.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
u.on("activate", () => {
  Q.getAllWindows().length === 0 ? re() : (t == null || t.show(), t == null || t.focus());
});
u.on("window-all-closed", () => {
  M && process.platform !== "darwin" && u.quit();
});
u.on("before-quit", () => {
  M = !0;
});
u.on("before-quit", () => {
  t = null;
});
u.on("will-quit", () => {
  S.unregisterAll();
});
a.handle("senti:token-set", (r, e) => typeof e != "string" || !e.trim() ? !1 : ye(e.trim()));
a.handle("senti:token-clear", () => (be(), !0));
a.handle("senti:token-present", () => !!ee());
a.on("senti:get-setup", (r) => {
  r.returnValue = ke();
});
a.handle("senti:set-setup", (r, e) => (we(!!e), !0));
a.handle("senti:system-info", () => Me());
a.handle("senti:memory-list", () => F());
a.handle("senti:memory-add", (r, e) => Se(String(e ?? "")));
a.handle("senti:memory-forget", (r, e) => {
  const n = F().filter((o) => o.id !== String(e));
  return L(n), n;
});
a.handle("senti:memory-clear", () => (L([]), []));
let g = null;
a.handle("senti:keep-awake", (r, e) => {
  try {
    return e && g === null ? g = V.start("prevent-display-sleep") : !e && g !== null && (V.stop(g), g = null), g !== null;
  } catch {
    return !1;
  }
});
a.handle("senti:open-app", (r, e) => Te(e));
a.handle("senti:close-app", (r, e) => Oe(e));
a.handle("senti:clean-temp", () => Ae());
a.handle("senti:empty-recycle-bin", () => _e());
a.handle("senti:lock-workstation", () => $e());
a.handle("senti:volume", (r, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? Fe(n) : !1;
});
a.handle("senti:api", (r, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Re({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
a.handle("senti:get-platform", () => process.platform);
a.handle("senti:device-info", () => ({
  hostname: f.hostname(),
  platform: process.platform
}));
a.handle("senti:set-lock-state", (r, e) => {
  y(!!e);
});
let N = "signin", w = null, M = !1;
const v = 380, E = 132;
function U(r) {
  if (!t || t.isDestroyed()) return;
  const { workArea: e } = X.getPrimaryDisplay();
  r ? t.setBounds({
    x: Math.round(e.x + (e.width - v) / 2),
    y: Math.round(e.y + (e.height - v) / 2 - e.height * 0.06),
    width: v,
    height: v
  }) : t.setBounds({
    x: Math.round(e.x + e.width - E - 18),
    y: Math.round(e.y + e.height - E - 18),
    width: E,
    height: E
  });
}
function x(r) {
  !t || t.isDestroyed() || (N = r, r === "hud" ? (y(!1), t.setFullScreen(!1), t.setResizable(!1), t.setSkipTaskbar(!0), t.setAlwaysOnTop(!0, "screen-saver"), t.setIgnoreMouseEvents(!0, { forward: !0 }), U(!1), t.showInactive()) : r === "setup" ? (y(!1), t.setIgnoreMouseEvents(!1), t.setAlwaysOnTop(!1), t.setFullScreen(!1), t.setResizable(!0), t.setSkipTaskbar(!1), t.setSize(980, 760), t.center(), t.show()) : r === "panel" ? (y(!1), t.setIgnoreMouseEvents(!1), t.setAlwaysOnTop(!1), t.setFullScreen(!1), t.setResizable(!1), t.setSkipTaskbar(!1), t.setSize(760, 840), t.center(), t.show(), t.focus()) : (y(!0), t.setIgnoreMouseEvents(!1), t.setFullScreen(!1), t.setAlwaysOnTop(!1), t.setResizable(!1), t.setSkipTaskbar(!1), t.setSize(680, 780), t.center(), t.show(), t.focus()));
}
function Le() {
  !t || t.isDestroyed() || N !== "hud" || (U(!0), t.showInactive(), t.setAlwaysOnTop(!0, "screen-saver"));
}
function Ne() {
  !t || t.isDestroyed() || N !== "hud" || U(!1);
}
function Ue() {
  const r = [
    d.join(process.resourcesPath || "", "build", "icon.png"),
    d.join(G, "..", "build", "icon.png")
  ];
  for (const e of r)
    try {
      if (k(e)) {
        const n = H.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return H.createEmpty();
}
function B() {
  !t || t.isDestroyed() || (t.webContents.send("senti:open-settings"), x("panel"), t.show(), t.focus());
}
function ze() {
  if (!w)
    try {
      w = new de(Ue()), w.setToolTip("Senti — listening for you"), w.setContextMenu(
        pe.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => B() },
          { label: "Sign in again", click: () => x("signin") },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              M = !0, u.quit();
            }
          }
        ])
      ), w.on("click", () => B());
    } catch {
    }
}
function He(r) {
  x(r ? "setup" : "signin");
}
a.handle("senti:set-setup-mode", (r, e) => (He(!!e), !0));
a.handle("senti:set-window-mode", (r, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (x(e), e === "hud" && ze(), !0) : !1);
a.handle("senti:hud-show", () => (Le(), !0));
a.handle("senti:hud-hide", () => (Ne(), !0));
a.handle("senti:lock", () => {
  x("signin");
});
a.handle("senti:quit", () => D ? !1 : (u.quit(), !0));
