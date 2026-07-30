import { existsSync as S, readFileSync as B, mkdirSync as q, writeFileSync as z, unlinkSync as oe, readdirSync as U, rmdirSync as me, statSync as ge } from "fs";
import { spawn as b, execFileSync as ye, execFile as V } from "child_process";
import se from "http";
import m from "os";
import we from "electron";
import p from "path";
import { fileURLToPath as be } from "url";
const { app: d, BrowserWindow: ae, screen: ie, ipcMain: c, globalShortcut: x, safeStorage: P, session: L, shell: v, Tray: ke, Menu: Se, nativeImage: X, powerSaveBlocker: Q, desktopCapturer: le, clipboard: ce } = we, Ce = be(import.meta.url), W = p.dirname(Ce), _ = process.env.VITE_DEV_SERVER_URL, ue = "http://localhost:5173";
let r = null, G = "";
const xe = {
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
}, ve = 47615;
function Te(t) {
  return new Promise((e, n) => {
    const o = se.createServer((l, a) => {
      try {
        let u = decodeURIComponent((l.url || "/").split("?")[0]);
        (u === "/" || u === "") && (u = "/index.html");
        const h = p.normalize(u).replace(/^([/\\])+/, ""), f = p.join(t, h);
        if (!f.startsWith(t) || !S(f)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const g = B(f);
        a.writeHead(200, {
          "Content-Type": xe[p.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(g);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = ve, i = 0;
    o.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(l);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const k = () => p.join(d.getPath("userData"), "device.token");
function De(t) {
  try {
    return q(p.dirname(k()), { recursive: !0 }), P.isEncryptionAvailable() ? (z(k(), P.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function de() {
  try {
    return !S(k()) || !P.isEncryptionAvailable() ? null : P.decryptString(B(k()));
  } catch {
    return null;
  }
}
function Ee() {
  try {
    S(k()) && oe(k());
  } catch {
  }
}
const F = () => p.join(d.getPath("userData"), "setup.json");
function Ae() {
  var t;
  try {
    return S(F()) ? ((t = JSON.parse(B(F(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function Pe(t) {
  try {
    q(p.dirname(F()), { recursive: !0 }), z(F(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const pe = 200, M = () => p.join(d.getPath("userData"), "memories.json");
function $() {
  try {
    if (!S(M())) return [];
    const t = JSON.parse(B(M(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function J(t) {
  try {
    q(p.dirname(M()), { recursive: !0 }), z(M(), JSON.stringify(t.slice(-pe)));
  } catch {
  }
}
function _e(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return $();
  const n = $(), o = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === o)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-pe);
  return J(s), s;
}
let T = null;
const Fe = 2e4;
function Me() {
  var o, s;
  const t = m.totalmem() / 1073741824, e = m.freemem() / 1024 ** 3, n = t - e;
  return {
    os: `${m.type()} ${m.release()}`,
    cpu: ((s = (o = m.cpus()[0]) == null ? void 0 : o.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: m.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / t * 100),
    uptimeHours: +(m.uptime() / 3600).toFixed(1)
  };
}
function $e() {
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
      (n, o) => {
        if (n || !o) return e({});
        try {
          const s = JSON.parse(o), i = (s.disks || []).map((l) => ({
            drive: l.drive,
            totalGB: l.totalGB,
            freeGB: l.freeGB,
            usedPct: l.totalGB ? Math.round((l.totalGB - l.freeGB) / l.totalGB * 100) : 0
          }));
          e({
            disks: i,
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
const Z = {
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
function Re(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? Z[e] ? Z[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let I = null, ee = 0;
const Be = /* @__PURE__ */ new Set([
  "game",
  "games",
  "app",
  "application",
  "launcher",
  "the",
  "my",
  "a",
  "open",
  "launch",
  "start",
  "play",
  "run",
  "up"
]);
function N(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function Oe() {
  const t = [];
  return process.env.ProgramData && t.push(p.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(p.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function je() {
  const t = Date.now();
  if (I && t - ee < 5 * 6e4) return I;
  const e = [], n = t, o = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = U(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const u = p.join(s, a.name);
      a.isDirectory() ? o(u, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: u });
    }
  };
  for (const s of Oe()) o(s, 0);
  return I = e, ee = t, e;
}
function Le(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = N(e), o = e.split(/\s+/).map(N).filter((i) => i.length >= 2 && !Be.has(i));
  if (!n && !o.length) return null;
  let s = null;
  for (const i of je()) {
    const l = N(i.name);
    let a = 0;
    if (l === n) a = 100;
    else if (n.length >= 3 && l.includes(n)) a = 60 - Math.min(25, l.length - n.length);
    else {
      let u = 0;
      for (const h of o) h.length >= 3 && l.includes(h) && u++;
      u && (a = 20 + u * 12 - Math.min(15, Math.floor(l.length / 6)));
    }
    a > 0 && (!s || a > s.score) && (s = { app: i, score: a });
  }
  return s && s.score >= 20 ? s.app : null;
}
function Ie(t) {
  const e = Re(t);
  if (e)
    try {
      return e.kind === "url" ? v.openExternal(e.target) : b("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = Le(t);
  if (n)
    try {
      return v.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
function Ne(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|show|go to|reveal)\s+/, "").replace(/^(my|the)\s+/, "").replace(/\s+(folder|directory)$/, "").trim(), n = {
    "recycle bin": { shell: "shell:RecycleBinFolder", label: "Recycle Bin" },
    trash: { shell: "shell:RecycleBinFolder", label: "Recycle Bin" },
    "this pc": { shell: "shell:MyComputerFolder", label: "This PC" },
    "my computer": { shell: "shell:MyComputerFolder", label: "This PC" },
    computer: { shell: "shell:MyComputerFolder", label: "This PC" }
  };
  if (n[e]) return n[e];
  const s = {
    documents: { key: "documents", label: "Documents" },
    docs: { key: "documents", label: "Documents" },
    downloads: { key: "downloads", label: "Downloads" },
    download: { key: "downloads", label: "Downloads" },
    desktop: { key: "desktop", label: "Desktop" },
    pictures: { key: "pictures", label: "Pictures" },
    photos: { key: "pictures", label: "Pictures" },
    images: { key: "pictures", label: "Pictures" },
    music: { key: "music", label: "Music" },
    videos: { key: "videos", label: "Videos" },
    movies: { key: "videos", label: "Videos" },
    home: { key: "home", label: "your home folder" },
    user: { key: "home", label: "your home folder" }
  }[e];
  if (s)
    try {
      return { path: d.getPath(s.key), label: s.label };
    } catch {
      return null;
    }
  return null;
}
function Ge(t) {
  const e = Ne(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? b("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && v.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const te = 8e3, re = 40;
function He(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return d.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), o = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, u) => {
    if (u > 4 || Date.now() - o > te || i.length >= re) return;
    let h;
    try {
      h = U(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - o > te || i.length >= re) return;
      if (f.name.startsWith(".") || s.test(f.name)) continue;
      const g = p.join(a, f.name);
      try {
        if (f.isSymbolicLink()) continue;
        f.isDirectory() ? l(g, u + 1) : f.isFile() && f.name.toLowerCase().includes(e) && i.push({ name: f.name, path: g });
      } catch {
      }
    }
  };
  for (const a of n) l(a, 0);
  if (i.length === 0) return { ok: !1, error: "not-found", count: 0 };
  i.sort((a, u) => {
    const h = a.name.toLowerCase(), f = u.name.toLowerCase(), g = h === e || h.replace(/\.[^.]+$/, "") === e, he = f === e || f.replace(/\.[^.]+$/, "") === e;
    return g !== he ? g ? -1 : 1 : a.name.length - u.name.length;
  });
  try {
    return v.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const ne = 2e4;
function qe() {
  const t = [m.tmpdir(), p.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (i, l) => {
    if (l > 6 || Date.now() - e > ne || !/temp/i.test(i)) return;
    let a;
    try {
      a = U(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const u of a) {
      if (Date.now() - e > ne) return;
      const h = p.join(i, u.name);
      try {
        if (u.isSymbolicLink()) continue;
        if (u.isDirectory()) {
          s(h, l + 1);
          try {
            me(h);
          } catch {
          }
        } else if (u.isFile()) {
          const f = ge(h).size;
          oe(h), n += f, o++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function ze() {
  const t = [
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
    const n = (ye("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [o, s] = n.split(/\s+/).map((i) => parseInt(i, 10));
    return {
      files: Number.isFinite(o) ? o : 0,
      freedMB: Number.isFinite(s) ? Math.round(s / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
function Ue() {
  try {
    return b("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Ve(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      V("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
    else if (e === "restart" || e === "reboot")
      b("shutdown", ["/r", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else if (e === "shutdown" || e === "shut down" || e === "off")
      b("shutdown", ["/s", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else
      return !1;
    return !0;
  } catch {
    return !1;
  }
}
function We(t) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return V("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const Je = {
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
function Ye(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = Je[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return b("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Ke() {
  if (T && Date.now() - T.at < Fe) return T.data;
  const t = Me();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await $e();
    } catch {
    }
  const n = { ...t, ...e };
  return T = { at: Date.now(), data: n }, n;
}
async function Xe(t) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = de();
    if (!a) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${a}`;
  }
  try {
    const a = await fetch(`${e}${n}`, {
      method: o,
      headers: l,
      body: s === void 0 ? void 0 : JSON.stringify(s)
    }), u = await a.json().catch(() => null);
    return { ok: a.ok, status: a.status, data: u };
  } catch (a) {
    return {
      ok: !1,
      status: 0,
      data: { error: a instanceof Error ? a.message : "Network error" }
    };
  }
}
let R = !0;
const Qe = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Ze = "CommandOrControl+Alt+Shift+Q", et = "CommandOrControl+Shift+Space";
function tt() {
  for (const t of Qe)
    try {
      x.isRegistered(t) && x.unregister(t);
    } catch {
    }
}
function w(t) {
  R = t, tt();
}
function rt(t, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), i = () => {
      se.get(t, (u) => {
        u.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function fe() {
  const { width: t, height: e } = ie.getPrimaryDisplay().workAreaSize, n = p.join(W, "preload.cjs");
  r = new ae({
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
      preload: n,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1,
      // CRITICAL: Windows throttles hidden/occluded windows to ~1fps, which
      // stalls the always-listening audio loop. Senti has to keep hearing you
      // while it sits quietly in the corner, so throttling stays OFF.
      backgroundThrottling: !1
    }
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), _ ? r.loadURL(ue).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : G ? r.loadURL(G).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var o, s;
    r == null || r.show(), r == null || r.focus(), _ && ((s = (o = r == null ? void 0 : r.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
  }), r.webContents.on("did-fail-load", (o, s, i, l, a) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: i, validatedURL: l, isMainFrame: a });
  }), r.webContents.on("console-message", (o, s, i) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${l}] ${i}`);
  }), r.webContents.on("render-process-gone", (o, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), r.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), r.on("close", (o) => {
    O || (o.preventDefault(), r == null || r.hide());
  });
}
d.requestSingleInstanceLock() ? d.on("second-instance", () => {
  r && !r.isDestroyed() && H();
}) : d.quit();
d.whenReady().then(async () => {
  if (_)
    try {
      await rt(ue);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), d.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (L.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(t(n));
  }), L.defaultSession.setPermissionCheckHandler((e, n) => t(n)), L.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    le.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((o) => {
      n(o[0] ? { video: o[0] } : {});
    });
  }), !_)
    try {
      G = await Te(p.join(W, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), d.quit();
      return;
    }
  fe(), w(!0);
  try {
    x.register(Ze, () => {
      R = !1, d.exit(0);
    });
  } catch {
  }
  try {
    x.register(et, () => {
      R || r == null || r.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && d.isPackaged && d.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
d.on("activate", () => {
  ae.getAllWindows().length === 0 ? fe() : (r == null || r.show(), r == null || r.focus());
});
d.on("window-all-closed", () => {
  O && process.platform !== "darwin" && d.quit();
});
d.on("before-quit", () => {
  O = !0;
});
d.on("before-quit", () => {
  r = null;
});
d.on("will-quit", () => {
  x.unregisterAll();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : De(e.trim()));
c.handle("senti:token-clear", () => (Ee(), !0));
c.handle("senti:token-present", () => !!de());
c.on("senti:get-setup", (t) => {
  t.returnValue = Ae();
});
c.handle("senti:set-setup", (t, e) => (Pe(!!e), !0));
c.handle("senti:system-info", () => Ke());
c.handle("senti:clipboard-read", () => {
  try {
    return ce.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && ce.writeText(e), !0;
  } catch {
    return !1;
  }
});
c.handle("senti:screen-sources", async () => {
  try {
    return (await le.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => $());
c.handle("senti:memory-add", (t, e) => _e(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = $().filter((o) => o.id !== String(e));
  return J(n), n;
});
c.handle("senti:memory-clear", () => (J([]), []));
let y = null;
const D = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const o = typeof n == "string" && n ? n : "default";
    return e ? D.add(o) : D.delete(o), D.size > 0 && y === null ? y = Q.start("prevent-display-sleep") : D.size === 0 && y !== null && (Q.stop(y), y = null), y !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => Ie(e));
c.handle("senti:close-app", (t, e) => Ye(e));
c.handle("senti:clean-temp", () => qe());
c.handle("senti:empty-recycle-bin", () => ze());
c.handle("senti:open-folder", (t, e) => Ge(e));
c.handle("senti:open-file", (t, e) => He(e));
c.handle("senti:web-search", (t, e) => {
  const n = String(e ?? "").trim().slice(0, 200);
  return n ? (v.openExternal(`https://www.google.com/search?q=${encodeURIComponent(n)}`), { ok: !0 }) : { ok: !1 };
});
c.handle("senti:lock-workstation", () => Ue());
c.handle("senti:power", (t, e) => Ve(e));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? We(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Xe({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: m.hostname(),
  platform: process.platform
}));
c.handle("senti:set-lock-state", (t, e) => {
  w(!!e);
});
let Y = "signin", C = null, O = !1;
const E = 380, A = 132;
function K(t) {
  if (!r || r.isDestroyed()) return;
  const { workArea: e } = ie.getPrimaryDisplay();
  t ? r.setBounds({
    x: Math.round(e.x + (e.width - E) / 2),
    y: Math.round(e.y + (e.height - E) / 2 - e.height * 0.06),
    width: E,
    height: E
  }) : r.setBounds({
    x: Math.round(e.x + e.width - A - 18),
    y: Math.round(e.y + e.height - A - 18),
    width: A,
    height: A
  });
}
function j(t) {
  !r || r.isDestroyed() || (Y = t, t === "hud" ? (w(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), r.setIgnoreMouseEvents(!0, { forward: !0 }), K(!1), r.showInactive()) : t === "setup" ? (w(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : t === "panel" ? (w(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(760, 840), r.center(), r.show(), r.focus()) : (w(!0), r.setIgnoreMouseEvents(!1), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()));
}
function nt() {
  !r || r.isDestroyed() || Y !== "hud" || (K(!0), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function ot() {
  !r || r.isDestroyed() || Y !== "hud" || K(!1);
}
function st() {
  const t = [
    p.join(process.resourcesPath || "", "build", "icon.png"),
    p.join(W, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (S(e)) {
        const n = X.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return X.createEmpty();
}
function H() {
  !r || r.isDestroyed() || (r.webContents.send("senti:open-settings"), j("panel"), r.show(), r.focus());
}
function at() {
  if (!C)
    try {
      C = new ke(st()), C.setToolTip("Senti — listening for you"), C.setContextMenu(
        Se.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => H() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              O = !0, d.quit();
            }
          }
        ])
      ), C.on("click", () => H());
    } catch {
    }
}
function it(t) {
  j(t ? "setup" : "signin");
}
c.handle("senti:set-setup-mode", (t, e) => (it(!!e), !0));
c.handle("senti:set-window-mode", (t, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (j(e), e === "hud" && at(), !0) : !1);
c.handle("senti:hud-show", () => (nt(), !0));
c.handle("senti:hud-hide", () => (ot(), !0));
c.handle("senti:lock", () => {
  j("signin");
});
c.handle("senti:quit", () => R ? !1 : (d.quit(), !0));
