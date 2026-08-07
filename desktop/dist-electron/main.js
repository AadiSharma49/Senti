import { existsSync as $, readFileSync as T, mkdirSync as F, writeFileSync as M, unlinkSync as $e, readdirSync as K, statSync as ae, rmdirSync as We } from "fs";
import { spawn as x, execFileSync as ve, execFile as N } from "child_process";
import Ie from "http";
import g from "os";
import ze from "electron";
import u from "path";
import { fileURLToPath as Ge } from "url";
function Ve(t, e) {
  const n = u.resolve(t), o = u.resolve(n, e || ""), s = n.endsWith(u.sep) ? n : n + u.sep;
  return o !== n && !o.startsWith(s) ? null : o;
}
const { app: p, BrowserWindow: Ce, screen: le, ipcMain: l, globalShortcut: oe, safeStorage: H, session: ee, shell: P, Tray: qe, Menu: Ze, nativeImage: me, powerSaveBlocker: ye, desktopCapturer: ce, clipboard: Pe } = ze;
let b = null, k = null;
const Ke = Ge(import.meta.url), ue = u.dirname(Ke), W = process.env.VITE_DEV_SERVER_URL, De = "http://localhost:5173";
let r = null, se = "";
const Je = {
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
      if (e && $(e)) return e;
    } catch {
    }
  return null;
}
function I() {
  if (process.platform !== "win32") return null;
  const t = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", e = u.join(t, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), n = u.join(t, "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe");
  return Xe([e, n, "powershell.exe"]);
}
function Qe(t) {
  return new Promise((e, n) => {
    const o = Ie.createServer((c, a) => {
      try {
        let d = decodeURIComponent((c.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const m = u.normalize(d).replace(/^([/\\])+/, ""), f = u.join(t, m);
        if (!f.startsWith(t) || !$(f)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const y = T(f);
        a.writeHead(200, {
          "Content-Type": Je[u.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(y);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = Ye, i = 0;
    o.on("error", (c) => {
      c.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(c);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const E = () => u.join(p.getPath("userData"), "device.token");
function et(t) {
  try {
    return F(u.dirname(E()), { recursive: !0 }), H.isEncryptionAvailable() ? (M(E(), H.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function Ee() {
  try {
    return !$(E()) || !H.isEncryptionAvailable() ? null : H.decryptString(T(E()));
  } catch {
    return null;
  }
}
function tt() {
  try {
    $(E()) && $e(E());
  } catch {
  }
}
const z = () => u.join(p.getPath("userData"), "setup.json");
function nt() {
  var t;
  try {
    return $(z()) ? ((t = JSON.parse(T(z(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function rt(t) {
  try {
    F(u.dirname(z()), { recursive: !0 }), M(z(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const Ae = 200, G = () => u.join(p.getPath("userData"), "memories.json");
function V() {
  try {
    if (!$(G())) return [];
    const t = JSON.parse(T(G(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function de(t) {
  try {
    F(u.dirname(G()), { recursive: !0 }), M(G(), JSON.stringify(t.slice(-Ae)));
  } catch {
  }
}
const ot = 21, st = 3, q = () => u.join(p.getPath("userData"), "activity.json");
function ie() {
  try {
    if (!$(q())) return [];
    const t = JSON.parse(T(q(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function Te(t) {
  try {
    F(u.dirname(q()), { recursive: !0 }), M(q(), JSON.stringify(t));
  } catch {
  }
}
function it(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function at(t, e, n) {
  const o = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(n) || 0));
  if (!o || !i) return ie();
  const c = /* @__PURE__ */ new Date(), a = c.toISOString().slice(0, 10), d = it(c), m = new Date(c.getTime() - ot * 864e5).toISOString().slice(0, 10), f = ie().filter((v) => v.day >= m);
  let y = f.find((v) => v.day === a && v.process === o && v.part === d);
  return y || (y = { day: a, process: o, part: d, minutes: 0, samples: [] }, f.push(y)), y.minutes = Math.round((y.minutes + i) * 10) / 10, s && !y.samples.includes(s) && y.samples.length < st && y.samples.push(s), Te(f), f;
}
function lt(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return V();
  const n = V(), o = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === o)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-Ae);
  return de(s), s;
}
let R = null;
const ct = 2e4;
function ut() {
  var o, s;
  const t = g.totalmem() / 1073741824, e = g.freemem() / 1024 ** 3, n = t - e;
  return {
    os: `${g.type()} ${g.release()}`,
    cpu: ((s = (o = g.cpus()[0]) == null ? void 0 : o.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: g.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / t * 100),
    uptimeHours: +(g.uptime() / 3600).toFixed(1)
  };
}
function dt() {
  const t = I();
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
    N(
      t,
      ["-NoProfile", "-NonInteractive", "-Command", e],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (o, s) => {
        if (o || !s) return n({});
        try {
          const i = JSON.parse(s), c = (i.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          n({
            disks: c,
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
let te = null, we = 0;
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
  if (te && t - we < 5 * 6e4) return te;
  const e = [], n = t, o = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let c;
    try {
      c = K(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of c) {
      const d = u.join(s, a.name);
      a.isDirectory() ? o(d, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: d });
    }
  };
  for (const s of ht()) o(s, 0);
  return te = e, we = t, e;
}
function re(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = ne(e), o = e.split(/\s+/).map(ne).filter((i) => i.length >= 2 && !ft.has(i));
  if (!n && !o.length) return null;
  let s = null;
  for (const i of mt()) {
    const c = ne(i.name);
    let a = 0;
    if (c === n) a = 100;
    else if (n.length >= 3 && c.includes(n)) a = 60 - Math.min(25, c.length - n.length);
    else {
      let d = 0;
      for (const m of o) m.length >= 3 && c.includes(m) && d++;
      d && (a = 20 + d * 12 - Math.min(15, Math.floor(c.length / 6)));
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
        return P.openExternal(e.target), { ok: !0, label: e.label };
      if (await St(e.label, e.target))
        return { ok: !0, label: e.label, focused: !0 };
      const o = re(e.label) || re(e.target);
      return o ? (P.openPath(o.path), { ok: !0, label: e.label }) : (x("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label });
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = re(t);
  if (n)
    try {
      return P.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
const gt = `
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
`, wt = {
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
  const n = I();
  if (!n) return Promise.resolve(!1);
  const o = (wt[t] ?? [e.replace(/\.exe$/i, "")]).map((i) => i.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!o.length) return Promise.resolve(!1);
  const s = `$names = @(${o.map((i) => `'${i}'`).join(",")})
`;
  return new Promise((i) => {
    try {
      N(
        n,
        ["-NoProfile", "-NonInteractive", "-Command", s + gt],
        { timeout: 6e3, windowsHide: !0 },
        (c, a) => i(!c && String(a).trim() === "yes")
      );
    } catch {
      i(!1);
    }
  });
}
function bt(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|show|go to|reveal)\s+/, "").replace(/^(my|the)\s+/, "").replace(/\s+(folder|directory)$/, "").trim(), n = {
    temp: { shell: g.tmpdir(), label: "your Temp folder" },
    "temp files": { shell: g.tmpdir(), label: "your Temp folder" },
    "temporary files": { shell: g.tmpdir(), label: "your Temp folder" },
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
      return { path: p.getPath(s.key), label: s.label };
    } catch {
      return null;
    }
  return null;
}
function kt(t) {
  const e = bt(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? x("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && P.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const xt = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, $t = 15 * 1024 * 1024;
function Fe(t, e) {
  const n = xt[t];
  if (!n) return null;
  let o;
  try {
    o = p.getPath(n);
  } catch {
    return null;
  }
  const s = Ve(o, e);
  return s ? { base: o, full: s } : null;
}
function vt(t, e) {
  const n = Fe(t, e);
  if (!n) throw new Error("Not allowed");
  const s = K(n.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let c = 0, a = 0;
    try {
      const d = ae(u.join(n.full, i.name));
      c = d.size, a = d.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: c, modified: a };
  }).sort((i, c) => i.dir === c.dir ? i.name.localeCompare(c.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: s });
}
function It(t, e) {
  const n = Fe(t, e);
  if (!n) throw new Error("Not allowed");
  const o = ae(n.full);
  if (!o.isFile()) throw new Error("Not a file");
  if (o.size > $t) throw new Error("File is too large to send (15 MB limit)");
  const s = T(n.full);
  return JSON.stringify({
    name: u.basename(n.full),
    size: o.size,
    base64: s.toString("base64")
  });
}
const Se = 8e3, be = 40;
function Ct(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return p.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), o = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], c = (a, d) => {
    if (d > 4 || Date.now() - o > Se || i.length >= be) return;
    let m;
    try {
      m = K(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of m) {
      if (Date.now() - o > Se || i.length >= be) return;
      if (f.name.startsWith(".") || s.test(f.name)) continue;
      const y = u.join(a, f.name);
      try {
        if (f.isSymbolicLink()) continue;
        f.isDirectory() ? c(y, d + 1) : f.isFile() && f.name.toLowerCase().includes(e) && i.push({ name: f.name, path: y });
      } catch {
      }
    }
  };
  for (const a of n) c(a, 0);
  if (i.length === 0) return { ok: !1, error: "not-found", count: 0 };
  i.sort((a, d) => {
    const m = a.name.toLowerCase(), f = d.name.toLowerCase(), y = m === e || m.replace(/\.[^.]+$/, "") === e, v = f === e || f.replace(/\.[^.]+$/, "") === e;
    return y !== v ? y ? -1 : 1 : a.name.length - d.name.length;
  });
  try {
    return P.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const ke = 2e4;
function Me() {
  const t = [g.tmpdir(), u.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (i, c) => {
    if (c > 6 || Date.now() - e > ke || !/temp/i.test(i)) return;
    let a;
    try {
      a = K(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of a) {
      if (Date.now() - e > ke) return;
      const m = u.join(i, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          s(m, c + 1);
          try {
            We(m);
          } catch {
          }
        } else if (d.isFile()) {
          const f = ae(m).size;
          $e(m), n += f, o++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function Pt() {
  const t = I();
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
    const o = (ve(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [s, i] = o.split(/\s+/).map((c) => parseInt(c, 10));
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
function pe() {
  const t = I();
  return t ? new Promise((e) => {
    try {
      N(
        t,
        ["-NoProfile", "-NonInteractive", "-Command", Dt],
        { timeout: 5e3, windowsHide: !0 },
        (n, o) => {
          if (n || !o) return e(null);
          try {
            const s = JSON.parse(o.trim()), i = String(s.title || "").slice(0, 200), c = String(s.process || "").slice(0, 60);
            e(i || c ? { title: i, process: c } : null);
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
  const t = I();
  if (!t)
    return console.error("[RemoteInput] PowerShell not found; remote control input disabled."), !1;
  try {
    const e = u.join(p.getPath("userData"), "input.ps1");
    return F(u.dirname(e), { recursive: !0 }), M(e, Et, "utf8"), h = x(
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
function J() {
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
}, O = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function At(t) {
  switch (t.t) {
    case "move":
      return `M ${O(t.x).toFixed(5)} ${O(t.y).toFixed(5)}`;
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      return typeof t.x != "number" || t.x < 0 ? `C ${e} -1 -1 ${n}` : `C ${e} ${O(t.x).toFixed(5)} ${O(t.y).toFixed(5)} ${n}`;
    }
    case "scroll": {
      const e = Number(t.d) || 0, n = t.axis === "x", o = Math.max(-10, Math.min(10, Math.round(-e / 100)));
      return o ? n ? `H ${o * 120}` : `S ${o * 120}` : null;
    }
    case "type": {
      const e = String(t.text ?? "").slice(0, 500);
      return e ? `T ${Buffer.from(e, "utf8").toString("base64")}` : null;
    }
    case "keydown": {
      const e = String(t.k), n = Z[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const o = Array.isArray(t.mods) ? t.mods : [], s = [];
      return o.includes("shift") && s.push("D 0x10"), o.includes("ctrl") && s.push("D 0x11"), o.includes("alt") && s.push("D 0x12"), s.push(`D 0x${n.toString(16)}`), s.join(`
`);
    }
    case "keyup": {
      const e = String(t.k), n = Z[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const o = Array.isArray(t.mods) ? t.mods : [], s = [];
      return s.push(`U 0x${n.toString(16)}`), o.includes("alt") && s.push("U 0x12"), o.includes("ctrl") && s.push("U 0x11"), o.includes("shift") && s.push("U 0x10"), s.join(`
`);
    }
    default:
      return null;
  }
}
function _(t) {
  if (!Array.isArray(t) || !t.length || !_e() || !(h != null && h.stdin)) return !1;
  const e = [];
  for (const n of t) {
    const o = n;
    switch (o.t) {
      case "keydown":
        Nt(String(o.k ?? ""), Array.isArray(o.mods) ? o.mods : []);
        continue;
      case "keyup":
        Rt(String(o.k ?? ""), Array.isArray(o.mods) ? o.mods : []);
        continue;
    }
    const s = At(o);
    if (typeof s == "string")
      for (const i of s.split(`
`)) {
        const c = i.trim();
        c && e.push(c);
      }
  }
  if (!e.length) return !0;
  try {
    return h.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return J(), !1;
  }
}
const S = /* @__PURE__ */ new Set(), A = /* @__PURE__ */ new Map(), Tt = 400, Ft = 32, Mt = /* @__PURE__ */ new Set([16, 17, 18, 91, 92]);
function _t(t) {
  Ne(t);
  const e = window.setTimeout(() => {
    w(`D 0x${t.toString(16)}`);
    const n = window.setInterval(() => {
      w(`D 0x${t.toString(16)}`);
    }, Ft);
    A.set(t, { down: e, interval: n });
  }, Tt);
  A.set(t, { down: e, interval: -1 });
}
function Ne(t) {
  const e = A.get(t);
  e && (clearTimeout(e.down), clearInterval(e.interval), A.delete(t));
}
function w(t) {
  if (!(!_e() || !(h != null && h.stdin)))
    try {
      h.stdin.write(t + `
`);
    } catch {
      J();
    }
}
function Nt(t, e) {
  const n = Z[t] ?? (/^[a-zA-Z0-9]$/.test(t) ? t.toUpperCase().charCodeAt(0) : void 0);
  n !== void 0 && (e.includes("shift") && !S.has(16) && w("D 0x10"), e.includes("ctrl") && !S.has(17) && w("D 0x11"), e.includes("alt") && !S.has(18) && w("D 0x12"), w(`D 0x${n.toString(16)}`), S.add(n), Mt.has(n) || _t(n));
}
function Rt(t, e) {
  const n = Z[t] ?? (/^[a-zA-Z0-9]$/.test(t) ? t.toUpperCase().charCodeAt(0) : void 0);
  n !== void 0 && (Ne(n), w(`U 0x${n.toString(16)}`), S.delete(n), e.includes("alt") && (w("U 0x12"), S.delete(18)), e.includes("ctrl") && (w("U 0x11"), S.delete(17)), e.includes("shift") && (w("U 0x10"), S.delete(16)));
}
function Ot() {
  for (const t of S) w(`U 0x${t.toString(16)}`);
  S.clear();
  for (const [, t] of A)
    clearTimeout(t.down), clearInterval(t.interval);
  A.clear();
}
const Lt = 900;
function L(t) {
  return new Promise((e) => setTimeout(e, t));
}
async function xe(t) {
  const e = await pe();
  if (!e) return !1;
  const n = e.process.toLowerCase();
  return n !== "explorer" && n !== "cabinetwclass" ? !1 : e.title.toLowerCase().includes(t.toLowerCase());
}
async function jt() {
  const t = g.tmpdir(), e = u.basename(t);
  try {
    P.openPath(t);
  } catch {
    return !1;
  }
  let n = !1;
  for (let o = 0; o < 14; o++)
    if (await L(400), await xe(e)) {
      n = !0;
      break;
    }
  if (!n || !_([{ t: "key", k: "a", mods: ["ctrl"] }]) || (await L(700), !await xe(e)) || !_([{ t: "key", k: "Delete", mods: ["shift"] }])) return !1;
  await L(Lt), _([{ t: "key", k: "Enter" }]);
  for (let o = 0; o < 3; o++)
    await L(1200), _([{ t: "key", k: "Enter" }]);
  return !0;
}
function Bt() {
  try {
    return x("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Ut(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      N("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
    else if (e === "restart" || e === "reboot")
      x("shutdown", ["/r", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else if (e === "shutdown" || e === "shut down" || e === "off")
      x("shutdown", ["/s", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else
      return !1;
    return !0;
  } catch {
    return !1;
  }
}
function Ht(t) {
  const e = I();
  if (!e) return !1;
  const s = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return N(e, ["-NoProfile", "-NonInteractive", "-Command", s], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const Wt = {
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
function zt(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = Wt[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return x("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Re() {
  const t = await pe();
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
    return x("taskkill", ["/IM", s, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: n };
  } catch {
    return { ok: !1, label: n, error: "failed" };
  }
}
function Oe() {
  try {
    const t = I();
    return t ? (ve(t, [
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
  if (R && Date.now() - R.at < ct) return R.data;
  const t = ut();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await dt();
    } catch {
    }
  const n = { ...t, ...e };
  return R = { at: Date.now(), data: n }, n;
}
async function Vt(t) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const c = { "Content-Type": "application/json" };
  if (i) {
    const a = Ee();
    if (!a) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    c.Authorization = `Bearer ${a}`;
  }
  try {
    const a = await fetch(`${e}${n}`, {
      method: o,
      headers: c,
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
const qt = "CommandOrControl+Shift+Space", Zt = "CommandOrControl+Shift+Q";
function Kt(t, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), i = () => {
      Ie.get(t, (d) => {
        d.statusCode === 200 ? n() : c();
      }).on("error", c);
    }, c = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function Le() {
  const { width: t, height: e } = le.getPrimaryDisplay().workAreaSize, n = u.join(ue, "preload.cjs");
  r = new Ce({
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
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), W ? r.loadURL(De).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : se ? r.loadURL(se).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var o, s;
    r == null || r.show(), r == null || r.focus(), W && ((s = (o = r == null ? void 0 : r.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
  }), r.webContents.on("did-fail-load", (o, s, i, c, a) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: i, validatedURL: c, isMainFrame: a });
  }), r.webContents.on("console-message", (o, s, i) => {
    const c = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${c}] ${i}`);
  }), r.webContents.on("render-process-gone", (o, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), r.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), r.on("close", (o) => {
    Y || (o.preventDefault(), r == null || r.hide());
  });
}
p.requestSingleInstanceLock() ? p.on("second-instance", () => {
  r && !r.isDestroyed() && Be();
}) : p.quit();
p.whenReady().then(async () => {
  if (W)
    try {
      await Kt(De);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), p.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (ee.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(t(n));
  }), ee.defaultSession.setPermissionCheckHandler((e, n) => t(n)), ee.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    ce.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((o) => {
      n(o[0] ? { video: o[0] } : {});
    });
  }), !W)
    try {
      se = await Qe(u.join(ue, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), p.quit();
      return;
    }
  Le(), Ue();
  try {
    oe.register(qt, () => {
      r == null || r.webContents.send("senti:talk");
    });
  } catch {
  }
  try {
    oe.register(Zt, () => {
      Re(), Oe();
    });
  } catch {
  }
  process.platform === "win32" && p.isPackaged && p.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
p.on("activate", () => {
  Ce.getAllWindows().length === 0 ? Le() : (r == null || r.show(), r == null || r.focus());
});
p.on("window-all-closed", () => {
  Y && process.platform !== "darwin" && p.quit();
});
p.on("before-quit", () => {
  Y = !0;
});
p.on("before-quit", () => {
  r = null;
});
p.on("will-quit", () => {
  oe.unregisterAll(), J();
});
l.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : et(e.trim()));
l.handle("senti:token-clear", () => (tt(), !0));
l.handle("senti:token-present", () => !!Ee());
l.on("senti:get-setup", (t) => {
  t.returnValue = nt();
});
l.handle("senti:set-setup", (t, e) => (rt(!!e), !0));
l.handle("senti:system-info", () => Gt());
l.handle("senti:clipboard-read", () => {
  try {
    return Pe.readText();
  } catch {
    return "";
  }
});
l.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && Pe.writeText(e), !0;
  } catch {
    return !1;
  }
});
async function je(t = 1600) {
  var e;
  try {
    const n = le.getPrimaryDisplay(), { width: o, height: s } = n.size, i = Math.min(1, t / o), a = (e = (await ce.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(o * i), height: Math.round(s * i) }
    }))[0]) == null ? void 0 : e.thumbnail;
    return !a || a.isEmpty() ? null : a.toDataURL();
  } catch {
    return null;
  }
}
async function Jt() {
  const t = await je(4096);
  if (!t) return { ok: !1 };
  try {
    const e = u.join(p.getPath("pictures"), "Senti");
    F(e, { recursive: !0 });
    const n = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19), o = u.join(e, `screenshot-${n}.png`);
    return M(o, Buffer.from(t.split(",")[1], "base64")), { ok: !0, path: o };
  } catch {
    return { ok: !1 };
  }
}
l.handle("senti:screenshot-save", () => Jt());
l.handle("senti:screenshot-grab", () => je(1600));
l.handle("senti:screen-sources", async () => {
  try {
    return (await ce.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
l.handle("senti:memory-list", () => V());
l.handle("senti:memory-add", (t, e) => lt(String(e ?? "")));
l.handle("senti:memory-forget", (t, e) => {
  const n = V().filter((o) => o.id !== String(e));
  return de(n), n;
});
l.handle("senti:memory-clear", () => (de([]), []));
l.handle(
  "senti:activity-record",
  (t, e, n, o) => at(e, n, o)
);
l.handle("senti:activity-list", () => ie());
l.handle("senti:activity-clear", () => (Te([]), []));
let C = null;
const j = /* @__PURE__ */ new Set();
l.handle("senti:keep-awake", (t, e, n) => {
  try {
    const o = typeof n == "string" && n ? n : "default";
    return e ? j.add(o) : j.delete(o), j.size > 0 && C === null ? C = ye.start("prevent-display-sleep") : j.size === 0 && C !== null && (ye.stop(C), C = null), C !== null;
  } catch {
    return !1;
  }
});
l.handle("senti:open-app", (t, e) => yt(e));
l.handle("senti:close-app", (t, e) => zt(e));
l.handle("senti:close-current-app", async () => Re());
l.handle("senti:show-desktop", () => Oe());
l.handle("senti:clean-temp", () => Me());
l.handle("senti:clean-temp-visible", async () => {
  const t = await jt();
  return { ...Me(), shown: t };
});
l.handle("senti:empty-recycle-bin", () => Pt());
l.handle("senti:open-folder", (t, e) => kt(e));
l.handle(
  "senti:serve-list",
  (t, e, n) => vt(String(e ?? ""), String(n ?? ""))
);
l.handle(
  "senti:serve-read",
  (t, e, n) => It(String(e ?? ""), String(n ?? ""))
);
l.handle("senti:open-file", (t, e) => Ct(e));
l.handle("senti:lock-workstation", () => Bt());
l.handle("senti:power", (t, e) => Ut(e));
l.handle("senti:active-window", () => pe());
l.handle("senti:remote-input", (t, e) => _(e));
l.handle("senti:remote-input-stop", () => (J(), !0));
l.handle("senti:reset-remote-key-state", () => (Ot(), !0));
l.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? Ht(n) : !1;
});
l.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Vt({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
l.handle("senti:get-platform", () => process.platform);
l.handle("senti:device-info", () => ({
  hostname: g.hostname(),
  platform: process.platform
}));
let fe = "setup", D = null, Y = !1;
const B = 380, U = 132;
function he(t) {
  if (!r || r.isDestroyed()) return;
  const { workArea: e } = le.getPrimaryDisplay();
  t ? r.setBounds({
    x: Math.round(e.x + (e.width - B) / 2),
    y: Math.round(e.y + (e.height - B) / 2 - e.height * 0.06),
    width: B,
    height: B
  }) : r.setBounds({
    x: Math.round(e.x + e.width - U - 18),
    y: Math.round(e.y + e.height - U - 18),
    width: U,
    height: U
  });
}
function X(t) {
  !r || r.isDestroyed() || (fe = t, t === "hud" ? (r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), r.setIgnoreMouseEvents(!0, { forward: !0 }), he(!1), r.showInactive()) : t === "setup" ? (r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : t === "panel" ? (r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(760, 840), r.center(), r.show(), r.focus()) : (r.setIgnoreMouseEvents(!1), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()), Q());
}
function Yt() {
  !r || r.isDestroyed() || fe !== "hud" || (he(!0), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function Xt() {
  !r || r.isDestroyed() || fe !== "hud" || he(!1);
}
function Qt() {
  const t = [
    u.join(process.resourcesPath || "", "build", "icon.png"),
    u.join(ue, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if ($(e)) {
        const n = me.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return me.createEmpty();
}
function Be() {
  !r || r.isDestroyed() || (r.webContents.send("senti:open-settings"), X("panel"), r.show(), r.focus());
}
function Ue() {
  if (!D)
    try {
      D = new qe(Qt()), Q(), D.on("click", () => {
        r && !r.isDestroyed() && r.isVisible() ? r.focus() : He();
      });
    } catch {
    }
}
function Q() {
  if (!D) return;
  const t = r && !r.isDestroyed() && !r.isVisible(), e = [
    {
      label: t ? "Show Senti" : "Hide Senti",
      click: () => {
        t ? He() : en();
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
        Y = !0, p.quit();
      }
    }
  ];
  D.setContextMenu(Ze.buildFromTemplate(e)), D.setToolTip(t ? "Senti — hidden, listening" : "Senti — listening for you");
}
function en() {
  !r || r.isDestroyed() || (r.hide(), Q());
}
function He() {
  !r || r.isDestroyed() || (X("hud"), r.showInactive(), Q());
}
l.handle("senti:set-window-mode", (t, e) => e === "setup" || e === "hud" || e === "panel" ? (X(e), e === "hud" && Ue(), !0) : !1);
l.handle("senti:enter-fullscreen", () => !r || r.isDestroyed() ? !1 : (r.setAlwaysOnTop(!1), r.setFullScreen(!0), r.focus(), !0));
l.handle("senti:exit-fullscreen", () => !r || r.isDestroyed() ? !1 : (r.setFullScreen(!1), r.setAlwaysOnTop(!0, "screen-saver"), !0));
l.handle("senti:hud-show", () => (Yt(), !0));
l.handle("senti:hud-hide", () => (Xt(), !0));
l.handle("senti:hide-window", () => !r || r.isDestroyed() ? !1 : (r.hide(), !0));
l.handle("senti:restore-window", () => !r || r.isDestroyed() ? !1 : (X("hud"), r.showInactive(), !0));
l.handle("senti:start-screen-context", () => !0);
l.handle("senti:stop-screen-context", () => !0);
l.handle("senti:start-code-bridge", async () => {
  if (b) return !0;
  try {
    const t = await import("./wrapper-CoTtEBNz.js"), e = t.Server || t.default.Server;
    return e ? (b = new e({ port: 9876, host: "127.0.0.1" }), b.on("connection", (n) => {
      k = n, r == null || r.webContents.send("senti:code-bridge-message", { type: "connected" }), n.on("message", (o) => {
        try {
          const s = JSON.parse(o.toString());
          r == null || r.webContents.send("senti:code-bridge-message", s);
        } catch {
        }
      }), n.on("close", () => {
        k = null, r == null || r.webContents.send("senti:code-bridge-message", { type: "disconnected" });
      });
    }), b && b.on("error", () => {
    }), !0) : !1;
  } catch {
    return !1;
  }
});
l.handle("senti:stop-code-bridge", () => {
  if (b) {
    try {
      b.close();
    } catch {
    }
    b = null, k = null;
  }
  return !0;
});
l.handle("senti:send-to-vscode", (t, e) => {
  if (!k || k.readyState !== 1) return !1;
  try {
    return k.send(JSON.stringify(e)), !0;
  } catch {
    return !1;
  }
});
l.handle("senti:is-code-bridge-connected", () => k !== null && k.readyState === 1);
l.handle("senti:quit", () => (p.quit(), !0));
export {
  Ot as resetRemoteKeyState
};
