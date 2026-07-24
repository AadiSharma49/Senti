import { existsSync as S, readFileSync as D, mkdirSync as z, writeFileSync as H, unlinkSync as V, readdirSync as ee, rmdirSync as te, statSync as re } from "fs";
import { spawn as O, execFileSync as ne, execFile as q } from "child_process";
import W from "http";
import f from "os";
import oe from "electron";
import p from "path";
import { fileURLToPath as se } from "url";
const { app: u, BrowserWindow: J, screen: K, ipcMain: i, globalShortcut: w, safeStorage: T, session: I, shell: ae, Tray: ie, Menu: le, nativeImage: G, powerSaveBlocker: L } = oe, ce = se(import.meta.url), P = p.dirname(ce), $ = process.env.VITE_DEV_SERVER_URL, Y = "http://localhost:5173";
let t = null, B = "";
const ue = {
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
}, pe = 47615;
function de(r) {
  return new Promise((e, n) => {
    const o = W.createServer((a, l) => {
      try {
        let d = decodeURIComponent((a.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const h = p.normalize(d).replace(/^([/\\])+/, ""), m = p.join(r, h);
        if (!m.startsWith(r) || !S(m)) {
          l.writeHead(404), l.end("Not found");
          return;
        }
        const Z = D(m);
        l.writeHead(200, {
          "Content-Type": ue[p.extname(m).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), l.end(Z);
      } catch {
        l.writeHead(500), l.end("Error");
      }
    });
    let s = pe, c = 0;
    o.on("error", (a) => {
      a.code === "EADDRINUSE" && c < 12 ? (c++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(a);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const b = () => p.join(u.getPath("userData"), "device.token");
function fe(r) {
  try {
    return z(p.dirname(b()), { recursive: !0 }), T.isEncryptionAvailable() ? (H(b(), T.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function Q() {
  try {
    return !S(b()) || !T.isEncryptionAvailable() ? null : T.decryptString(D(b()));
  } catch {
    return null;
  }
}
function he() {
  try {
    S(b()) && V(b());
  } catch {
  }
}
const _ = () => p.join(u.getPath("userData"), "setup.json");
function me() {
  var r;
  try {
    return S(_()) ? ((r = JSON.parse(D(_(), "utf8"))) == null ? void 0 : r.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function ge(r) {
  try {
    z(p.dirname(_()), { recursive: !0 }), H(_(), JSON.stringify({ setupCompleted: !!r }));
  } catch {
  }
}
let C = null;
const ye = 2e4;
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
    q(
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
const N = {
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
function we(r) {
  if (typeof r != "string") return null;
  const e = r.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? N[e] ? N[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
function Se(r) {
  const e = we(r);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.kind === "url" ? ae.openExternal(e.target) : O("cmd", ["/c", "start", "", e.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const U = 2e4;
function xe() {
  const r = [f.tmpdir(), p.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (c, a) => {
    if (a > 6 || Date.now() - e > U || !/temp/i.test(c)) return;
    let l;
    try {
      l = ee(c, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of l) {
      if (Date.now() - e > U) return;
      const h = p.join(c, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          s(h, a + 1);
          try {
            te(h);
          } catch {
          }
        } else if (d.isFile()) {
          const m = re(h).size;
          V(h), n += m, o++;
        }
      } catch {
      }
    }
  };
  for (const c of r) s(c, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function Ce() {
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
    const n = (ne("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", r], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [o, s] = n.split(/\s+/).map((c) => parseInt(c, 10));
    return {
      files: Number.isFinite(o) ? o : 0,
      freedMB: Number.isFinite(s) ? Math.round(s / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
function ve() {
  try {
    return O("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Ee(r) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${r === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${r === "up" ? 175 : r === "down" ? 174 : 173}) }`;
  try {
    return q("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const Te = {
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
function $e(r) {
  if (typeof r != "string") return { ok: !1, error: "unknown" };
  const e = Te[r.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return O("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function _e() {
  if (C && Date.now() - C.at < ye) return C.data;
  const r = be();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await ke();
    } catch {
    }
  const n = { ...r, ...e };
  return C = { at: Date.now(), data: n }, n;
}
async function Ae(r) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: c = !0 } = r;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const a = { "Content-Type": "application/json" };
  if (c) {
    const l = Q();
    if (!l) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    a.Authorization = `Bearer ${l}`;
  }
  try {
    const l = await fetch(`${e}${n}`, {
      method: o,
      headers: a,
      body: s === void 0 ? void 0 : JSON.stringify(s)
    }), d = await l.json().catch(() => null);
    return { ok: l.ok, status: l.status, data: d };
  } catch (l) {
    return {
      ok: !1,
      status: 0,
      data: { error: l instanceof Error ? l.message : "Network error" }
    };
  }
}
let A = !0;
const Fe = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Be = "CommandOrControl+Alt+Shift+Q", Re = "CommandOrControl+Shift+Space";
function De() {
  for (const r of Fe)
    try {
      w.isRegistered(r) && w.unregister(r);
    } catch {
    }
}
function y(r) {
  A = r, De();
}
function Oe(r, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), c = () => {
      W.get(r, (d) => {
        d.statusCode === 200 ? n() : a();
      }).on("error", a);
    }, a = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(c, 300);
    };
    c();
  });
}
function X() {
  const { width: r, height: e } = K.getPrimaryDisplay().workAreaSize, n = p.join(P, "preload.cjs");
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
  }), t.setVisibleOnAllWorkspaces(!0), t.setMenuBarVisibility(!1), t.setAlwaysOnTop(!0, "screen-saver"), $ ? t.loadURL(Y).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : B ? t.loadURL(B).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), t.webContents.on("did-finish-load", () => {
    var o, s;
    t == null || t.show(), t == null || t.focus(), $ && ((s = (o = t == null ? void 0 : t.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
  }), t.webContents.on("did-fail-load", (o, s, c, a, l) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: c, validatedURL: a, isMainFrame: l });
  }), t.webContents.on("console-message", (o, s, c) => {
    const a = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${a}] ${c}`);
  }), t.webContents.on("render-process-gone", (o, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), t.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), t.on("close", (o) => {
    F || (o.preventDefault(), t == null || t.hide());
  });
}
u.requestSingleInstanceLock() ? u.on("second-instance", () => {
  t && !t.isDestroyed() && R();
}) : u.quit();
u.whenReady().then(async () => {
  if ($)
    try {
      await Oe(Y);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), u.quit();
      return;
    }
  const r = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (I.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(r(n));
  }), I.defaultSession.setPermissionCheckHandler((e, n) => r(n)), !$)
    try {
      B = await de(p.join(P, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), u.quit();
      return;
    }
  X(), y(!0);
  try {
    w.register(Be, () => {
      A = !1, u.exit(0);
    });
  } catch {
  }
  try {
    w.register(Re, () => {
      A || t == null || t.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && u.isPackaged && u.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
u.on("activate", () => {
  J.getAllWindows().length === 0 ? X() : (t == null || t.show(), t == null || t.focus());
});
u.on("window-all-closed", () => {
  F && process.platform !== "darwin" && u.quit();
});
u.on("before-quit", () => {
  F = !0;
});
u.on("before-quit", () => {
  t = null;
});
u.on("will-quit", () => {
  w.unregisterAll();
});
i.handle("senti:token-set", (r, e) => typeof e != "string" || !e.trim() ? !1 : fe(e.trim()));
i.handle("senti:token-clear", () => (he(), !0));
i.handle("senti:token-present", () => !!Q());
i.on("senti:get-setup", (r) => {
  r.returnValue = me();
});
i.handle("senti:set-setup", (r, e) => (ge(!!e), !0));
i.handle("senti:system-info", () => _e());
let g = null;
i.handle("senti:keep-awake", (r, e) => {
  try {
    return e && g === null ? g = L.start("prevent-display-sleep") : !e && g !== null && (L.stop(g), g = null), g !== null;
  } catch {
    return !1;
  }
});
i.handle("senti:open-app", (r, e) => Se(e));
i.handle("senti:close-app", (r, e) => $e(e));
i.handle("senti:clean-temp", () => xe());
i.handle("senti:empty-recycle-bin", () => Ce());
i.handle("senti:lock-workstation", () => ve());
i.handle("senti:volume", (r, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? Ee(n) : !1;
});
i.handle("senti:api", (r, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Ae({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
i.handle("senti:get-platform", () => process.platform);
i.handle("senti:device-info", () => ({
  hostname: f.hostname(),
  platform: process.platform
}));
i.handle("senti:set-lock-state", (r, e) => {
  y(!!e);
});
let j = "signin", k = null, F = !1;
const v = 380, E = 132;
function M(r) {
  if (!t || t.isDestroyed()) return;
  const { workArea: e } = K.getPrimaryDisplay();
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
  !t || t.isDestroyed() || (j = r, r === "hud" ? (y(!1), t.setFullScreen(!1), t.setResizable(!1), t.setSkipTaskbar(!0), t.setAlwaysOnTop(!0, "screen-saver"), t.setIgnoreMouseEvents(!0, { forward: !0 }), M(!1), t.showInactive()) : r === "setup" ? (y(!1), t.setIgnoreMouseEvents(!1), t.setAlwaysOnTop(!1), t.setFullScreen(!1), t.setResizable(!0), t.setSkipTaskbar(!1), t.setSize(980, 760), t.center(), t.show()) : r === "panel" ? (y(!1), t.setIgnoreMouseEvents(!1), t.setAlwaysOnTop(!1), t.setFullScreen(!1), t.setResizable(!1), t.setSkipTaskbar(!1), t.setSize(760, 840), t.center(), t.show(), t.focus()) : (y(!0), t.setIgnoreMouseEvents(!1), t.setFullScreen(!1), t.setAlwaysOnTop(!1), t.setResizable(!1), t.setSkipTaskbar(!1), t.setSize(680, 780), t.center(), t.show(), t.focus()));
}
function Pe() {
  !t || t.isDestroyed() || j !== "hud" || (M(!0), t.showInactive(), t.setAlwaysOnTop(!0, "screen-saver"));
}
function je() {
  !t || t.isDestroyed() || j !== "hud" || M(!1);
}
function Me() {
  const r = [
    p.join(process.resourcesPath || "", "build", "icon.png"),
    p.join(P, "..", "build", "icon.png")
  ];
  for (const e of r)
    try {
      if (S(e)) {
        const n = G.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return G.createEmpty();
}
function R() {
  !t || t.isDestroyed() || (t.webContents.send("senti:open-settings"), x("panel"), t.show(), t.focus());
}
function Ie() {
  if (!k)
    try {
      k = new ie(Me()), k.setToolTip("Senti — listening for you"), k.setContextMenu(
        le.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => R() },
          { label: "Sign in again", click: () => x("signin") },
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
function Ge(r) {
  x(r ? "setup" : "signin");
}
i.handle("senti:set-setup-mode", (r, e) => (Ge(!!e), !0));
i.handle("senti:set-window-mode", (r, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (x(e), e === "hud" && Ie(), !0) : !1);
i.handle("senti:hud-show", () => (Pe(), !0));
i.handle("senti:hud-hide", () => (je(), !0));
i.handle("senti:lock", () => {
  x("signin");
});
i.handle("senti:quit", () => A ? !1 : (u.quit(), !0));
