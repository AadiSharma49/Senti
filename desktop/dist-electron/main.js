import { existsSync as S, readFileSync as C, mkdirSync as F, writeFileSync as T, unlinkSync as pe, readdirSync as G, statSync as Q, rmdirSync as ve } from "fs";
import { spawn as w, execFileSync as Ce, execFile as E } from "child_process";
import fe from "http";
import g from "os";
import Pe from "electron";
import d from "path";
import { fileURLToPath as Ie } from "url";
function Fe(t, e) {
  const n = d.resolve(t), o = d.resolve(n, e || ""), s = n.endsWith(d.sep) ? n : n + d.sep;
  return o !== n && !o.startsWith(s) ? null : o;
}
const { app: p, BrowserWindow: he, screen: me, ipcMain: c, globalShortcut: I, safeStorage: R, session: z, shell: x, Tray: Te, Menu: Ee, nativeImage: se, powerSaveBlocker: ie, desktopCapturer: ye, clipboard: ge } = Pe, Ae = Ie(import.meta.url), ee = d.dirname(Ae), B = process.env.VITE_DEV_SERVER_URL, be = "http://localhost:5173";
let r = null, K = "";
const _e = {
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
}, De = 47615;
function Me(t) {
  return new Promise((e, n) => {
    const o = fe.createServer((l, a) => {
      try {
        let u = decodeURIComponent((l.url || "/").split("?")[0]);
        (u === "/" || u === "") && (u = "/index.html");
        const h = d.normalize(u).replace(/^([/\\])+/, ""), f = d.join(t, h);
        if (!f.startsWith(t) || !S(f)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const m = C(f);
        a.writeHead(200, {
          "Content-Type": _e[d.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(m);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = De, i = 0;
    o.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(l);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const v = () => d.join(p.getPath("userData"), "device.token");
function Oe(t) {
  try {
    return F(d.dirname(v()), { recursive: !0 }), R.isEncryptionAvailable() ? (T(v(), R.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function we() {
  try {
    return !S(v()) || !R.isEncryptionAvailable() ? null : R.decryptString(C(v()));
  } catch {
    return null;
  }
}
function Re() {
  try {
    S(v()) && pe(v());
  } catch {
  }
}
const N = () => d.join(p.getPath("userData"), "setup.json");
function Be() {
  var t;
  try {
    return S(N()) ? ((t = JSON.parse(C(N(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function Ne(t) {
  try {
    F(d.dirname(N()), { recursive: !0 }), T(N(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const Se = 200, L = () => d.join(p.getPath("userData"), "memories.json");
function j() {
  try {
    if (!S(L())) return [];
    const t = JSON.parse(C(L(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function te(t) {
  try {
    F(d.dirname(L()), { recursive: !0 }), T(L(), JSON.stringify(t.slice(-Se)));
  } catch {
  }
}
const Le = 21, je = 3, W = () => d.join(p.getPath("userData"), "activity.json");
function Y() {
  try {
    if (!S(W())) return [];
    const t = JSON.parse(C(W(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function ke(t) {
  try {
    F(d.dirname(W()), { recursive: !0 }), T(W(), JSON.stringify(t));
  } catch {
  }
}
function We(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function Ue(t, e, n) {
  const o = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(n) || 0));
  if (!o || !i) return Y();
  const l = /* @__PURE__ */ new Date(), a = l.toISOString().slice(0, 10), u = We(l), h = new Date(l.getTime() - Le * 864e5).toISOString().slice(0, 10), f = Y().filter((b) => b.day >= h);
  let m = f.find((b) => b.day === a && b.process === o && b.part === u);
  return m || (m = { day: a, process: o, part: u, minutes: 0, samples: [] }, f.push(m)), m.minutes = Math.round((m.minutes + i) * 10) / 10, s && !m.samples.includes(s) && m.samples.length < je && m.samples.push(s), ke(f), f;
}
function Ge(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return j();
  const n = j(), o = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === o)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-Se);
  return te(s), s;
}
let A = null;
const He = 2e4;
function qe() {
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
function ze() {
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
    E(
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
const ae = {
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
function Ve(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? ae[e] ? ae[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let V = null, le = 0;
const Ze = /* @__PURE__ */ new Set([
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
function Z(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function Je() {
  const t = [];
  return process.env.ProgramData && t.push(d.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(d.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function Ke() {
  const t = Date.now();
  if (V && t - le < 5 * 6e4) return V;
  const e = [], n = t, o = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = G(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const u = d.join(s, a.name);
      a.isDirectory() ? o(u, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: u });
    }
  };
  for (const s of Je()) o(s, 0);
  return V = e, le = t, e;
}
function J(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = Z(e), o = e.split(/\s+/).map(Z).filter((i) => i.length >= 2 && !Ze.has(i));
  if (!n && !o.length) return null;
  let s = null;
  for (const i of Ke()) {
    const l = Z(i.name);
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
async function Ye(t) {
  const e = Ve(t);
  if (e)
    try {
      if (e.kind === "url")
        return x.openExternal(e.target), { ok: !0, label: e.label };
      if (await et(e.label, e.target))
        return { ok: !0, label: e.label, focused: !0 };
      const o = J(e.label) || J(e.target);
      return o ? (x.openPath(o.path), { ok: !0, label: e.label }) : (w("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label });
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = J(t);
  if (n)
    try {
      return x.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
const Xe = `
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
`, Qe = {
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
function et(t, e) {
  const n = (Qe[t] ?? [e.replace(/\.exe$/i, "")]).map((s) => s.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!n.length) return Promise.resolve(!1);
  const o = `$names = @(${n.map((s) => `'${s}'`).join(",")})
`;
  return new Promise((s) => {
    try {
      E(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", o + Xe],
        { timeout: 6e3, windowsHide: !0 },
        (i, l) => s(!i && String(l).trim() === "yes")
      );
    } catch {
      s(!1);
    }
  });
}
function tt(t) {
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
function nt(t) {
  const e = tt(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? w("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && x.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const rt = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, ot = 15 * 1024 * 1024;
function $e(t, e) {
  const n = rt[t];
  if (!n) return null;
  let o;
  try {
    o = p.getPath(n);
  } catch {
    return null;
  }
  const s = Fe(o, e);
  return s ? { base: o, full: s } : null;
}
function st(t, e) {
  const n = $e(t, e);
  if (!n) throw new Error("Not allowed");
  const s = G(n.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let l = 0, a = 0;
    try {
      const u = Q(d.join(n.full, i.name));
      l = u.size, a = u.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: l, modified: a };
  }).sort((i, l) => i.dir === l.dir ? i.name.localeCompare(l.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: s });
}
function it(t, e) {
  const n = $e(t, e);
  if (!n) throw new Error("Not allowed");
  const o = Q(n.full);
  if (!o.isFile()) throw new Error("Not a file");
  if (o.size > ot) throw new Error("File is too large to send (15 MB limit)");
  const s = C(n.full);
  return JSON.stringify({
    name: d.basename(n.full),
    size: o.size,
    base64: s.toString("base64")
  });
}
const ce = 8e3, ue = 40;
function at(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return p.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), o = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, u) => {
    if (u > 4 || Date.now() - o > ce || i.length >= ue) return;
    let h;
    try {
      h = G(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - o > ce || i.length >= ue) return;
      if (f.name.startsWith(".") || s.test(f.name)) continue;
      const m = d.join(a, f.name);
      try {
        if (f.isSymbolicLink()) continue;
        f.isDirectory() ? l(m, u + 1) : f.isFile() && f.name.toLowerCase().includes(e) && i.push({ name: f.name, path: m });
      } catch {
      }
    }
  };
  for (const a of n) l(a, 0);
  if (i.length === 0) return { ok: !1, error: "not-found", count: 0 };
  i.sort((a, u) => {
    const h = a.name.toLowerCase(), f = u.name.toLowerCase(), m = h === e || h.replace(/\.[^.]+$/, "") === e, b = f === e || f.replace(/\.[^.]+$/, "") === e;
    return m !== b ? m ? -1 : 1 : a.name.length - u.name.length;
  });
  try {
    return x.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const de = 2e4;
function lt() {
  const t = [g.tmpdir(), d.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (i, l) => {
    if (l > 6 || Date.now() - e > de || !/temp/i.test(i)) return;
    let a;
    try {
      a = G(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const u of a) {
      if (Date.now() - e > de) return;
      const h = d.join(i, u.name);
      try {
        if (u.isSymbolicLink()) continue;
        if (u.isDirectory()) {
          s(h, l + 1);
          try {
            ve(h);
          } catch {
          }
        } else if (u.isFile()) {
          const f = Q(h).size;
          pe(h), n += f, o++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function ct() {
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
    const n = (Ce("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
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
const ut = `
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
function dt() {
  return new Promise((t) => {
    try {
      E(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", ut],
        { timeout: 5e3, windowsHide: !0 },
        (e, n) => {
          if (e || !n) return t(null);
          try {
            const o = JSON.parse(n.trim()), s = String(o.title || "").slice(0, 200), i = String(o.process || "").slice(0, 60);
            t(s || i ? { title: s, process: i } : null);
          } catch {
            t(null);
          }
        }
      );
    } catch {
      t(null);
    }
  });
}
const pt = `
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
$MD=0x0020; $MU=0x0040; $WHEEL=0x0800; $KEYUP=0x0002

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

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $p = $line.Split(' ')
  switch ($p[0]) {
    'M' {
      $x = [int]([double]$p[1] * 65535); $y = [int]([double]$p[2] * 65535)
      [SentiIn]::mouse_event($MOVE -bor $ABS, $x, $y, 0, [IntPtr]::Zero)
    }
    'R' {
      # RELATIVE move: no ABSOLUTE flag, so Windows adds the delta to the
      # current position. This is the only kind of motion a game reading raw
      # input understands — absolute jumps make camera control unusable.
      [SentiIn]::mouse_event($MOVE, [int]$p[1], [int]$p[2], 0, [IntPtr]::Zero)
    }
    'C' {
      # A click with x<0 means "wherever the pointer already is" — during
      # pointer lock the viewer has no meaningful absolute position to send.
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
    'T' {
      $text = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))
      foreach ($ch in $text.ToCharArray()) {
        if ($ch -eq "\`n") { Send-Key 0x0D 0; continue }
        $scan = [SentiIn]::VkKeyScan($ch)
        if ($scan -eq -1) { continue }
        Send-Key ([byte]($scan -band 0xFF)) (($scan -shr 8) -band 0xFF)
      }
    }
    'K' { Send-Key ([byte][int]$p[1]) ([int]$p[2]) }
  }
}
`;
let y = null;
function ft() {
  if (y && !y.killed) return !0;
  try {
    const t = d.join(p.getPath("userData"), "input.ps1");
    return F(d.dirname(t), { recursive: !0 }), T(t, pt, "utf8"), y = w(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", t],
      { stdio: ["pipe", "ignore", "ignore"], windowsHide: !0 }
    ), y.on("exit", () => {
      y = null;
    }), !0;
  } catch {
    return y = null, !1;
  }
}
function ne() {
  try {
    y == null || y.kill();
  } catch {
  }
  y = null;
}
const ht = {
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
  F12: 123
}, _ = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function mt(t) {
  switch (t.t) {
    case "move":
      return `M ${_(t.x).toFixed(5)} ${_(t.y).toFixed(5)}`;
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      return typeof t.x != "number" || t.x < 0 ? `C ${e} -1 -1 ${n}` : `C ${e} ${_(t.x).toFixed(5)} ${_(t.y).toFixed(5)} ${n}`;
    }
    case "scroll": {
      const e = Math.max(-10, Math.min(10, Math.round(-(Number(t.d) || 0) / 100)));
      return e ? `S ${e * 120}` : null;
    }
    case "type": {
      const e = String(t.text ?? "").slice(0, 500);
      return e ? `T ${Buffer.from(e, "utf8").toString("base64")}` : null;
    }
    case "key": {
      const e = ht[String(t.k)];
      if (e === void 0) return null;
      const n = Array.isArray(t.mods) ? t.mods : [], o = (n.includes("shift") ? 1 : 0) | (n.includes("ctrl") ? 2 : 0) | (n.includes("alt") ? 4 : 0);
      return `K ${e} ${o}`;
    }
    default:
      return null;
  }
}
function yt(t) {
  if (!Array.isArray(t) || !t.length || !ft() || !(y != null && y.stdin)) return !1;
  const e = t.map((n) => mt(n)).filter((n) => !!n);
  if (!e.length) return !0;
  try {
    return y.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return ne(), !1;
  }
}
function gt() {
  try {
    return w("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function bt(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      E("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
    else if (e === "restart" || e === "reboot")
      w("shutdown", ["/r", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else if (e === "shutdown" || e === "shut down" || e === "off")
      w("shutdown", ["/s", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else
      return !1;
    return !0;
  } catch {
    return !1;
  }
}
function wt(t) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return E("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const St = {
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
function kt(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = St[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return w("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function $t() {
  if (A && Date.now() - A.at < He) return A.data;
  const t = qe();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await ze();
    } catch {
    }
  const n = { ...t, ...e };
  return A = { at: Date.now(), data: n }, n;
}
async function xt(t) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = we();
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
let U = !0;
const vt = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Ct = "CommandOrControl+Alt+Shift+Q", Pt = "CommandOrControl+Shift+Space";
function It() {
  for (const t of vt)
    try {
      I.isRegistered(t) && I.unregister(t);
    } catch {
    }
}
function $(t) {
  U = t, It();
}
function Ft(t, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), i = () => {
      fe.get(t, (u) => {
        u.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function xe() {
  const { width: t, height: e } = me.getPrimaryDisplay().workAreaSize, n = d.join(ee, "preload.cjs");
  r = new he({
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
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), B ? r.loadURL(be).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : K ? r.loadURL(K).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var o, s;
    r == null || r.show(), r == null || r.focus(), B && ((s = (o = r == null ? void 0 : r.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
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
    H || (o.preventDefault(), r == null || r.hide());
  });
}
p.requestSingleInstanceLock() ? p.on("second-instance", () => {
  r && !r.isDestroyed() && X();
}) : p.quit();
p.whenReady().then(async () => {
  if (B)
    try {
      await Ft(be);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), p.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (z.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(t(n));
  }), z.defaultSession.setPermissionCheckHandler((e, n) => t(n)), z.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    ye.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((o) => {
      n(o[0] ? { video: o[0] } : {});
    });
  }), !B)
    try {
      K = await Me(d.join(ee, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), p.quit();
      return;
    }
  xe(), $(!0);
  try {
    I.register(Ct, () => {
      U = !1, p.exit(0);
    });
  } catch {
  }
  try {
    I.register(Pt, () => {
      U || r == null || r.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && p.isPackaged && p.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
p.on("activate", () => {
  he.getAllWindows().length === 0 ? xe() : (r == null || r.show(), r == null || r.focus());
});
p.on("window-all-closed", () => {
  H && process.platform !== "darwin" && p.quit();
});
p.on("before-quit", () => {
  H = !0;
});
p.on("before-quit", () => {
  r = null;
});
p.on("will-quit", () => {
  I.unregisterAll(), ne();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : Oe(e.trim()));
c.handle("senti:token-clear", () => (Re(), !0));
c.handle("senti:token-present", () => !!we());
c.on("senti:get-setup", (t) => {
  t.returnValue = Be();
});
c.handle("senti:set-setup", (t, e) => (Ne(!!e), !0));
c.handle("senti:system-info", () => $t());
c.handle("senti:clipboard-read", () => {
  try {
    return ge.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && ge.writeText(e), !0;
  } catch {
    return !1;
  }
});
c.handle("senti:screen-sources", async () => {
  try {
    return (await ye.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => j());
c.handle("senti:memory-add", (t, e) => Ge(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = j().filter((o) => o.id !== String(e));
  return te(n), n;
});
c.handle("senti:memory-clear", () => (te([]), []));
c.handle(
  "senti:activity-record",
  (t, e, n, o) => Ue(e, n, o)
);
c.handle("senti:activity-list", () => Y());
c.handle("senti:activity-clear", () => (ke([]), []));
let k = null;
const D = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const o = typeof n == "string" && n ? n : "default";
    return e ? D.add(o) : D.delete(o), D.size > 0 && k === null ? k = ie.start("prevent-display-sleep") : D.size === 0 && k !== null && (ie.stop(k), k = null), k !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => Ye(e));
c.handle("senti:close-app", (t, e) => kt(e));
c.handle("senti:clean-temp", () => lt());
c.handle("senti:empty-recycle-bin", () => ct());
c.handle("senti:open-folder", (t, e) => nt(e));
c.handle(
  "senti:serve-list",
  (t, e, n) => st(String(e ?? ""), String(n ?? ""))
);
c.handle(
  "senti:serve-read",
  (t, e, n) => it(String(e ?? ""), String(n ?? ""))
);
c.handle("senti:open-file", (t, e) => at(e));
c.handle("senti:web-search", (t, e) => {
  const n = String(e ?? "").trim().slice(0, 200);
  return n ? (x.openExternal(`https://www.google.com/search?q=${encodeURIComponent(n)}`), { ok: !0 }) : { ok: !1 };
});
c.handle("senti:lock-workstation", () => gt());
c.handle("senti:power", (t, e) => bt(e));
c.handle("senti:active-window", () => dt());
c.handle("senti:remote-input", (t, e) => yt(e));
c.handle("senti:remote-input-stop", () => (ne(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? wt(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : xt({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: g.hostname(),
  platform: process.platform
}));
c.handle("senti:set-lock-state", (t, e) => {
  $(!!e);
});
let re = "signin", P = null, H = !1;
const M = 380, O = 132;
function oe(t) {
  if (!r || r.isDestroyed()) return;
  const { workArea: e } = me.getPrimaryDisplay();
  t ? r.setBounds({
    x: Math.round(e.x + (e.width - M) / 2),
    y: Math.round(e.y + (e.height - M) / 2 - e.height * 0.06),
    width: M,
    height: M
  }) : r.setBounds({
    x: Math.round(e.x + e.width - O - 18),
    y: Math.round(e.y + e.height - O - 18),
    width: O,
    height: O
  });
}
function q(t) {
  !r || r.isDestroyed() || (re = t, t === "hud" ? ($(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), r.setIgnoreMouseEvents(!0, { forward: !0 }), oe(!1), r.showInactive()) : t === "setup" ? ($(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : t === "panel" ? ($(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(760, 840), r.center(), r.show(), r.focus()) : ($(!0), r.setIgnoreMouseEvents(!1), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()));
}
function Tt() {
  !r || r.isDestroyed() || re !== "hud" || (oe(!0), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function Et() {
  !r || r.isDestroyed() || re !== "hud" || oe(!1);
}
function At() {
  const t = [
    d.join(process.resourcesPath || "", "build", "icon.png"),
    d.join(ee, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (S(e)) {
        const n = se.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return se.createEmpty();
}
function X() {
  !r || r.isDestroyed() || (r.webContents.send("senti:open-settings"), q("panel"), r.show(), r.focus());
}
function _t() {
  if (!P)
    try {
      P = new Te(At()), P.setToolTip("Senti — listening for you"), P.setContextMenu(
        Ee.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => X() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              H = !0, p.quit();
            }
          }
        ])
      ), P.on("click", () => X());
    } catch {
    }
}
function Dt(t) {
  q(t ? "setup" : "signin");
}
c.handle("senti:set-setup-mode", (t, e) => (Dt(!!e), !0));
c.handle("senti:set-window-mode", (t, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (q(e), e === "hud" && _t(), !0) : !1);
c.handle("senti:enter-fullscreen", () => !r || r.isDestroyed() ? !1 : (r.setAlwaysOnTop(!1), r.setFullScreen(!0), r.focus(), !0));
c.handle("senti:exit-fullscreen", () => !r || r.isDestroyed() ? !1 : (r.setFullScreen(!1), r.setAlwaysOnTop(!0, "screen-saver"), !0));
c.handle("senti:hud-show", () => (Tt(), !0));
c.handle("senti:hud-hide", () => (Et(), !0));
c.handle("senti:lock", () => {
  q("signin");
});
c.handle("senti:quit", () => U ? !1 : (p.quit(), !0));
