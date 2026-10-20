import { existsSync as k, readFileSync as D, mkdirSync as E, writeFileSync as A, unlinkSync as Ee, readdirSync as Y, statSync as pe, rmdirSync as Ze } from "fs";
import { execFileSync as X, spawn as b, execFile as I } from "child_process";
import Ae from "http";
import w from "os";
import Ke from "electron";
import u from "path";
import { fileURLToPath as Je } from "url";
function Ye(t, e) {
  const n = u.resolve(t), r = u.resolve(n, e || ""), s = n.endsWith(u.sep) ? n : n + u.sep;
  return r !== n && !r.startsWith(s) ? null : r;
}
const { app: f, BrowserWindow: Me, screen: C, ipcMain: c, globalShortcut: le, safeStorage: W, session: re, shell: F, Tray: Xe, Menu: Qe, nativeImage: be, powerSaveBlocker: ke, desktopCapturer: fe, clipboard: Te } = Ke;
let x = null, v = null;
const et = Je(import.meta.url), he = u.dirname(et), G = process.env.VITE_DEV_SERVER_URL, Fe = "http://localhost:5173";
let o = null, ce = "";
const tt = {
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
}, nt = 47615;
function rt(t) {
  for (const e of t)
    try {
      if (e && k(e)) return e;
    } catch {
    }
  return null;
}
function $() {
  if (process.platform !== "win32") return null;
  const t = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", e = u.join(t, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), n = u.join(t, "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe");
  return rt([e, n, "powershell.exe"]);
}
function ot(t) {
  return new Promise((e, n) => {
    const r = Ae.createServer((l, a) => {
      try {
        let d = decodeURIComponent((l.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const m = u.normalize(d).replace(/^([/\\])+/, ""), p = u.join(t, m);
        if (!p.startsWith(t) || !k(p)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const y = D(p);
        a.writeHead(200, {
          "Content-Type": tt[u.extname(p).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(y);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = nt, i = 0;
    r.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => r.listen(s, "127.0.0.1"), 40)) : n(l);
    }), r.on("listening", () => e(`http://127.0.0.1:${s}`)), r.listen(s, "127.0.0.1");
  });
}
const N = () => u.join(f.getPath("userData"), "device.token");
function st(t) {
  try {
    return E(u.dirname(N()), { recursive: !0 }), W.isEncryptionAvailable() ? (A(N(), W.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function _e() {
  try {
    return !k(N()) || !W.isEncryptionAvailable() ? null : W.decryptString(D(N()));
  } catch {
    return null;
  }
}
function it() {
  try {
    k(N()) && Ee(N());
  } catch {
  }
}
const z = () => u.join(f.getPath("userData"), "screen-source.json");
function at() {
  var t;
  try {
    if (!k(z())) return null;
    const e = (t = JSON.parse(D(z(), "utf8"))) == null ? void 0 : t.displayId;
    return typeof e == "string" && e ? e : null;
  } catch {
    return null;
  }
}
function lt(t) {
  try {
    E(u.dirname(z()), { recursive: !0 }), A(z(), JSON.stringify({ displayId: t }));
  } catch {
  }
}
let ue = at();
function me() {
  if (ue) {
    const t = C.getAllDisplays().find((e) => String(e.id) === ue);
    if (t) return t;
  }
  return C.getPrimaryDisplay();
}
function ct() {
  const t = C.getAllDisplays(), e = Math.min(...t.map((i) => i.bounds.x)), n = Math.min(...t.map((i) => i.bounds.y)), r = Math.max(...t.map((i) => i.bounds.x + i.bounds.width)), s = Math.max(...t.map((i) => i.bounds.y + i.bounds.height));
  return { x: e, y: n, width: r - e, height: s - n };
}
const V = () => u.join(f.getPath("userData"), "setup.json");
function ut() {
  var t;
  try {
    return k(V()) ? ((t = JSON.parse(D(V(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function dt(t) {
  try {
    E(u.dirname(V()), { recursive: !0 }), A(V(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const Ne = 200, q = () => u.join(f.getPath("userData"), "memories.json");
function Z() {
  try {
    if (!k(q())) return [];
    const t = JSON.parse(D(q(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function ye(t) {
  try {
    E(u.dirname(q()), { recursive: !0 }), A(q(), JSON.stringify(t.slice(-Ne)));
  } catch {
  }
}
const pt = 21, ft = 3, K = () => u.join(f.getPath("userData"), "activity.json");
function de() {
  try {
    if (!k(K())) return [];
    const t = JSON.parse(D(K(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function Oe(t) {
  try {
    E(u.dirname(K()), { recursive: !0 }), A(K(), JSON.stringify(t));
  } catch {
  }
}
function ht(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function mt(t, e, n) {
  const r = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(n) || 0));
  if (!r || !i) return de();
  const l = /* @__PURE__ */ new Date(), a = l.toISOString().slice(0, 10), d = ht(l), m = new Date(l.getTime() - pt * 864e5).toISOString().slice(0, 10), p = de().filter((P) => P.day >= m);
  let y = p.find((P) => P.day === a && P.process === r && P.part === d);
  return y || (y = { day: a, process: r, part: d, minutes: 0, samples: [] }, p.push(y)), y.minutes = Math.round((y.minutes + i) * 10) / 10, s && !y.samples.includes(s) && y.samples.length < ft && y.samples.push(s), Oe(p), p;
}
function yt(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return Z();
  const n = Z(), r = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === r)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-Ne);
  return ye(s), s;
}
let j = null;
const wt = 2e4;
function gt() {
  var r, s;
  const t = w.totalmem() / 1073741824, e = w.freemem() / 1024 ** 3, n = t - e;
  return {
    os: `${w.type()} ${w.release()}`,
    cpu: ((s = (r = w.cpus()[0]) == null ? void 0 : r.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: w.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / t * 100),
    uptimeHours: +(w.uptime() / 3600).toFixed(1)
  };
}
function St() {
  const t = $();
  if (!t) return Promise.resolve({});
  const e = `
$ErrorActionPreference='SilentlyContinue'
$d = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
     ForEach-Object { [pscustomobject]@{ drive=$_.DeviceID; totalGB=[math]::Round($_.Size/1GB,1); freeGB=[math]::Round($_.FreeSpace/1GB,1) } }
$p = Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First 6 |
     ForEach-Object { [pscustomobject]@{ name=$_.ProcessName; memMB=[math]::Round($_.WorkingSet/1MB) } }
$s = (Get-CimInstance Win32_StartupCommand | Measure-Object).Count
[pscustomobject]@{ disks=@($d); topProcesses=@($p); startupApps=$s } | ConvertTo-Json -Compress -Depth 4
`;
  return new Promise((n) => {
    I(
      t,
      ["-NoProfile", "-NonInteractive", "-Command", e],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (r, s) => {
        if (r || !s) return n({});
        try {
          const i = JSON.parse(s), l = (i.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          n({
            disks: l,
            topProcesses: i.topProcesses || [],
            startupApps: typeof i.startupApps == "number" ? i.startupApps : void 0
          });
        } catch {
          n({});
        }
      }
    );
  });
}
const $e = {
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
function bt(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? $e[e] ? $e[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let oe = null, xe = 0;
const kt = /* @__PURE__ */ new Set([
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
function se(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function $t() {
  const t = [];
  return process.env.ProgramData && t.push(u.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(u.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function xt() {
  const t = Date.now();
  if (oe && t - xe < 5 * 6e4) return oe;
  const e = [], n = t, r = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = Y(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const d = u.join(s, a.name);
      a.isDirectory() ? r(d, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: d });
    }
  };
  for (const s of $t()) r(s, 0);
  return oe = e, xe = t, e;
}
function ie(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = se(e), r = e.split(/\s+/).map(se).filter((i) => i.length >= 2 && !kt.has(i));
  if (!n && !r.length) return null;
  let s = null;
  for (const i of xt()) {
    const l = se(i.name);
    let a = 0;
    if (l === n) a = 100;
    else if (n.length >= 3 && l.includes(n)) a = 60 - Math.min(25, l.length - n.length);
    else {
      let d = 0;
      for (const m of r) m.length >= 3 && l.includes(m) && d++;
      d && (a = 20 + d * 12 - Math.min(15, Math.floor(l.length / 6)));
    }
    a > 0 && (!s || a > s.score) && (s = { app: i, score: a });
  }
  return s && s.score >= 20 ? s.app : null;
}
async function vt(t) {
  const e = bt(t);
  if (e)
    try {
      if (e.kind === "url")
        return F.openExternal(e.target), { ok: !0, label: e.label };
      if (await Ct(e.label, e.target))
        return { ok: !0, label: e.label, focused: !0 };
      const r = ie(e.label) || ie(e.target);
      return r ? (F.openPath(r.path), { ok: !0, label: e.label }) : (b("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label });
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = ie(t);
  if (n)
    try {
      return F.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
const Pt = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SentinelFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
}
"@
$p = $null
foreach ($n in $names) {
  $p = Get-Process -Name $n | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($p) { break }
}
if (-not $p) { Write-Output 'no'; exit }
$h = $p.MainWindowHandle
if ([SentinelFocus]::IsIconic($h)) { [void][SentinelFocus]::ShowWindow($h, 9) }
[SentinelFocus]::keybd_event(0x12, 0, 0, [IntPtr]::Zero)
[void][SentinelFocus]::SetForegroundWindow($h)
[SentinelFocus]::keybd_event(0x12, 0, 2, [IntPtr]::Zero)
Write-Output 'yes'
`, It = {
  "VS Code": ["Code"],
  Chrome: ["chrome"],
  Edge: ["msedge"],
  Firefox: ["firefox"],
  Spotify: ["Spotify"],
  Discord: ["Discord"],
  Steam: ["steam"],
  Notepad: ["notepad"],
  "File Explorer": ["explorer"],
  "Task Manager": ["Taskmgr"],
  Terminal: ["WindowsTerminal", "wt"],
  Paint: ["mspaint"],
  Calculator: ["CalculatorApp", "Calculator"]
};
function Ct(t, e) {
  const n = $();
  if (!n) return Promise.resolve(!1);
  const r = (It[t] ?? [e.replace(/\.exe$/i, "")]).map((i) => i.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!r.length) return Promise.resolve(!1);
  const s = `$names = @(${r.map((i) => `'${i}'`).join(",")})
`;
  return new Promise((i) => {
    try {
      I(
        n,
        ["-NoProfile", "-NonInteractive", "-Command", s + Pt],
        { timeout: 6e3, windowsHide: !0 },
        (l, a) => i(!l && String(a).trim() === "yes")
      );
    } catch {
      i(!1);
    }
  });
}
function Dt(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|show|go to|reveal)\s+/, "").replace(/^(my|the)\s+/, "").replace(/\s+(folder|directory)$/, "").trim(), n = {
    temp: { shell: w.tmpdir(), label: "your Temp folder" },
    "temp files": { shell: w.tmpdir(), label: "your Temp folder" },
    "temporary files": { shell: w.tmpdir(), label: "your Temp folder" },
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
      return { path: f.getPath(s.key), label: s.label };
    } catch {
      return null;
    }
  return null;
}
function Et(t) {
  const e = Dt(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? b("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && F.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const At = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, Mt = 15 * 1024 * 1024;
function Re(t, e) {
  const n = At[t];
  if (!n) return null;
  let r;
  try {
    r = f.getPath(n);
  } catch {
    return null;
  }
  const s = Ye(r, e);
  return s ? { base: r, full: s } : null;
}
function Tt(t, e) {
  const n = Re(t, e);
  if (!n) throw new Error("Not allowed");
  const s = Y(n.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let l = 0, a = 0;
    try {
      const d = pe(u.join(n.full, i.name));
      l = d.size, a = d.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: l, modified: a };
  }).sort((i, l) => i.dir === l.dir ? i.name.localeCompare(l.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: s });
}
function Ft(t, e) {
  const n = Re(t, e);
  if (!n) throw new Error("Not allowed");
  const r = pe(n.full);
  if (!r.isFile()) throw new Error("Not a file");
  if (r.size > Mt) throw new Error("File is too large to send (15 MB limit)");
  const s = D(n.full);
  return JSON.stringify({
    name: u.basename(n.full),
    size: r.size,
    base64: s.toString("base64")
  });
}
const ve = 8e3, Pe = 40;
function _t(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return f.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), r = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, d) => {
    if (d > 4 || Date.now() - r > ve || i.length >= Pe) return;
    let m;
    try {
      m = Y(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const p of m) {
      if (Date.now() - r > ve || i.length >= Pe) return;
      if (p.name.startsWith(".") || s.test(p.name)) continue;
      const y = u.join(a, p.name);
      try {
        if (p.isSymbolicLink()) continue;
        p.isDirectory() ? l(y, d + 1) : p.isFile() && p.name.toLowerCase().includes(e) && i.push({ name: p.name, path: y });
      } catch {
      }
    }
  };
  for (const a of n) l(a, 0);
  if (i.length === 0) return { ok: !1, error: "not-found", count: 0 };
  i.sort((a, d) => {
    const m = a.name.toLowerCase(), p = d.name.toLowerCase(), y = m === e || m.replace(/\.[^.]+$/, "") === e, P = p === e || p.replace(/\.[^.]+$/, "") === e;
    return y !== P ? y ? -1 : 1 : a.name.length - d.name.length;
  });
  try {
    return F.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const Ie = 2e4;
function je() {
  const t = [w.tmpdir(), u.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, r = 0;
  const s = (i, l) => {
    if (l > 6 || Date.now() - e > Ie || !/temp/i.test(i)) return;
    let a;
    try {
      a = Y(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of a) {
      if (Date.now() - e > Ie) return;
      const m = u.join(i, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          s(m, l + 1);
          try {
            Ze(m);
          } catch {
          }
        } else if (d.isFile()) {
          const p = pe(m).size;
          Ee(m), n += p, r++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: r };
}
function Nt() {
  const t = $();
  if (!t) return { freedMB: 0, files: 0 };
  const e = [
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
    const r = (X(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [s, i] = r.split(/\s+/).map((l) => parseInt(l, 10));
    return {
      files: Number.isFinite(s) ? s : 0,
      freedMB: Number.isFinite(i) ? Math.round(i / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
const Ot = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SentinelWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
}
"@
$h = [SentinelWin]::GetForegroundWindow()
$sb = New-Object Text.StringBuilder 512
[void][SentinelWin]::GetWindowText($h, $sb, 512)
$pid2 = 0
[void][SentinelWin]::GetWindowThreadProcessId($h, [ref]$pid2)
$proc = (Get-Process -Id $pid2).ProcessName
[Console]::Out.Write((ConvertTo-Json @{ title = $sb.ToString(); process = $proc } -Compress))
`;
function we() {
  const t = $();
  return t ? new Promise((e) => {
    try {
      I(
        t,
        ["-NoProfile", "-NonInteractive", "-Command", Ot],
        { timeout: 5e3, windowsHide: !0 },
        (n, r) => {
          if (n || !r) return e(null);
          try {
            const s = JSON.parse(r.trim()), i = String(s.title || "").slice(0, 200), l = String(s.process || "").slice(0, 60);
            e(i || l ? { title: i, process: l } : null);
          } catch {
            e(null);
          }
        }
      );
    } catch {
      e(null);
    }
  }) : Promise.resolve(null);
}
const Rt = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SentinelIn {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);
}
"@
$MOVE=0x0001; $ABS=0x8000; $VDESK=0x4000; $LD=0x0002; $LU=0x0004; $RD=0x0008; $RU=0x0010
$MD=0x0020; $MU=0x0040; $WHEEL=0x0800; $HWHEEL=0x01000; $KEYUP=0x0002

function Send-Key([byte]$vk, [int]$shiftState) {
  if ($shiftState -band 1) { [SentinelIn]::keybd_event(0x10,0,0,[IntPtr]::Zero) }
  if ($shiftState -band 2) { [SentinelIn]::keybd_event(0x11,0,0,[IntPtr]::Zero) }
  if ($shiftState -band 4) { [SentinelIn]::keybd_event(0x12,0,0,[IntPtr]::Zero) }
  [SentinelIn]::keybd_event($vk,0,0,[IntPtr]::Zero)
  [SentinelIn]::keybd_event($vk,0,$KEYUP,[IntPtr]::Zero)
  if ($shiftState -band 4) { [SentinelIn]::keybd_event(0x12,0,$KEYUP,[IntPtr]::Zero) }
  if ($shiftState -band 2) { [SentinelIn]::keybd_event(0x11,0,$KEYUP,[IntPtr]::Zero) }
  if ($shiftState -band 1) { [SentinelIn]::keybd_event(0x10,0,$KEYUP,[IntPtr]::Zero) }
}

function Key-Down([byte]$vk) { [SentinelIn]::keybd_event($vk,0,0,[IntPtr]::Zero) }
function Key-Up([byte]$vk)   { [SentinelIn]::keybd_event($vk,0,0x0002,[IntPtr]::Zero) }

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $p = $line.Trim().Split(' ')
  switch ($p[0]) {
    'M' {
      $x = [int]([double]$p[1] * 65535); $y = [int]([double]$p[2] * 65535)
      [SentinelIn]::mouse_event($MOVE -bor $ABS -bor $VDESK, $x, $y, 0, [IntPtr]::Zero)
    }
    'R' {
      [SentinelIn]::mouse_event($MOVE, [int]$p[1], [int]$p[2], 0, [IntPtr]::Zero)
    }
    'C' {
      if ([double]$p[2] -ge 0) {
        $x = [int]([double]$p[2] * 65535); $y = [int]([double]$p[3] * 65535)
        [SentinelIn]::mouse_event($MOVE -bor $ABS -bor $VDESK, $x, $y, 0, [IntPtr]::Zero)
      }
      $down = $LD; $up = $LU
      if ($p[1] -eq 'right') { $down = $RD; $up = $RU }
      elseif ($p[1] -eq 'middle') { $down = $MD; $up = $MU }
      $times = 1
      if ($p.Length -gt 4 -and $p[4] -eq '2') { $times = 2 }
      for ($i = 0; $i -lt $times; $i++) {
        [SentinelIn]::mouse_event($down, 0, 0, 0, [IntPtr]::Zero)
        [SentinelIn]::mouse_event($up, 0, 0, 0, [IntPtr]::Zero)
      }
    }
    'S' { [SentinelIn]::mouse_event($WHEEL, 0, 0, [int]$p[1], [IntPtr]::Zero) }
    'H' { [SentinelIn]::mouse_event($HWHEEL, 0, 0, [int]$p[1], [IntPtr]::Zero) }
    'T' {
      $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))
      foreach ($ch in $text.ToCharArray()) {
        if ($ch -eq "\`n") { Send-Key 0x0D 0; continue }
        $scan = [SentinelIn]::VkKeyScan($ch)
        if ($scan -eq -1) { continue }
        Send-Key ([byte]($scan -band 0xFF)) (($scan -shr 8) -band 0xFF)
      }
    }
    'D' {
      $vk = [byte]([Convert]::ToInt32($p[1], 16))
      Key-Down $vk
    }
    'U' {
      $vk = [byte]([Convert]::ToInt32($p[1], 16))
      Key-Up $vk
    }
  }
}
`;
let h = null;
function Le() {
  if (h && !h.killed) return !0;
  const t = $();
  if (!t)
    return console.error("[RemoteInput] PowerShell not found; remote control input disabled."), !1;
  try {
    const e = u.join(f.getPath("userData"), "input.ps1");
    return E(u.dirname(e), { recursive: !0 }), A(e, Rt, "utf8"), h = b(
      t,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", e],
      { stdio: ["pipe", "ignore", "ignore"], windowsHide: !0 }
    ), h.on("error", (n) => {
      console.error("[RemoteInput] PowerShell injector failed:", n), h = null;
    }), h.on("exit", () => {
      h = null;
    }), !0;
  } catch {
    return h = null, !1;
  }
}
function Q() {
  try {
    h == null || h.kill();
  } catch {
  }
  h = null;
}
const J = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Escape: 27,
  " ": 32,
  PageUp: 33,
  PageDown: 34,
  End: 35,
  Home: 36,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Insert: 45,
  Delete: 46,
  PrintScreen: 44,
  Pause: 19,
  NumLock: 144,
  CapsLock: 20,
  ScrollLock: 145,
  Meta: 91,
  ContextMenu: 93,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
  Numpad0: 96,
  Numpad1: 97,
  Numpad2: 98,
  Numpad3: 99,
  Numpad4: 100,
  Numpad5: 101,
  Numpad6: 102,
  Numpad7: 103,
  Numpad8: 104,
  Numpad9: 105,
  NumpadMultiply: 106,
  NumpadAdd: 107,
  NumpadEnter: 13,
  NumpadSubtract: 109,
  NumpadDecimal: 110,
  NumpadDivide: 111
}, T = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function Ce(t, e) {
  const n = me(), r = ct(), s = n.bounds.x + t * n.bounds.width, i = n.bounds.y + e * n.bounds.height;
  return {
    x: T((s - r.x) / r.width),
    y: T((i - r.y) / r.height)
  };
}
function jt(t) {
  switch (t.t) {
    case "move": {
      const e = Ce(T(t.x), T(t.y));
      return `M ${e.x.toFixed(5)} ${e.y.toFixed(5)}`;
    }
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      if (typeof t.x != "number" || t.x < 0) return `C ${e} -1 -1 ${n}`;
      const r = Ce(T(t.x), T(t.y));
      return `C ${e} ${r.x.toFixed(5)} ${r.y.toFixed(5)} ${n}`;
    }
    case "scroll": {
      const e = Number(t.d) || 0, n = t.axis === "x", r = Math.max(-10, Math.min(10, Math.round(-e / 100)));
      return r ? n ? `H ${r * 120}` : `S ${r * 120}` : null;
    }
    case "type": {
      const e = String(t.text ?? "").slice(0, 500);
      return e ? `T ${Buffer.from(e, "utf8").toString("base64")}` : null;
    }
    case "keydown": {
      const e = String(t.k), n = J[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const r = Array.isArray(t.mods) ? t.mods : [], s = [];
      return r.includes("shift") && s.push("D 0x10"), r.includes("ctrl") && s.push("D 0x11"), r.includes("alt") && s.push("D 0x12"), s.push(`D 0x${n.toString(16)}`), s.join(`
`);
    }
    case "keyup": {
      const e = String(t.k), n = J[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const r = Array.isArray(t.mods) ? t.mods : [], s = [];
      return s.push(`U 0x${n.toString(16)}`), r.includes("alt") && s.push("U 0x12"), r.includes("ctrl") && s.push("U 0x11"), r.includes("shift") && s.push("U 0x10"), s.join(`
`);
    }
    default:
      return null;
  }
}
function R(t) {
  if (!Array.isArray(t) || !t.length || !Le() || !(h != null && h.stdin)) return !1;
  const e = [];
  for (const n of t) {
    const r = n;
    switch (r.t) {
      case "keydown":
        Wt(String(r.k ?? ""), Array.isArray(r.mods) ? r.mods : []);
        continue;
      case "keyup":
        Gt(String(r.k ?? ""), Array.isArray(r.mods) ? r.mods : []);
        continue;
    }
    const s = jt(r);
    if (typeof s == "string")
      for (const i of s.split(`
`)) {
        const l = i.trim();
        l && e.push(l);
      }
  }
  if (!e.length) return !0;
  try {
    return h.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return Q(), !1;
  }
}
const S = /* @__PURE__ */ new Set(), O = /* @__PURE__ */ new Map(), Lt = 400, Bt = 32, Ut = /* @__PURE__ */ new Set([16, 17, 18, 91, 92]);
function Ht(t) {
  Be(t);
  const e = window.setTimeout(() => {
    g(`D 0x${t.toString(16)}`);
    const n = window.setInterval(() => {
      g(`D 0x${t.toString(16)}`);
    }, Bt);
    O.set(t, { down: e, interval: n });
  }, Lt);
  O.set(t, { down: e, interval: -1 });
}
function Be(t) {
  const e = O.get(t);
  e && (clearTimeout(e.down), clearInterval(e.interval), O.delete(t));
}
function g(t) {
  if (!(!Le() || !(h != null && h.stdin)))
    try {
      h.stdin.write(t + `
`);
    } catch {
      Q();
    }
}
function Wt(t, e) {
  const n = J[t] ?? (/^[a-zA-Z0-9]$/.test(t) ? t.toUpperCase().charCodeAt(0) : void 0);
  n !== void 0 && (e.includes("shift") && !S.has(16) && g("D 0x10"), e.includes("ctrl") && !S.has(17) && g("D 0x11"), e.includes("alt") && !S.has(18) && g("D 0x12"), g(`D 0x${n.toString(16)}`), S.add(n), Ut.has(n) || Ht(n));
}
function Gt(t, e) {
  const n = J[t] ?? (/^[a-zA-Z0-9]$/.test(t) ? t.toUpperCase().charCodeAt(0) : void 0);
  n !== void 0 && (Be(n), g(`U 0x${n.toString(16)}`), S.delete(n), e.includes("alt") && (g("U 0x12"), S.delete(18)), e.includes("ctrl") && (g("U 0x11"), S.delete(17)), e.includes("shift") && (g("U 0x10"), S.delete(16)));
}
function zt() {
  for (const t of S) g(`U 0x${t.toString(16)}`);
  S.clear();
  for (const [, t] of O)
    clearTimeout(t.down), clearInterval(t.interval);
  O.clear();
}
const Vt = 900;
function L(t) {
  return new Promise((e) => setTimeout(e, t));
}
async function De(t) {
  const e = await we();
  if (!e) return !1;
  const n = e.process.toLowerCase();
  return n !== "explorer" && n !== "cabinetwclass" ? !1 : e.title.toLowerCase().includes(t.toLowerCase());
}
async function qt() {
  const t = w.tmpdir(), e = u.basename(t);
  try {
    F.openPath(t);
  } catch {
    return !1;
  }
  let n = !1;
  for (let r = 0; r < 14; r++)
    if (await L(400), await De(e)) {
      n = !0;
      break;
    }
  if (!n || !R([{ t: "key", k: "a", mods: ["ctrl"] }]) || (await L(700), !await De(e)) || !R([{ t: "key", k: "Delete", mods: ["shift"] }])) return !1;
  await L(Vt), R([{ t: "key", k: "Enter" }]);
  for (let r = 0; r < 3; r++)
    await L(1200), R([{ t: "key", k: "Enter" }]);
  return !0;
}
function Zt() {
  try {
    return b("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Kt(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      I("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
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
function Jt(t) {
  const e = $();
  if (!e) return !1;
  const s = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return I(e, ["-NoProfile", "-NonInteractive", "-Command", s], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
async function Yt(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = t.toLowerCase().trim();
  if (!e) return { ok: !1, error: "unknown" };
  const n = $();
  if (!n) return { ok: !1, error: "unknown" };
  const r = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.ProcessName -match '${e.replace(/'/g, "''")}' } | Select-Object -First 1 -ExpandProperty ProcessName`;
  return new Promise((s) => {
    try {
      I(n, ["-NoProfile", "-NonInteractive", "-Command", r], { timeout: 5e3, windowsHide: !0 }, (i, l) => {
        if (i || !(l != null && l.trim())) {
          const d = `Get-Process | Where-Object { $_.ProcessName -match '${e.replace(/'/g, "''")}' } | Select-Object -First 1 -ExpandProperty ProcessName`;
          I(n, ["-NoProfile", "-NonInteractive", "-Command", d], { timeout: 5e3, windowsHide: !0 }, (m, p) => {
            if (m || !(p != null && p.trim())) return s({ ok: !1, error: "unknown" });
            const y = p.trim();
            try {
              b("taskkill", ["/IM", y, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), s({ ok: !0, label: y.replace(/\.exe$/i, "") });
            } catch {
              s({ ok: !1, error: "failed" });
            }
          });
          return;
        }
        const a = l.trim();
        try {
          b("taskkill", ["/IM", a, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), s({ ok: !0, label: a.replace(/\.exe$/i, "") });
        } catch {
          s({ ok: !1, error: "failed" });
        }
      });
    } catch {
      s({ ok: !1, error: "failed" });
    }
  });
}
async function Ue() {
  const t = await we();
  if (!t) return { ok: !1, label: "", error: "nothing" };
  const e = t.process.toLowerCase().replace(/\.exe$/i, ""), n = t.title || e;
  t.title.match(/pid:(\d+)/i);
  const s = {
    explorer: "explorer.exe",
    code: "Code.exe",
    chrome: "chrome.exe",
    msedge: "msedge.exe",
    firefox: "firefox.exe",
    spotify: "Spotify.exe",
    discord: "Discord.exe",
    steam: "steam.exe",
    notepad: "notepad.exe",
    mspaint: "mspaint.exe",
    CalculatorApp: "CalculatorApp.exe",
    wt: "WindowsTerminal.exe"
  }[e] || (e.endsWith(".exe") ? e : e + ".exe");
  try {
    return b("taskkill", ["/IM", s, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: n };
  } catch {
    return { ok: !1, label: n, error: "failed" };
  }
}
function He() {
  try {
    const t = $();
    return t ? (X(t, [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(New-Object -ComObject Shell.Application).MinimizeAll()"
    ], { windowsHide: !0, timeout: 4e3 }), !0) : !1;
  } catch {
    return !1;
  }
}
async function Xt() {
  if (j && Date.now() - j.at < wt) return j.data;
  const t = gt();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await St();
    } catch {
    }
  const n = { ...t, ...e };
  return j = { at: Date.now(), data: n }, n;
}
async function Qt(t) {
  const { baseUrl: e, path: n, method: r = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = _e();
    if (!a) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${a}`;
  }
  try {
    const a = await fetch(`${e}${n}`, {
      method: r,
      headers: l,
      body: s === void 0 ? void 0 : JSON.stringify(s)
    }), d = await a.json().catch(() => null);
    return { ok: a.ok, status: a.status, data: d };
  } catch (a) {
    return {
      ok: !1,
      status: 0,
      data: { error: a instanceof Error ? a.message : "Network error" }
    };
  }
}
const en = "CommandOrControl+Shift+Space", tn = "CommandOrControl+Shift+Q";
function nn(t, e = 15e3) {
  return new Promise((n, r) => {
    const s = Date.now(), i = () => {
      Ae.get(t, (d) => {
        d.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? r(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function We() {
  const { width: t, height: e } = C.getPrimaryDisplay().workAreaSize, n = u.join(he, "preload.cjs");
  o = new Me({
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
      backgroundThrottling: !1,
      // Remote control plays the other machine's system audio. Chromium's
      // default policy blocks sound until the user clicks the page, which
      // would silently mute a session that looks like it's working.
      autoplayPolicy: "no-user-gesture-required"
    }
  }), o.setVisibleOnAllWorkspaces(!0), o.setMenuBarVisibility(!1), o.setAlwaysOnTop(!0, "screen-saver"), G ? o.loadURL(Fe).catch((r) => {
    console.error("[Electron] Failed to load dev server:", r.message);
  }) : ce ? o.loadURL(ce).catch((r) => {
    console.error("[Electron] Failed to load prod server:", r.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), o.webContents.on("did-finish-load", () => {
    var r, s;
    o == null || o.show(), o == null || o.focus(), G && ((s = (r = o == null ? void 0 : o.webContents) == null ? void 0 : r.openDevTools) == null || s.call(r));
  }), o.webContents.on("did-fail-load", (r, s, i, l, a) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: i, validatedURL: l, isMainFrame: a });
  }), o.webContents.on("console-message", (r, s, i) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${l}] ${i}`);
  }), o.webContents.on("render-process-gone", (r, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), o.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), o.on("close", (r) => {
    ee || (r.preventDefault(), o == null || o.hide());
  });
}
f.requestSingleInstanceLock() ? f.on("second-instance", () => {
  o && !o.isDestroyed() && ze();
}) : f.quit();
f.whenReady().then(async () => {
  if (G)
    try {
      await nn(Fe);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), f.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (re.defaultSession.setPermissionRequestHandler((e, n, r) => {
    r(t(n));
  }), re.defaultSession.setPermissionCheckHandler((e, n) => t(n)), re.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    fe.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((r) => {
      const s = String(me().id), l = r.find((a) => a.display_id === s) || r[0];
      n(l ? { video: l } : {});
    });
  }), !G)
    try {
      ce = await ot(u.join(he, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), f.quit();
      return;
    }
  We(), Ve();
  try {
    le.register(en, () => {
      o == null || o.webContents.send("senti:talk");
    });
  } catch {
  }
  try {
    le.register(tn, () => {
      Ue(), He();
    });
  } catch {
  }
  process.platform === "win32" && f.isPackaged && f.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
f.on("activate", () => {
  Me.getAllWindows().length === 0 ? We() : (o == null || o.show(), o == null || o.focus());
});
f.on("window-all-closed", () => {
  ee && process.platform !== "darwin" && f.quit();
});
f.on("before-quit", () => {
  ee = !0;
});
f.on("before-quit", () => {
  o = null;
});
f.on("will-quit", () => {
  le.unregisterAll(), Q();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : st(e.trim()));
c.handle("senti:token-clear", () => (it(), !0));
c.handle("senti:token-present", () => !!_e());
c.on("senti:get-setup", (t) => {
  t.returnValue = ut();
});
c.handle("senti:set-setup", (t, e) => (dt(!!e), !0));
c.handle("senti:system-info", () => Xt());
c.handle("senti:clipboard-read", () => {
  try {
    return Te.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && Te.writeText(e), !0;
  } catch {
    return !1;
  }
});
async function Ge(t = 1600) {
  var e;
  try {
    const n = C.getPrimaryDisplay(), { width: r, height: s } = n.size, i = Math.min(1, t / r), a = (e = (await fe.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(r * i), height: Math.round(s * i) }
    }))[0]) == null ? void 0 : e.thumbnail;
    return !a || a.isEmpty() ? null : a.toDataURL();
  } catch {
    return null;
  }
}
async function rn() {
  const t = await Ge(4096);
  if (!t) return { ok: !1 };
  try {
    const e = u.join(f.getPath("pictures"), "Senti");
    E(e, { recursive: !0 });
    const n = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19), r = u.join(e, `screenshot-${n}.png`);
    return A(r, Buffer.from(t.split(",")[1], "base64")), { ok: !0, path: r };
  } catch {
    return { ok: !1 };
  }
}
c.handle("senti:screenshot-save", () => rn());
c.handle("senti:screenshot-grab", () => Ge(1600));
c.handle("senti:screen-sources", async () => {
  try {
    const t = await fe.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }), e = String(me().id);
    return t.map((n) => {
      const r = n.display_id || "";
      return { id: n.id, name: n.name, displayId: r, selected: !!r && r === e };
    });
  } catch {
    return [];
  }
});
c.handle("senti:set-screen-source", (t, e) => typeof e != "string" || !e || !C.getAllDisplays().some((r) => String(r.id) === e) ? !1 : (ue = e, lt(e), !0));
c.handle("senti:memory-list", () => Z());
c.handle("senti:memory-add", (t, e) => yt(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = Z().filter((r) => r.id !== String(e));
  return ye(n), n;
});
c.handle("senti:memory-clear", () => (ye([]), []));
c.handle(
  "senti:activity-record",
  (t, e, n, r) => mt(e, n, r)
);
c.handle("senti:activity-list", () => de());
c.handle("senti:activity-clear", () => (Oe([]), []));
let M = null;
const B = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const r = typeof n == "string" && n ? n : "default";
    return e ? B.add(r) : B.delete(r), B.size > 0 && M === null ? M = ke.start("prevent-display-sleep") : B.size === 0 && M !== null && (ke.stop(M), M = null), M !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => vt(e));
c.handle("senti:close-app", (t, e) => Yt(e));
c.handle("senti:close-current-app", async () => Ue());
c.handle("senti:show-desktop", () => He());
c.handle("senti:clean-temp", () => je());
c.handle("senti:clean-temp-visible", async () => {
  const t = await qt();
  return { ...je(), shown: t };
});
c.handle("senti:empty-recycle-bin", () => Nt());
c.handle("senti:open-folder", (t, e) => Et(e));
c.handle(
  "senti:serve-list",
  (t, e, n) => Tt(String(e ?? ""), String(n ?? ""))
);
c.handle(
  "senti:serve-read",
  (t, e, n) => Ft(String(e ?? ""), String(n ?? ""))
);
c.handle("senti:open-file", (t, e) => _t(e));
c.handle("senti:lock-workstation", () => Zt());
c.handle("senti:power", (t, e) => Kt(e));
c.handle("senti:active-window", () => we());
c.handle("senti:remote-input", (t, e) => R(e));
c.handle("senti:remote-input-stop", () => (Q(), !0));
c.handle("senti:reset-remote-key-state", () => (zt(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? Jt(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Qt({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: w.hostname(),
  platform: process.platform
}));
let ae = null;
function on() {
  try {
    const e = X(
      "reg",
      ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"],
      { encoding: "utf8", windowsHide: !0 }
    ).match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
    return e ? e[1].trim() : null;
  } catch {
    return null;
  }
}
c.handle("senti:hardware-id", () => (ae || (ae = on() || `${w.hostname()}:${w.platform()}:${w.arch()}`), ae));
let ge = "setup", _ = null, ee = !1;
const U = 380, H = 132;
function Se(t) {
  if (!o || o.isDestroyed()) return;
  const { workArea: e } = C.getPrimaryDisplay();
  t ? o.setBounds({
    x: Math.round(e.x + (e.width - U) / 2),
    y: Math.round(e.y + (e.height - U) / 2 - e.height * 0.06),
    width: U,
    height: U
  }) : o.setBounds({
    x: Math.round(e.x + e.width - H - 18),
    y: Math.round(e.y + e.height - H - 18),
    width: H,
    height: H
  });
}
function te(t) {
  !o || o.isDestroyed() || (ge = t, t === "hud" ? (o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!0), o.setAlwaysOnTop(!0, "screen-saver"), o.setIgnoreMouseEvents(!0, { forward: !0 }), Se(!1), o.showInactive()) : t === "setup" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!0), o.setSkipTaskbar(!1), o.setSize(980, 760), o.center(), o.show()) : t === "panel" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(760, 840), o.center(), o.show(), o.focus()) : (o.setIgnoreMouseEvents(!1), o.setFullScreen(!1), o.setAlwaysOnTop(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(680, 780), o.center(), o.show(), o.focus()), ne());
}
function sn() {
  !o || o.isDestroyed() || ge !== "hud" || (Se(!0), o.showInactive(), o.setAlwaysOnTop(!0, "screen-saver"));
}
function an() {
  !o || o.isDestroyed() || ge !== "hud" || Se(!1);
}
function ln() {
  const t = [
    u.join(process.resourcesPath || "", "build", "icon.png"),
    u.join(he, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (k(e)) {
        const n = be.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return be.createEmpty();
}
function ze() {
  !o || o.isDestroyed() || (o.webContents.send("senti:open-settings"), te("panel"), o.show(), o.focus());
}
function Ve() {
  if (!_)
    try {
      _ = new Xe(ln()), ne(), _.on("click", () => {
        o && !o.isDestroyed() && o.isVisible() ? o.focus() : qe();
      });
    } catch {
    }
}
function ne() {
  if (!_) return;
  const t = o && !o.isDestroyed() && !o.isVisible(), e = [
    {
      label: t ? "Show Senti" : "Hide Senti",
      click: () => {
        t ? qe() : cn();
      }
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => ze()
    },
    {
      label: "Quit Senti",
      click: () => {
        ee = !0, f.quit();
      }
    }
  ];
  _.setContextMenu(Qe.buildFromTemplate(e)), _.setToolTip(t ? "Senti — hidden, listening" : "Senti — listening for you");
}
function cn() {
  !o || o.isDestroyed() || (o.hide(), ne());
}
function qe() {
  !o || o.isDestroyed() || (te("hud"), o.showInactive(), ne());
}
c.handle("senti:set-window-mode", (t, e) => e === "setup" || e === "hud" || e === "panel" ? (te(e), e === "hud" && Ve(), !0) : !1);
c.handle("senti:enter-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setAlwaysOnTop(!1), o.setFullScreen(!0), o.focus(), !0));
c.handle("senti:exit-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setFullScreen(!1), o.setAlwaysOnTop(!0, "screen-saver"), !0));
c.handle("senti:hud-show", () => (sn(), !0));
c.handle("senti:hud-hide", () => (an(), !0));
c.handle("senti:hide-window", () => !o || o.isDestroyed() ? !1 : (o.hide(), !0));
c.handle("senti:restore-window", () => !o || o.isDestroyed() ? !1 : (te("hud"), o.showInactive(), !0));
c.handle("senti:start-screen-context", () => !0);
c.handle("senti:stop-screen-context", () => !0);
c.handle("senti:start-code-bridge", async () => {
  if (x) return !0;
  try {
    const t = await import("./wrapper-CoTtEBNz.js"), e = t.Server || t.default.Server;
    return e ? (x = new e({ port: 9876, host: "127.0.0.1" }), x.on("connection", (n) => {
      v = n, o == null || o.webContents.send("senti:code-bridge-message", { type: "connected" }), n.on("message", (r) => {
        try {
          const s = JSON.parse(r.toString());
          o == null || o.webContents.send("senti:code-bridge-message", s);
        } catch {
        }
      }), n.on("close", () => {
        v = null, o == null || o.webContents.send("senti:code-bridge-message", { type: "disconnected" });
      });
    }), x && x.on("error", () => {
    }), !0) : !1;
  } catch {
    return !1;
  }
});
c.handle("senti:stop-code-bridge", () => {
  if (x) {
    try {
      x.close();
    } catch {
    }
    x = null, v = null;
  }
  return !0;
});
c.handle("senti:send-to-vscode", (t, e) => {
  if (!v || v.readyState !== 1) return !1;
  try {
    return v.send(JSON.stringify(e)), !0;
  } catch {
    return !1;
  }
});
c.handle("senti:is-code-bridge-connected", () => v !== null && v.readyState === 1);
c.handle("senti:running-apps", () => {
  const t = $();
  if (!t) return [];
  const e = `
$ErrorActionPreference='SilentlyContinue'
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -Property ProcessName, MainWindowTitle | ForEach-Object {
  [pscustomobject]@{ name=$_.ProcessName; title=$_.MainWindowTitle }
} | ConvertTo-Json -Compress
`;
  try {
    const n = X(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
      timeout: 5e3,
      windowsHide: !0,
      maxBuffer: 1048576
    }).toString().trim(), r = JSON.parse(n);
    return Array.isArray(r) ? r.slice(0, 50) : [];
  } catch {
    return [];
  }
});
c.handle("senti:quit", () => (f.quit(), !0));
export {
  zt as resetRemoteKeyState
};
