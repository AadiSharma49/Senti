import { existsSync as k, readFileSync as $, mkdirSync as G, writeFileSync as q, unlinkSync as re, readdirSync as z, rmdirSync as de, statSync as fe } from "fs";
import { spawn as B, execFileSync as he, execFile as ne } from "child_process";
import oe from "http";
import m from "os";
import me from "electron";
import d from "path";
import { fileURLToPath as ge } from "url";
const { app: p, BrowserWindow: se, screen: ae, ipcMain: c, globalShortcut: C, safeStorage: D, session: J, shell: x, Tray: ye, Menu: be, nativeImage: Y, powerSaveBlocker: K, desktopCapturer: we } = me, ke = ge(import.meta.url), H = d.dirname(ke), A = process.env.VITE_DEV_SERVER_URL, ie = "http://localhost:5173";
let r = null, L = "";
const Se = {
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
}, Ce = 47615;
function xe(t) {
  return new Promise((e, n) => {
    const s = oe.createServer((l, a) => {
      try {
        let u = decodeURIComponent((l.url || "/").split("?")[0]);
        (u === "/" || u === "") && (u = "/index.html");
        const h = d.normalize(u).replace(/^([/\\])+/, ""), f = d.join(t, h);
        if (!f.startsWith(t) || !k(f)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const g = $(f);
        a.writeHead(200, {
          "Content-Type": Se[d.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(g);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let o = Ce, i = 0;
    s.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, o++, setTimeout(() => s.listen(o, "127.0.0.1"), 40)) : n(l);
    }), s.on("listening", () => e(`http://127.0.0.1:${o}`)), s.listen(o, "127.0.0.1");
  });
}
const w = () => d.join(p.getPath("userData"), "device.token");
function ve(t) {
  try {
    return G(d.dirname(w()), { recursive: !0 }), D.isEncryptionAvailable() ? (q(w(), D.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function le() {
  try {
    return !k(w()) || !D.isEncryptionAvailable() ? null : D.decryptString($(w()));
  } catch {
    return null;
  }
}
function Ee() {
  try {
    k(w()) && re(w());
  } catch {
  }
}
const P = () => d.join(p.getPath("userData"), "setup.json");
function Te() {
  var t;
  try {
    return k(P()) ? ((t = JSON.parse($(P(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function De(t) {
  try {
    G(d.dirname(P()), { recursive: !0 }), q(P(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const ce = 200, _ = () => d.join(p.getPath("userData"), "memories.json");
function F() {
  try {
    if (!k(_())) return [];
    const t = JSON.parse($(_(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function U(t) {
  try {
    G(d.dirname(_()), { recursive: !0 }), q(_(), JSON.stringify(t.slice(-ce)));
  } catch {
  }
}
function Ae(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return F();
  const n = F(), s = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === s)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const o = n.slice(-ce);
  return U(o), o;
}
let v = null;
const Pe = 2e4;
function _e() {
  var s, o;
  const t = m.totalmem() / 1073741824, e = m.freemem() / 1024 ** 3, n = t - e;
  return {
    os: `${m.type()} ${m.release()}`,
    cpu: ((o = (s = m.cpus()[0]) == null ? void 0 : s.model) == null ? void 0 : o.trim()) ?? "unknown",
    cores: m.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / t * 100),
    uptimeHours: +(m.uptime() / 3600).toFixed(1)
  };
}
function Fe() {
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
    ne(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", t],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (n, s) => {
        if (n || !s) return e({});
        try {
          const o = JSON.parse(s), i = (o.disks || []).map((l) => ({
            drive: l.drive,
            totalGB: l.totalGB,
            freeGB: l.freeGB,
            usedPct: l.totalGB ? Math.round((l.totalGB - l.freeGB) / l.totalGB * 100) : 0
          }));
          e({
            disks: i,
            topProcesses: o.topProcesses || [],
            startupApps: typeof o.startupApps == "number" ? o.startupApps : void 0
          });
        } catch {
          e({});
        }
      }
    );
  });
}
const X = {
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
function Me(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? X[e] ? X[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let j = null, Q = 0;
const $e = /* @__PURE__ */ new Set([
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
function I(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function Be() {
  const t = [];
  return process.env.ProgramData && t.push(d.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(d.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function Oe() {
  const t = Date.now();
  if (j && t - Q < 5 * 6e4) return j;
  const e = [], n = t, s = (o, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = z(o, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const u = d.join(o, a.name);
      a.isDirectory() ? s(u, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: u });
    }
  };
  for (const o of Be()) s(o, 0);
  return j = e, Q = t, e;
}
function Re(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = I(e), s = e.split(/\s+/).map(I).filter((i) => i.length >= 2 && !$e.has(i));
  if (!n && !s.length) return null;
  let o = null;
  for (const i of Oe()) {
    const l = I(i.name);
    let a = 0;
    if (l === n) a = 100;
    else if (n.length >= 3 && l.includes(n)) a = 60 - Math.min(25, l.length - n.length);
    else {
      let u = 0;
      for (const h of s) h.length >= 3 && l.includes(h) && u++;
      u && (a = 20 + u * 12 - Math.min(15, Math.floor(l.length / 6)));
    }
    a > 0 && (!o || a > o.score) && (o = { app: i, score: a });
  }
  return o && o.score >= 20 ? o.app : null;
}
function je(t) {
  const e = Me(t);
  if (e)
    try {
      return e.kind === "url" ? x.openExternal(e.target) : B("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = Re(t);
  if (n)
    try {
      return x.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
function Ie(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|show|go to|reveal)\s+/, "").replace(/^(my|the)\s+/, "").replace(/\s+(folder|directory)$/, "").trim(), n = {
    "recycle bin": { shell: "shell:RecycleBinFolder", label: "Recycle Bin" },
    trash: { shell: "shell:RecycleBinFolder", label: "Recycle Bin" },
    "this pc": { shell: "shell:MyComputerFolder", label: "This PC" },
    "my computer": { shell: "shell:MyComputerFolder", label: "This PC" },
    computer: { shell: "shell:MyComputerFolder", label: "This PC" }
  };
  if (n[e]) return n[e];
  const o = {
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
  if (o)
    try {
      return { path: p.getPath(o.key), label: o.label };
    } catch {
      return null;
    }
  return null;
}
function Le(t) {
  const e = Ie(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? B("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && x.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const Z = 8e3, ee = 40;
function Ne(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return p.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), s = Date.now(), o = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, u) => {
    if (u > 4 || Date.now() - s > Z || i.length >= ee) return;
    let h;
    try {
      h = z(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - s > Z || i.length >= ee) return;
      if (f.name.startsWith(".") || o.test(f.name)) continue;
      const g = d.join(a, f.name);
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
    const h = a.name.toLowerCase(), f = u.name.toLowerCase(), g = h === e || h.replace(/\.[^.]+$/, "") === e, pe = f === e || f.replace(/\.[^.]+$/, "") === e;
    return g !== pe ? g ? -1 : 1 : a.name.length - u.name.length;
  });
  try {
    return x.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const te = 2e4;
function Ge() {
  const t = [m.tmpdir(), d.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, s = 0;
  const o = (i, l) => {
    if (l > 6 || Date.now() - e > te || !/temp/i.test(i)) return;
    let a;
    try {
      a = z(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const u of a) {
      if (Date.now() - e > te) return;
      const h = d.join(i, u.name);
      try {
        if (u.isSymbolicLink()) continue;
        if (u.isDirectory()) {
          o(h, l + 1);
          try {
            de(h);
          } catch {
          }
        } else if (u.isFile()) {
          const f = fe(h).size;
          re(h), n += f, s++;
        }
      } catch {
      }
    }
  };
  for (const i of t) o(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: s };
}
function qe() {
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
    const n = (he("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [s, o] = n.split(/\s+/).map((i) => parseInt(i, 10));
    return {
      files: Number.isFinite(s) ? s : 0,
      freedMB: Number.isFinite(o) ? Math.round(o / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
function ze() {
  try {
    return B("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function He(t) {
  const s = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return ne("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", s], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const Ue = {
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
function Ve(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = Ue[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return B("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function We() {
  if (v && Date.now() - v.at < Pe) return v.data;
  const t = _e();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await Fe();
    } catch {
    }
  const n = { ...t, ...e };
  return v = { at: Date.now(), data: n }, n;
}
async function Je(t) {
  const { baseUrl: e, path: n, method: s = "GET", body: o, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = le();
    if (!a) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${a}`;
  }
  try {
    const a = await fetch(`${e}${n}`, {
      method: s,
      headers: l,
      body: o === void 0 ? void 0 : JSON.stringify(o)
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
let M = !0;
const Ye = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Ke = "CommandOrControl+Alt+Shift+Q", Xe = "CommandOrControl+Shift+Space";
function Qe() {
  for (const t of Ye)
    try {
      C.isRegistered(t) && C.unregister(t);
    } catch {
    }
}
function b(t) {
  M = t, Qe();
}
function Ze(t, e = 15e3) {
  return new Promise((n, s) => {
    const o = Date.now(), i = () => {
      oe.get(t, (u) => {
        u.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - o > e ? s(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function ue() {
  const { width: t, height: e } = ae.getPrimaryDisplay().workAreaSize, n = d.join(H, "preload.cjs");
  r = new se({
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
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), A ? r.loadURL(ie).catch((s) => {
    console.error("[Electron] Failed to load dev server:", s.message);
  }) : L ? r.loadURL(L).catch((s) => {
    console.error("[Electron] Failed to load prod server:", s.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var s, o;
    r == null || r.show(), r == null || r.focus(), A && ((o = (s = r == null ? void 0 : r.webContents) == null ? void 0 : s.openDevTools) == null || o.call(s));
  }), r.webContents.on("did-fail-load", (s, o, i, l, a) => {
    console.error("[Electron] Renderer load failed:", { errorCode: o, errorDescription: i, validatedURL: l, isMainFrame: a });
  }), r.webContents.on("console-message", (s, o, i) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][o] || "LOG";
    console.log(`[Renderer:${l}] ${i}`);
  }), r.webContents.on("render-process-gone", (s, o) => {
    console.error("[Electron] Renderer process gone:", o);
  }), r.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), r.on("close", (s) => {
    O || (s.preventDefault(), r == null || r.hide());
  });
}
p.requestSingleInstanceLock() ? p.on("second-instance", () => {
  r && !r.isDestroyed() && N();
}) : p.quit();
p.whenReady().then(async () => {
  if (A)
    try {
      await Ze(ie);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), p.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (J.defaultSession.setPermissionRequestHandler((e, n, s) => {
    s(t(n));
  }), J.defaultSession.setPermissionCheckHandler((e, n) => t(n)), !A)
    try {
      L = await xe(d.join(H, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), p.quit();
      return;
    }
  ue(), b(!0);
  try {
    C.register(Ke, () => {
      M = !1, p.exit(0);
    });
  } catch {
  }
  try {
    C.register(Xe, () => {
      M || r == null || r.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && p.isPackaged && p.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
p.on("activate", () => {
  se.getAllWindows().length === 0 ? ue() : (r == null || r.show(), r == null || r.focus());
});
p.on("window-all-closed", () => {
  O && process.platform !== "darwin" && p.quit();
});
p.on("before-quit", () => {
  O = !0;
});
p.on("before-quit", () => {
  r = null;
});
p.on("will-quit", () => {
  C.unregisterAll();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : ve(e.trim()));
c.handle("senti:token-clear", () => (Ee(), !0));
c.handle("senti:token-present", () => !!le());
c.on("senti:get-setup", (t) => {
  t.returnValue = Te();
});
c.handle("senti:set-setup", (t, e) => (De(!!e), !0));
c.handle("senti:system-info", () => We());
c.handle("senti:screen-sources", async () => {
  try {
    return (await we.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => F());
c.handle("senti:memory-add", (t, e) => Ae(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = F().filter((s) => s.id !== String(e));
  return U(n), n;
});
c.handle("senti:memory-clear", () => (U([]), []));
let y = null;
c.handle("senti:keep-awake", (t, e) => {
  try {
    return e && y === null ? y = K.start("prevent-display-sleep") : !e && y !== null && (K.stop(y), y = null), y !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => je(e));
c.handle("senti:close-app", (t, e) => Ve(e));
c.handle("senti:clean-temp", () => Ge());
c.handle("senti:empty-recycle-bin", () => qe());
c.handle("senti:open-folder", (t, e) => Le(e));
c.handle("senti:open-file", (t, e) => Ne(e));
c.handle("senti:web-search", (t, e) => {
  const n = String(e ?? "").trim().slice(0, 200);
  return n ? (x.openExternal(`https://www.google.com/search?q=${encodeURIComponent(n)}`), { ok: !0 }) : { ok: !1 };
});
c.handle("senti:lock-workstation", () => ze());
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? He(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Je({
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
  b(!!e);
});
let V = "signin", S = null, O = !1;
const E = 380, T = 132;
function W(t) {
  if (!r || r.isDestroyed()) return;
  const { workArea: e } = ae.getPrimaryDisplay();
  t ? r.setBounds({
    x: Math.round(e.x + (e.width - E) / 2),
    y: Math.round(e.y + (e.height - E) / 2 - e.height * 0.06),
    width: E,
    height: E
  }) : r.setBounds({
    x: Math.round(e.x + e.width - T - 18),
    y: Math.round(e.y + e.height - T - 18),
    width: T,
    height: T
  });
}
function R(t) {
  !r || r.isDestroyed() || (V = t, t === "hud" ? (b(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), r.setIgnoreMouseEvents(!0, { forward: !0 }), W(!1), r.showInactive()) : t === "setup" ? (b(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : t === "panel" ? (b(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(760, 840), r.center(), r.show(), r.focus()) : (b(!0), r.setIgnoreMouseEvents(!1), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()));
}
function et() {
  !r || r.isDestroyed() || V !== "hud" || (W(!0), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function tt() {
  !r || r.isDestroyed() || V !== "hud" || W(!1);
}
function rt() {
  const t = [
    d.join(process.resourcesPath || "", "build", "icon.png"),
    d.join(H, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (k(e)) {
        const n = Y.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return Y.createEmpty();
}
function N() {
  !r || r.isDestroyed() || (r.webContents.send("senti:open-settings"), R("panel"), r.show(), r.focus());
}
function nt() {
  if (!S)
    try {
      S = new ye(rt()), S.setToolTip("Senti — listening for you"), S.setContextMenu(
        be.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => N() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              O = !0, p.quit();
            }
          }
        ])
      ), S.on("click", () => N());
    } catch {
    }
}
function ot(t) {
  R(t ? "setup" : "signin");
}
c.handle("senti:set-setup-mode", (t, e) => (ot(!!e), !0));
c.handle("senti:set-window-mode", (t, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (R(e), e === "hud" && nt(), !0) : !1);
c.handle("senti:hud-show", () => (et(), !0));
c.handle("senti:hud-hide", () => (tt(), !0));
c.handle("senti:lock", () => {
  R("signin");
});
c.handle("senti:quit", () => M ? !1 : (p.quit(), !0));
