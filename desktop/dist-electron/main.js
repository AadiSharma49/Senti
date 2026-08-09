import { existsSync as v, readFileSync as F, mkdirSync as M, writeFileSync as _, unlinkSync as ve, readdirSync as J, statSync as ae, rmdirSync as He } from "fs";
import { execFileSync as le, spawn as b, execFile as I } from "child_process";
import Pe from "http";
import w from "os";
import Ge from "electron";
import u from "path";
import { fileURLToPath as ze } from "url";
function Ve(t, e) {
  const n = u.resolve(t), r = u.resolve(n, e || ""), s = n.endsWith(u.sep) ? n : n + u.sep;
  return r !== n && !r.startsWith(s) ? null : r;
}
const { app: f, BrowserWindow: Ie, screen: ce, ipcMain: c, globalShortcut: oe, safeStorage: W, session: ee, shell: D, Tray: qe, Menu: Ze, nativeImage: ye, powerSaveBlocker: we, desktopCapturer: ue, clipboard: Ce } = Ge;
let $ = null, x = null;
const Je = ze(import.meta.url), de = u.dirname(Je), H = process.env.VITE_DEV_SERVER_URL, De = "http://localhost:5173";
let o = null, se = "";
const Ke = {
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
}, Ye = 47615;
function Xe(t) {
  for (const e of t)
    try {
      if (e && v(e)) return e;
    } catch {
    }
  return null;
}
function k() {
  if (process.platform !== "win32") return null;
  const t = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", e = u.join(t, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), n = u.join(t, "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe");
  return Xe([e, n, "powershell.exe"]);
}
function Qe(t) {
  return new Promise((e, n) => {
    const r = Pe.createServer((l, a) => {
      try {
        let d = decodeURIComponent((l.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const m = u.normalize(d).replace(/^([/\\])+/, ""), p = u.join(t, m);
        if (!p.startsWith(t) || !v(p)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const y = F(p);
        a.writeHead(200, {
          "Content-Type": Ke[u.extname(p).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(y);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = Ye, i = 0;
    r.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => r.listen(s, "127.0.0.1"), 40)) : n(l);
    }), r.on("listening", () => e(`http://127.0.0.1:${s}`)), r.listen(s, "127.0.0.1");
  });
}
const T = () => u.join(f.getPath("userData"), "device.token");
function et(t) {
  try {
    return M(u.dirname(T()), { recursive: !0 }), W.isEncryptionAvailable() ? (_(T(), W.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function Ee() {
  try {
    return !v(T()) || !W.isEncryptionAvailable() ? null : W.decryptString(F(T()));
  } catch {
    return null;
  }
}
function tt() {
  try {
    v(T()) && ve(T());
  } catch {
  }
}
const G = () => u.join(f.getPath("userData"), "setup.json");
function nt() {
  var t;
  try {
    return v(G()) ? ((t = JSON.parse(F(G(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function rt(t) {
  try {
    M(u.dirname(G()), { recursive: !0 }), _(G(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const Te = 200, z = () => u.join(f.getPath("userData"), "memories.json");
function V() {
  try {
    if (!v(z())) return [];
    const t = JSON.parse(F(z(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function pe(t) {
  try {
    M(u.dirname(z()), { recursive: !0 }), _(z(), JSON.stringify(t.slice(-Te)));
  } catch {
  }
}
const ot = 21, st = 3, q = () => u.join(f.getPath("userData"), "activity.json");
function ie() {
  try {
    if (!v(q())) return [];
    const t = JSON.parse(F(q(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function Ae(t) {
  try {
    M(u.dirname(q()), { recursive: !0 }), _(q(), JSON.stringify(t));
  } catch {
  }
}
function it(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function at(t, e, n) {
  const r = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(n) || 0));
  if (!r || !i) return ie();
  const l = /* @__PURE__ */ new Date(), a = l.toISOString().slice(0, 10), d = it(l), m = new Date(l.getTime() - ot * 864e5).toISOString().slice(0, 10), p = ie().filter((P) => P.day >= m);
  let y = p.find((P) => P.day === a && P.process === r && P.part === d);
  return y || (y = { day: a, process: r, part: d, minutes: 0, samples: [] }, p.push(y)), y.minutes = Math.round((y.minutes + i) * 10) / 10, s && !y.samples.includes(s) && y.samples.length < st && y.samples.push(s), Ae(p), p;
}
function lt(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return V();
  const n = V(), r = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === r)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-Te);
  return pe(s), s;
}
let O = null;
const ct = 2e4;
function ut() {
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
function dt() {
  const t = k();
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
const ge = {
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
function pt(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? ge[e] ? ge[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let te = null, Se = 0;
const ft = /* @__PURE__ */ new Set([
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
function ne(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function ht() {
  const t = [];
  return process.env.ProgramData && t.push(u.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(u.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function mt() {
  const t = Date.now();
  if (te && t - Se < 5 * 6e4) return te;
  const e = [], n = t, r = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = J(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const d = u.join(s, a.name);
      a.isDirectory() ? r(d, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: d });
    }
  };
  for (const s of ht()) r(s, 0);
  return te = e, Se = t, e;
}
function re(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = ne(e), r = e.split(/\s+/).map(ne).filter((i) => i.length >= 2 && !ft.has(i));
  if (!n && !r.length) return null;
  let s = null;
  for (const i of mt()) {
    const l = ne(i.name);
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
async function yt(t) {
  const e = pt(t);
  if (e)
    try {
      if (e.kind === "url")
        return D.openExternal(e.target), { ok: !0, label: e.label };
      if (await St(e.label, e.target))
        return { ok: !0, label: e.label, focused: !0 };
      const r = re(e.label) || re(e.target);
      return r ? (D.openPath(r.path), { ok: !0, label: e.label }) : (b("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label });
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = re(t);
  if (n)
    try {
      return D.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
const wt = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SentiFocus {
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
if ([SentiFocus]::IsIconic($h)) { [void][SentiFocus]::ShowWindow($h, 9) }
[SentiFocus]::keybd_event(0x12, 0, 0, [IntPtr]::Zero)
[void][SentiFocus]::SetForegroundWindow($h)
[SentiFocus]::keybd_event(0x12, 0, 2, [IntPtr]::Zero)
Write-Output 'yes'
`, gt = {
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
function St(t, e) {
  const n = k();
  if (!n) return Promise.resolve(!1);
  const r = (gt[t] ?? [e.replace(/\.exe$/i, "")]).map((i) => i.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!r.length) return Promise.resolve(!1);
  const s = `$names = @(${r.map((i) => `'${i}'`).join(",")})
`;
  return new Promise((i) => {
    try {
      I(
        n,
        ["-NoProfile", "-NonInteractive", "-Command", s + wt],
        { timeout: 6e3, windowsHide: !0 },
        (l, a) => i(!l && String(a).trim() === "yes")
      );
    } catch {
      i(!1);
    }
  });
}
function bt(t) {
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
function kt(t) {
  const e = bt(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? b("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && D.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const $t = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, xt = 15 * 1024 * 1024;
function Fe(t, e) {
  const n = $t[t];
  if (!n) return null;
  let r;
  try {
    r = f.getPath(n);
  } catch {
    return null;
  }
  const s = Ve(r, e);
  return s ? { base: r, full: s } : null;
}
function vt(t, e) {
  const n = Fe(t, e);
  if (!n) throw new Error("Not allowed");
  const s = J(n.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let l = 0, a = 0;
    try {
      const d = ae(u.join(n.full, i.name));
      l = d.size, a = d.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: l, modified: a };
  }).sort((i, l) => i.dir === l.dir ? i.name.localeCompare(l.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: s });
}
function Pt(t, e) {
  const n = Fe(t, e);
  if (!n) throw new Error("Not allowed");
  const r = ae(n.full);
  if (!r.isFile()) throw new Error("Not a file");
  if (r.size > xt) throw new Error("File is too large to send (15 MB limit)");
  const s = F(n.full);
  return JSON.stringify({
    name: u.basename(n.full),
    size: r.size,
    base64: s.toString("base64")
  });
}
const be = 8e3, ke = 40;
function It(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return f.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), r = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, d) => {
    if (d > 4 || Date.now() - r > be || i.length >= ke) return;
    let m;
    try {
      m = J(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const p of m) {
      if (Date.now() - r > be || i.length >= ke) return;
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
    return D.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const $e = 2e4;
function Me() {
  const t = [w.tmpdir(), u.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, r = 0;
  const s = (i, l) => {
    if (l > 6 || Date.now() - e > $e || !/temp/i.test(i)) return;
    let a;
    try {
      a = J(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of a) {
      if (Date.now() - e > $e) return;
      const m = u.join(i, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          s(m, l + 1);
          try {
            He(m);
          } catch {
          }
        } else if (d.isFile()) {
          const p = ae(m).size;
          ve(m), n += p, r++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: r };
}
function Ct() {
  const t = k();
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
    const r = (le(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
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
const Dt = `
$ErrorActionPreference='SilentlyContinue'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SentiWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
}
"@
$h = [SentiWin]::GetForegroundWindow()
$sb = New-Object Text.StringBuilder 512
[void][SentiWin]::GetWindowText($h, $sb, 512)
$pid2 = 0
[void][SentiWin]::GetWindowThreadProcessId($h, [ref]$pid2)
$proc = (Get-Process -Id $pid2).ProcessName
[Console]::Out.Write((ConvertTo-Json @{ title = $sb.ToString(); process = $proc } -Compress))
`;
function fe() {
  const t = k();
  return t ? new Promise((e) => {
    try {
      I(
        t,
        ["-NoProfile", "-NonInteractive", "-Command", Dt],
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
const Et = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SentiIn {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
  [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);
}
"@
$MOVE=0x0001; $ABS=0x8000; $LD=0x0002; $LU=0x0004; $RD=0x0008; $RU=0x0010
$MD=0x0020; $MU=0x0040; $WHEEL=0x0800; $HWHEEL=0x01000; $KEYUP=0x0002

function Send-Key([byte]$vk, [int]$shiftState) {
  if ($shiftState -band 1) { [SentiIn]::keybd_event(0x10,0,0,[IntPtr]::Zero) }
  if ($shiftState -band 2) { [SentiIn]::keybd_event(0x11,0,0,[IntPtr]::Zero) }
  if ($shiftState -band 4) { [SentiIn]::keybd_event(0x12,0,0,[IntPtr]::Zero) }
  [SentiIn]::keybd_event($vk,0,0,[IntPtr]::Zero)
  [SentiIn]::keybd_event($vk,0,$KEYUP,[IntPtr]::Zero)
  if ($shiftState -band 4) { [SentiIn]::keybd_event(0x12,0,$KEYUP,[IntPtr]::Zero) }
  if ($shiftState -band 2) { [SentiIn]::keybd_event(0x11,0,$KEYUP,[IntPtr]::Zero) }
  if ($shiftState -band 1) { [SentiIn]::keybd_event(0x10,0,$KEYUP,[IntPtr]::Zero) }
}

function Key-Down([byte]$vk) { [SentiIn]::keybd_event($vk,0,0,[IntPtr]::Zero) }
function Key-Up([byte]$vk)   { [SentiIn]::keybd_event($vk,0,0x0002,[IntPtr]::Zero) }

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $p = $line.Trim().Split(' ')
  switch ($p[0]) {
    'M' {
      $x = [int]([double]$p[1] * 65535); $y = [int]([double]$p[2] * 65535)
      [SentiIn]::mouse_event($MOVE -bor $ABS, $x, $y, 0, [IntPtr]::Zero)
    }
    'R' {
      [SentiIn]::mouse_event($MOVE, [int]$p[1], [int]$p[2], 0, [IntPtr]::Zero)
    }
    'C' {
      if ([double]$p[2] -ge 0) {
        $x = [int]([double]$p[2] * 65535); $y = [int]([double]$p[3] * 65535)
        [SentiIn]::mouse_event($MOVE -bor $ABS, $x, $y, 0, [IntPtr]::Zero)
      }
      $down = $LD; $up = $LU
      if ($p[1] -eq 'right') { $down = $RD; $up = $RU }
      elseif ($p[1] -eq 'middle') { $down = $MD; $up = $MU }
      $times = 1
      if ($p.Length -gt 4 -and $p[4] -eq '2') { $times = 2 }
      for ($i = 0; $i -lt $times; $i++) {
        [SentiIn]::mouse_event($down, 0, 0, 0, [IntPtr]::Zero)
        [SentiIn]::mouse_event($up, 0, 0, 0, [IntPtr]::Zero)
      }
    }
    'S' { [SentiIn]::mouse_event($WHEEL, 0, 0, [int]$p[1], [IntPtr]::Zero) }
    'H' { [SentiIn]::mouse_event($HWHEEL, 0, 0, [int]$p[1], [IntPtr]::Zero) }
    'T' {
      $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))
      foreach ($ch in $text.ToCharArray()) {
        if ($ch -eq "\`n") { Send-Key 0x0D 0; continue }
        $scan = [SentiIn]::VkKeyScan($ch)
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
function _e() {
  if (h && !h.killed) return !0;
  const t = k();
  if (!t)
    return console.error("[RemoteInput] PowerShell not found; remote control input disabled."), !1;
  try {
    const e = u.join(f.getPath("userData"), "input.ps1");
    return M(u.dirname(e), { recursive: !0 }), _(e, Et, "utf8"), h = b(
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
function K() {
  try {
    h == null || h.kill();
  } catch {
  }
  h = null;
}
const Z = {
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
}, R = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function Tt(t) {
  switch (t.t) {
    case "move":
      return `M ${R(t.x).toFixed(5)} ${R(t.y).toFixed(5)}`;
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      return typeof t.x != "number" || t.x < 0 ? `C ${e} -1 -1 ${n}` : `C ${e} ${R(t.x).toFixed(5)} ${R(t.y).toFixed(5)} ${n}`;
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
      const e = String(t.k), n = Z[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const r = Array.isArray(t.mods) ? t.mods : [], s = [];
      return r.includes("shift") && s.push("D 0x10"), r.includes("ctrl") && s.push("D 0x11"), r.includes("alt") && s.push("D 0x12"), s.push(`D 0x${n.toString(16)}`), s.join(`
`);
    }
    case "keyup": {
      const e = String(t.k), n = Z[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const r = Array.isArray(t.mods) ? t.mods : [], s = [];
      return s.push(`U 0x${n.toString(16)}`), r.includes("alt") && s.push("U 0x12"), r.includes("ctrl") && s.push("U 0x11"), r.includes("shift") && s.push("U 0x10"), s.join(`
`);
    }
    default:
      return null;
  }
}
function N(t) {
  if (!Array.isArray(t) || !t.length || !_e() || !(h != null && h.stdin)) return !1;
  const e = [];
  for (const n of t) {
    const r = n;
    switch (r.t) {
      case "keydown":
        Nt(String(r.k ?? ""), Array.isArray(r.mods) ? r.mods : []);
        continue;
      case "keyup":
        Ot(String(r.k ?? ""), Array.isArray(r.mods) ? r.mods : []);
        continue;
    }
    const s = Tt(r);
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
    return K(), !1;
  }
}
const S = /* @__PURE__ */ new Set(), A = /* @__PURE__ */ new Map(), At = 400, Ft = 32, Mt = /* @__PURE__ */ new Set([16, 17, 18, 91, 92]);
function _t(t) {
  Ne(t);
  const e = window.setTimeout(() => {
    g(`D 0x${t.toString(16)}`);
    const n = window.setInterval(() => {
      g(`D 0x${t.toString(16)}`);
    }, Ft);
    A.set(t, { down: e, interval: n });
  }, At);
  A.set(t, { down: e, interval: -1 });
}
function Ne(t) {
  const e = A.get(t);
  e && (clearTimeout(e.down), clearInterval(e.interval), A.delete(t));
}
function g(t) {
  if (!(!_e() || !(h != null && h.stdin)))
    try {
      h.stdin.write(t + `
`);
    } catch {
      K();
    }
}
function Nt(t, e) {
  const n = Z[t] ?? (/^[a-zA-Z0-9]$/.test(t) ? t.toUpperCase().charCodeAt(0) : void 0);
  n !== void 0 && (e.includes("shift") && !S.has(16) && g("D 0x10"), e.includes("ctrl") && !S.has(17) && g("D 0x11"), e.includes("alt") && !S.has(18) && g("D 0x12"), g(`D 0x${n.toString(16)}`), S.add(n), Mt.has(n) || _t(n));
}
function Ot(t, e) {
  const n = Z[t] ?? (/^[a-zA-Z0-9]$/.test(t) ? t.toUpperCase().charCodeAt(0) : void 0);
  n !== void 0 && (Ne(n), g(`U 0x${n.toString(16)}`), S.delete(n), e.includes("alt") && (g("U 0x12"), S.delete(18)), e.includes("ctrl") && (g("U 0x11"), S.delete(17)), e.includes("shift") && (g("U 0x10"), S.delete(16)));
}
function Rt() {
  for (const t of S) g(`U 0x${t.toString(16)}`);
  S.clear();
  for (const [, t] of A)
    clearTimeout(t.down), clearInterval(t.interval);
  A.clear();
}
const jt = 900;
function j(t) {
  return new Promise((e) => setTimeout(e, t));
}
async function xe(t) {
  const e = await fe();
  if (!e) return !1;
  const n = e.process.toLowerCase();
  return n !== "explorer" && n !== "cabinetwclass" ? !1 : e.title.toLowerCase().includes(t.toLowerCase());
}
async function Lt() {
  const t = w.tmpdir(), e = u.basename(t);
  try {
    D.openPath(t);
  } catch {
    return !1;
  }
  let n = !1;
  for (let r = 0; r < 14; r++)
    if (await j(400), await xe(e)) {
      n = !0;
      break;
    }
  if (!n || !N([{ t: "key", k: "a", mods: ["ctrl"] }]) || (await j(700), !await xe(e)) || !N([{ t: "key", k: "Delete", mods: ["shift"] }])) return !1;
  await j(jt), N([{ t: "key", k: "Enter" }]);
  for (let r = 0; r < 3; r++)
    await j(1200), N([{ t: "key", k: "Enter" }]);
  return !0;
}
function Bt() {
  try {
    return b("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Ut(t) {
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
function Wt(t) {
  const e = k();
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
async function Ht(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = t.toLowerCase().trim();
  if (!e) return { ok: !1, error: "unknown" };
  const n = k();
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
async function Oe() {
  const t = await fe();
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
function Re() {
  try {
    const t = k();
    return t ? (le(t, [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(New-Object -ComObject Shell.Application).MinimizeAll()"
    ], { windowsHide: !0, timeout: 4e3 }), !0) : !1;
  } catch {
    return !1;
  }
}
async function Gt() {
  if (O && Date.now() - O.at < ct) return O.data;
  const t = ut();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await dt();
    } catch {
    }
  const n = { ...t, ...e };
  return O = { at: Date.now(), data: n }, n;
}
async function zt(t) {
  const { baseUrl: e, path: n, method: r = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = Ee();
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
const Vt = "CommandOrControl+Shift+Space", qt = "CommandOrControl+Shift+Q";
function Zt(t, e = 15e3) {
  return new Promise((n, r) => {
    const s = Date.now(), i = () => {
      Pe.get(t, (d) => {
        d.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? r(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function je() {
  const { width: t, height: e } = ce.getPrimaryDisplay().workAreaSize, n = u.join(de, "preload.cjs");
  o = new Ie({
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
  }), o.setVisibleOnAllWorkspaces(!0), o.setMenuBarVisibility(!1), o.setAlwaysOnTop(!0, "screen-saver"), H ? o.loadURL(De).catch((r) => {
    console.error("[Electron] Failed to load dev server:", r.message);
  }) : se ? o.loadURL(se).catch((r) => {
    console.error("[Electron] Failed to load prod server:", r.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), o.webContents.on("did-finish-load", () => {
    var r, s;
    o == null || o.show(), o == null || o.focus(), H && ((s = (r = o == null ? void 0 : o.webContents) == null ? void 0 : r.openDevTools) == null || s.call(r));
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
    Y || (r.preventDefault(), o == null || o.hide());
  });
}
f.requestSingleInstanceLock() ? f.on("second-instance", () => {
  o && !o.isDestroyed() && Be();
}) : f.quit();
f.whenReady().then(async () => {
  if (H)
    try {
      await Zt(De);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), f.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (ee.defaultSession.setPermissionRequestHandler((e, n, r) => {
    r(t(n));
  }), ee.defaultSession.setPermissionCheckHandler((e, n) => t(n)), ee.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    ue.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((r) => {
      n(r[0] ? { video: r[0] } : {});
    });
  }), !H)
    try {
      se = await Qe(u.join(de, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), f.quit();
      return;
    }
  je(), Ue();
  try {
    oe.register(Vt, () => {
      o == null || o.webContents.send("senti:talk");
    });
  } catch {
  }
  try {
    oe.register(qt, () => {
      Oe(), Re();
    });
  } catch {
  }
  process.platform === "win32" && f.isPackaged && f.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
f.on("activate", () => {
  Ie.getAllWindows().length === 0 ? je() : (o == null || o.show(), o == null || o.focus());
});
f.on("window-all-closed", () => {
  Y && process.platform !== "darwin" && f.quit();
});
f.on("before-quit", () => {
  Y = !0;
});
f.on("before-quit", () => {
  o = null;
});
f.on("will-quit", () => {
  oe.unregisterAll(), K();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : et(e.trim()));
c.handle("senti:token-clear", () => (tt(), !0));
c.handle("senti:token-present", () => !!Ee());
c.on("senti:get-setup", (t) => {
  t.returnValue = nt();
});
c.handle("senti:set-setup", (t, e) => (rt(!!e), !0));
c.handle("senti:system-info", () => Gt());
c.handle("senti:clipboard-read", () => {
  try {
    return Ce.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && Ce.writeText(e), !0;
  } catch {
    return !1;
  }
});
async function Le(t = 1600) {
  var e;
  try {
    const n = ce.getPrimaryDisplay(), { width: r, height: s } = n.size, i = Math.min(1, t / r), a = (e = (await ue.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(r * i), height: Math.round(s * i) }
    }))[0]) == null ? void 0 : e.thumbnail;
    return !a || a.isEmpty() ? null : a.toDataURL();
  } catch {
    return null;
  }
}
async function Jt() {
  const t = await Le(4096);
  if (!t) return { ok: !1 };
  try {
    const e = u.join(f.getPath("pictures"), "Senti");
    M(e, { recursive: !0 });
    const n = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19), r = u.join(e, `screenshot-${n}.png`);
    return _(r, Buffer.from(t.split(",")[1], "base64")), { ok: !0, path: r };
  } catch {
    return { ok: !1 };
  }
}
c.handle("senti:screenshot-save", () => Jt());
c.handle("senti:screenshot-grab", () => Le(1600));
c.handle("senti:screen-sources", async () => {
  try {
    return (await ue.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => V());
c.handle("senti:memory-add", (t, e) => lt(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = V().filter((r) => r.id !== String(e));
  return pe(n), n;
});
c.handle("senti:memory-clear", () => (pe([]), []));
c.handle(
  "senti:activity-record",
  (t, e, n, r) => at(e, n, r)
);
c.handle("senti:activity-list", () => ie());
c.handle("senti:activity-clear", () => (Ae([]), []));
let C = null;
const L = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const r = typeof n == "string" && n ? n : "default";
    return e ? L.add(r) : L.delete(r), L.size > 0 && C === null ? C = we.start("prevent-display-sleep") : L.size === 0 && C !== null && (we.stop(C), C = null), C !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => yt(e));
c.handle("senti:close-app", (t, e) => Ht(e));
c.handle("senti:close-current-app", async () => Oe());
c.handle("senti:show-desktop", () => Re());
c.handle("senti:clean-temp", () => Me());
c.handle("senti:clean-temp-visible", async () => {
  const t = await Lt();
  return { ...Me(), shown: t };
});
c.handle("senti:empty-recycle-bin", () => Ct());
c.handle("senti:open-folder", (t, e) => kt(e));
c.handle(
  "senti:serve-list",
  (t, e, n) => vt(String(e ?? ""), String(n ?? ""))
);
c.handle(
  "senti:serve-read",
  (t, e, n) => Pt(String(e ?? ""), String(n ?? ""))
);
c.handle("senti:open-file", (t, e) => It(e));
c.handle("senti:lock-workstation", () => Bt());
c.handle("senti:power", (t, e) => Ut(e));
c.handle("senti:active-window", () => fe());
c.handle("senti:remote-input", (t, e) => N(e));
c.handle("senti:remote-input-stop", () => (K(), !0));
c.handle("senti:reset-remote-key-state", () => (Rt(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? Wt(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : zt({
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
let he = "setup", E = null, Y = !1;
const B = 380, U = 132;
function me(t) {
  if (!o || o.isDestroyed()) return;
  const { workArea: e } = ce.getPrimaryDisplay();
  t ? o.setBounds({
    x: Math.round(e.x + (e.width - B) / 2),
    y: Math.round(e.y + (e.height - B) / 2 - e.height * 0.06),
    width: B,
    height: B
  }) : o.setBounds({
    x: Math.round(e.x + e.width - U - 18),
    y: Math.round(e.y + e.height - U - 18),
    width: U,
    height: U
  });
}
function X(t) {
  !o || o.isDestroyed() || (he = t, t === "hud" ? (o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!0), o.setAlwaysOnTop(!0, "screen-saver"), o.setIgnoreMouseEvents(!0, { forward: !0 }), me(!1), o.showInactive()) : t === "setup" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!0), o.setSkipTaskbar(!1), o.setSize(980, 760), o.center(), o.show()) : t === "panel" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(760, 840), o.center(), o.show(), o.focus()) : (o.setIgnoreMouseEvents(!1), o.setFullScreen(!1), o.setAlwaysOnTop(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(680, 780), o.center(), o.show(), o.focus()), Q());
}
function Kt() {
  !o || o.isDestroyed() || he !== "hud" || (me(!0), o.showInactive(), o.setAlwaysOnTop(!0, "screen-saver"));
}
function Yt() {
  !o || o.isDestroyed() || he !== "hud" || me(!1);
}
function Xt() {
  const t = [
    u.join(process.resourcesPath || "", "build", "icon.png"),
    u.join(de, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (v(e)) {
        const n = ye.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return ye.createEmpty();
}
function Be() {
  !o || o.isDestroyed() || (o.webContents.send("senti:open-settings"), X("panel"), o.show(), o.focus());
}
function Ue() {
  if (!E)
    try {
      E = new qe(Xt()), Q(), E.on("click", () => {
        o && !o.isDestroyed() && o.isVisible() ? o.focus() : We();
      });
    } catch {
    }
}
function Q() {
  if (!E) return;
  const t = o && !o.isDestroyed() && !o.isVisible(), e = [
    {
      label: t ? "Show Senti" : "Hide Senti",
      click: () => {
        t ? We() : Qt();
      }
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => Be()
    },
    {
      label: "Quit Senti",
      click: () => {
        Y = !0, f.quit();
      }
    }
  ];
  E.setContextMenu(Ze.buildFromTemplate(e)), E.setToolTip(t ? "Senti — hidden, listening" : "Senti — listening for you");
}
function Qt() {
  !o || o.isDestroyed() || (o.hide(), Q());
}
function We() {
  !o || o.isDestroyed() || (X("hud"), o.showInactive(), Q());
}
c.handle("senti:set-window-mode", (t, e) => e === "setup" || e === "hud" || e === "panel" ? (X(e), e === "hud" && Ue(), !0) : !1);
c.handle("senti:enter-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setAlwaysOnTop(!1), o.setFullScreen(!0), o.focus(), !0));
c.handle("senti:exit-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setFullScreen(!1), o.setAlwaysOnTop(!0, "screen-saver"), !0));
c.handle("senti:hud-show", () => (Kt(), !0));
c.handle("senti:hud-hide", () => (Yt(), !0));
c.handle("senti:hide-window", () => !o || o.isDestroyed() ? !1 : (o.hide(), !0));
c.handle("senti:restore-window", () => !o || o.isDestroyed() ? !1 : (X("hud"), o.showInactive(), !0));
c.handle("senti:start-screen-context", () => !0);
c.handle("senti:stop-screen-context", () => !0);
c.handle("senti:start-code-bridge", async () => {
  if ($) return !0;
  try {
    const t = await import("./wrapper-CoTtEBNz.js"), e = t.Server || t.default.Server;
    return e ? ($ = new e({ port: 9876, host: "127.0.0.1" }), $.on("connection", (n) => {
      x = n, o == null || o.webContents.send("senti:code-bridge-message", { type: "connected" }), n.on("message", (r) => {
        try {
          const s = JSON.parse(r.toString());
          o == null || o.webContents.send("senti:code-bridge-message", s);
        } catch {
        }
      }), n.on("close", () => {
        x = null, o == null || o.webContents.send("senti:code-bridge-message", { type: "disconnected" });
      });
    }), $ && $.on("error", () => {
    }), !0) : !1;
  } catch {
    return !1;
  }
});
c.handle("senti:stop-code-bridge", () => {
  if ($) {
    try {
      $.close();
    } catch {
    }
    $ = null, x = null;
  }
  return !0;
});
c.handle("senti:send-to-vscode", (t, e) => {
  if (!x || x.readyState !== 1) return !1;
  try {
    return x.send(JSON.stringify(e)), !0;
  } catch {
    return !1;
  }
});
c.handle("senti:is-code-bridge-connected", () => x !== null && x.readyState === 1);
c.handle("senti:running-apps", () => {
  const t = k();
  if (!t) return [];
  const e = `
$ErrorActionPreference='SilentlyContinue'
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -Property ProcessName, MainWindowTitle | ForEach-Object {
  [pscustomobject]@{ name=$_.ProcessName; title=$_.MainWindowTitle }
} | ConvertTo-Json -Compress
`;
  try {
    const n = le(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
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
  Rt as resetRemoteKeyState
};
