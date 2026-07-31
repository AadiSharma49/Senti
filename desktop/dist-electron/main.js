import { existsSync as S, readFileSync as v, mkdirSync as P, writeFileSync as I, unlinkSync as fe, readdirSync as W, statSync as Y, rmdirSync as Fe } from "fs";
import { spawn as b, execFileSync as De, execFile as D } from "child_process";
import he from "http";
import g from "os";
import Ee from "electron";
import u from "path";
import { fileURLToPath as Te } from "url";
function Ae(t, e) {
  const n = u.resolve(t), r = u.resolve(n, e || ""), s = n.endsWith(u.sep) ? n : n + u.sep;
  return r !== n && !r.startsWith(s) ? null : r;
}
const { app: p, BrowserWindow: me, screen: X, ipcMain: c, globalShortcut: ye, safeStorage: R, session: z, shell: $, Tray: Me, Menu: _e, nativeImage: se, powerSaveBlocker: ie, desktopCapturer: Q, clipboard: ge } = Ee, Oe = Te(import.meta.url), ee = u.dirname(Oe), N = process.env.VITE_DEV_SERVER_URL, we = "http://localhost:5173";
let o = null, Z = "";
const Re = {
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
}, Ne = 47615;
function Be(t) {
  return new Promise((e, n) => {
    const r = he.createServer((l, a) => {
      try {
        let d = decodeURIComponent((l.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const h = u.normalize(d).replace(/^([/\\])+/, ""), f = u.join(t, h);
        if (!f.startsWith(t) || !S(f)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const m = v(f);
        a.writeHead(200, {
          "Content-Type": Re[u.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(m);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = Ne, i = 0;
    r.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => r.listen(s, "127.0.0.1"), 40)) : n(l);
    }), r.on("listening", () => e(`http://127.0.0.1:${s}`)), r.listen(s, "127.0.0.1");
  });
}
const x = () => u.join(p.getPath("userData"), "device.token");
function je(t) {
  try {
    return P(u.dirname(x()), { recursive: !0 }), R.isEncryptionAvailable() ? (I(x(), R.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function be() {
  try {
    return !S(x()) || !R.isEncryptionAvailable() ? null : R.decryptString(v(x()));
  } catch {
    return null;
  }
}
function Le() {
  try {
    S(x()) && fe(x());
  } catch {
  }
}
const B = () => u.join(p.getPath("userData"), "setup.json");
function Ue() {
  var t;
  try {
    return S(B()) ? ((t = JSON.parse(v(B(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function We(t) {
  try {
    P(u.dirname(B()), { recursive: !0 }), I(B(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const Se = 200, j = () => u.join(p.getPath("userData"), "memories.json");
function L() {
  try {
    if (!S(j())) return [];
    const t = JSON.parse(v(j(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function te(t) {
  try {
    P(u.dirname(j()), { recursive: !0 }), I(j(), JSON.stringify(t.slice(-Se)));
  } catch {
  }
}
const Ge = 21, ze = 3, U = () => u.join(p.getPath("userData"), "activity.json");
function J() {
  try {
    if (!S(U())) return [];
    const t = JSON.parse(v(U(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function ke(t) {
  try {
    P(u.dirname(U()), { recursive: !0 }), I(U(), JSON.stringify(t));
  } catch {
  }
}
function He(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function qe(t, e, n) {
  const r = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(n) || 0));
  if (!r || !i) return J();
  const l = /* @__PURE__ */ new Date(), a = l.toISOString().slice(0, 10), d = He(l), h = new Date(l.getTime() - Ge * 864e5).toISOString().slice(0, 10), f = J().filter((w) => w.day >= h);
  let m = f.find((w) => w.day === a && w.process === r && w.part === d);
  return m || (m = { day: a, process: r, part: d, minutes: 0, samples: [] }, f.push(m)), m.minutes = Math.round((m.minutes + i) * 10) / 10, s && !m.samples.includes(s) && m.samples.length < ze && m.samples.push(s), ke(f), f;
}
function Ve(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return L();
  const n = L(), r = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === r)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-Se);
  return te(s), s;
}
let E = null;
const Ze = 2e4;
function Je() {
  var r, s;
  const t = g.totalmem() / 1073741824, e = g.freemem() / 1024 ** 3, n = t - e;
  return {
    os: `${g.type()} ${g.release()}`,
    cpu: ((s = (r = g.cpus()[0]) == null ? void 0 : r.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: g.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / t * 100),
    uptimeHours: +(g.uptime() / 3600).toFixed(1)
  };
}
function Ke() {
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
    D(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", t],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (n, r) => {
        if (n || !r) return e({});
        try {
          const s = JSON.parse(r), i = (s.disks || []).map((l) => ({
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
function Ye(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? ae[e] ? ae[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let H = null, le = 0;
const Xe = /* @__PURE__ */ new Set([
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
function q(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function Qe() {
  const t = [];
  return process.env.ProgramData && t.push(u.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(u.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function et() {
  const t = Date.now();
  if (H && t - le < 5 * 6e4) return H;
  const e = [], n = t, r = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = W(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const d = u.join(s, a.name);
      a.isDirectory() ? r(d, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: d });
    }
  };
  for (const s of Qe()) r(s, 0);
  return H = e, le = t, e;
}
function V(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = q(e), r = e.split(/\s+/).map(q).filter((i) => i.length >= 2 && !Xe.has(i));
  if (!n && !r.length) return null;
  let s = null;
  for (const i of et()) {
    const l = q(i.name);
    let a = 0;
    if (l === n) a = 100;
    else if (n.length >= 3 && l.includes(n)) a = 60 - Math.min(25, l.length - n.length);
    else {
      let d = 0;
      for (const h of r) h.length >= 3 && l.includes(h) && d++;
      d && (a = 20 + d * 12 - Math.min(15, Math.floor(l.length / 6)));
    }
    a > 0 && (!s || a > s.score) && (s = { app: i, score: a });
  }
  return s && s.score >= 20 ? s.app : null;
}
async function tt(t) {
  const e = Ye(t);
  if (e)
    try {
      if (e.kind === "url")
        return $.openExternal(e.target), { ok: !0, label: e.label };
      if (await ot(e.label, e.target))
        return { ok: !0, label: e.label, focused: !0 };
      const r = V(e.label) || V(e.target);
      return r ? ($.openPath(r.path), { ok: !0, label: e.label }) : (b("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label });
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = V(t);
  if (n)
    try {
      return $.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
const nt = `
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
`, rt = {
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
function ot(t, e) {
  const n = (rt[t] ?? [e.replace(/\.exe$/i, "")]).map((s) => s.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!n.length) return Promise.resolve(!1);
  const r = `$names = @(${n.map((s) => `'${s}'`).join(",")})
`;
  return new Promise((s) => {
    try {
      D(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", r + nt],
        { timeout: 6e3, windowsHide: !0 },
        (i, l) => s(!i && String(l).trim() === "yes")
      );
    } catch {
      s(!1);
    }
  });
}
function st(t) {
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
function it(t) {
  const e = st(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? b("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && $.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const at = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, lt = 15 * 1024 * 1024;
function $e(t, e) {
  const n = at[t];
  if (!n) return null;
  let r;
  try {
    r = p.getPath(n);
  } catch {
    return null;
  }
  const s = Ae(r, e);
  return s ? { base: r, full: s } : null;
}
function ct(t, e) {
  const n = $e(t, e);
  if (!n) throw new Error("Not allowed");
  const s = W(n.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let l = 0, a = 0;
    try {
      const d = Y(u.join(n.full, i.name));
      l = d.size, a = d.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: l, modified: a };
  }).sort((i, l) => i.dir === l.dir ? i.name.localeCompare(l.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: s });
}
function ut(t, e) {
  const n = $e(t, e);
  if (!n) throw new Error("Not allowed");
  const r = Y(n.full);
  if (!r.isFile()) throw new Error("Not a file");
  if (r.size > lt) throw new Error("File is too large to send (15 MB limit)");
  const s = v(n.full);
  return JSON.stringify({
    name: u.basename(n.full),
    size: r.size,
    base64: s.toString("base64")
  });
}
const ce = 8e3, ue = 40;
function dt(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return p.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), r = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, d) => {
    if (d > 4 || Date.now() - r > ce || i.length >= ue) return;
    let h;
    try {
      h = W(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - r > ce || i.length >= ue) return;
      if (f.name.startsWith(".") || s.test(f.name)) continue;
      const m = u.join(a, f.name);
      try {
        if (f.isSymbolicLink()) continue;
        f.isDirectory() ? l(m, d + 1) : f.isFile() && f.name.toLowerCase().includes(e) && i.push({ name: f.name, path: m });
      } catch {
      }
    }
  };
  for (const a of n) l(a, 0);
  if (i.length === 0) return { ok: !1, error: "not-found", count: 0 };
  i.sort((a, d) => {
    const h = a.name.toLowerCase(), f = d.name.toLowerCase(), m = h === e || h.replace(/\.[^.]+$/, "") === e, w = f === e || f.replace(/\.[^.]+$/, "") === e;
    return m !== w ? m ? -1 : 1 : a.name.length - d.name.length;
  });
  try {
    return $.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const de = 2e4;
function xe() {
  const t = [g.tmpdir(), u.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, r = 0;
  const s = (i, l) => {
    if (l > 6 || Date.now() - e > de || !/temp/i.test(i)) return;
    let a;
    try {
      a = W(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of a) {
      if (Date.now() - e > de) return;
      const h = u.join(i, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          s(h, l + 1);
          try {
            Fe(h);
          } catch {
          }
        } else if (d.isFile()) {
          const f = Y(h).size;
          fe(h), n += f, r++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: r };
}
function pt() {
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
    const n = (De("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [r, s] = n.split(/\s+/).map((i) => parseInt(i, 10));
    return {
      files: Number.isFinite(r) ? r : 0,
      freedMB: Number.isFinite(s) ? Math.round(s / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
const ft = `
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
function ve() {
  return new Promise((t) => {
    try {
      D(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", ft],
        { timeout: 5e3, windowsHide: !0 },
        (e, n) => {
          if (e || !n) return t(null);
          try {
            const r = JSON.parse(n.trim()), s = String(r.title || "").slice(0, 200), i = String(r.process || "").slice(0, 60);
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
const ht = `
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
function mt() {
  if (y && !y.killed) return !0;
  try {
    const t = u.join(p.getPath("userData"), "input.ps1");
    return P(u.dirname(t), { recursive: !0 }), I(t, ht, "utf8"), y = b(
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
const yt = {
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
}, T = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function gt(t) {
  switch (t.t) {
    case "move":
      return `M ${T(t.x).toFixed(5)} ${T(t.y).toFixed(5)}`;
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      return typeof t.x != "number" || t.x < 0 ? `C ${e} -1 -1 ${n}` : `C ${e} ${T(t.x).toFixed(5)} ${T(t.y).toFixed(5)} ${n}`;
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
      const e = String(t.k), n = yt[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const r = Array.isArray(t.mods) ? t.mods : [], s = (r.includes("shift") ? 1 : 0) | (r.includes("ctrl") ? 2 : 0) | (r.includes("alt") ? 4 : 0);
      return `K ${n} ${s}`;
    }
    default:
      return null;
  }
}
function F(t) {
  if (!Array.isArray(t) || !t.length || !mt() || !(y != null && y.stdin)) return !1;
  const e = t.map((n) => gt(n)).filter((n) => !!n);
  if (!e.length) return !0;
  try {
    return y.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return ne(), !1;
  }
}
const wt = 900;
function A(t) {
  return new Promise((e) => setTimeout(e, t));
}
async function pe(t) {
  const e = await ve();
  if (!e) return !1;
  const n = e.process.toLowerCase();
  return n !== "explorer" && n !== "cabinetwclass" ? !1 : e.title.toLowerCase().includes(t.toLowerCase());
}
async function bt() {
  const t = g.tmpdir(), e = u.basename(t);
  try {
    $.openPath(t);
  } catch {
    return !1;
  }
  let n = !1;
  for (let r = 0; r < 14; r++)
    if (await A(400), await pe(e)) {
      n = !0;
      break;
    }
  if (!n || !F([{ t: "key", k: "a", mods: ["ctrl"] }]) || (await A(700), !await pe(e)) || !F([{ t: "key", k: "Delete", mods: ["shift"] }])) return !1;
  await A(wt), F([{ t: "key", k: "Enter" }]);
  for (let r = 0; r < 3; r++)
    await A(1200), F([{ t: "key", k: "Enter" }]);
  return !0;
}
function St() {
  try {
    return b("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function kt(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      D("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
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
function $t(t) {
  const r = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return D("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", r], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const xt = {
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
function vt(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = xt[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return b("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Pt() {
  if (E && Date.now() - E.at < Ze) return E.data;
  const t = Je();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await Ke();
    } catch {
    }
  const n = { ...t, ...e };
  return E = { at: Date.now(), data: n }, n;
}
async function It(t) {
  const { baseUrl: e, path: n, method: r = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = be();
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
const Ct = "CommandOrControl+Shift+Space";
function Ft(t, e = 15e3) {
  return new Promise((n, r) => {
    const s = Date.now(), i = () => {
      he.get(t, (d) => {
        d.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? r(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function Pe() {
  const { width: t, height: e } = X.getPrimaryDisplay().workAreaSize, n = u.join(ee, "preload.cjs");
  o = new me({
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
  }), o.setVisibleOnAllWorkspaces(!0), o.setMenuBarVisibility(!1), o.setAlwaysOnTop(!0, "screen-saver"), N ? o.loadURL(we).catch((r) => {
    console.error("[Electron] Failed to load dev server:", r.message);
  }) : Z ? o.loadURL(Z).catch((r) => {
    console.error("[Electron] Failed to load prod server:", r.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), o.webContents.on("did-finish-load", () => {
    var r, s;
    o == null || o.show(), o == null || o.focus(), N && ((s = (r = o == null ? void 0 : o.webContents) == null ? void 0 : r.openDevTools) == null || s.call(r));
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
    G || (r.preventDefault(), o == null || o.hide());
  });
}
p.requestSingleInstanceLock() ? p.on("second-instance", () => {
  o && !o.isDestroyed() && K();
}) : p.quit();
p.whenReady().then(async () => {
  if (N)
    try {
      await Ft(we);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), p.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (z.defaultSession.setPermissionRequestHandler((e, n, r) => {
    r(t(n));
  }), z.defaultSession.setPermissionCheckHandler((e, n) => t(n)), z.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    Q.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((r) => {
      n(r[0] ? { video: r[0] } : {});
    });
  }), !N)
    try {
      Z = await Be(u.join(ee, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), p.quit();
      return;
    }
  Pe();
  try {
    ye.register(Ct, () => {
      o == null || o.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && p.isPackaged && p.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
p.on("activate", () => {
  me.getAllWindows().length === 0 ? Pe() : (o == null || o.show(), o == null || o.focus());
});
p.on("window-all-closed", () => {
  G && process.platform !== "darwin" && p.quit();
});
p.on("before-quit", () => {
  G = !0;
});
p.on("before-quit", () => {
  o = null;
});
p.on("will-quit", () => {
  ye.unregisterAll(), ne();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : je(e.trim()));
c.handle("senti:token-clear", () => (Le(), !0));
c.handle("senti:token-present", () => !!be());
c.on("senti:get-setup", (t) => {
  t.returnValue = Ue();
});
c.handle("senti:set-setup", (t, e) => (We(!!e), !0));
c.handle("senti:system-info", () => Pt());
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
async function Ie(t = 1600) {
  var e;
  try {
    const n = X.getPrimaryDisplay(), { width: r, height: s } = n.size, i = Math.min(1, t / r), a = (e = (await Q.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(r * i), height: Math.round(s * i) }
    }))[0]) == null ? void 0 : e.thumbnail;
    return !a || a.isEmpty() ? null : a.toDataURL();
  } catch {
    return null;
  }
}
async function Dt() {
  const t = await Ie(4096);
  if (!t) return { ok: !1 };
  try {
    const e = u.join(p.getPath("pictures"), "Senti");
    P(e, { recursive: !0 });
    const n = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19), r = u.join(e, `screenshot-${n}.png`);
    return I(r, Buffer.from(t.split(",")[1], "base64")), { ok: !0, path: r };
  } catch {
    return { ok: !1 };
  }
}
c.handle("senti:screenshot-save", () => Dt());
c.handle("senti:screenshot-grab", () => Ie(1600));
c.handle("senti:screen-sources", async () => {
  try {
    return (await Q.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => L());
c.handle("senti:memory-add", (t, e) => Ve(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = L().filter((r) => r.id !== String(e));
  return te(n), n;
});
c.handle("senti:memory-clear", () => (te([]), []));
c.handle(
  "senti:activity-record",
  (t, e, n, r) => qe(e, n, r)
);
c.handle("senti:activity-list", () => J());
c.handle("senti:activity-clear", () => (ke([]), []));
let k = null;
const M = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const r = typeof n == "string" && n ? n : "default";
    return e ? M.add(r) : M.delete(r), M.size > 0 && k === null ? k = ie.start("prevent-display-sleep") : M.size === 0 && k !== null && (ie.stop(k), k = null), k !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => tt(e));
c.handle("senti:close-app", (t, e) => vt(e));
c.handle("senti:clean-temp", () => xe());
c.handle("senti:clean-temp-visible", async () => {
  const t = await bt();
  return { ...xe(), shown: t };
});
c.handle("senti:empty-recycle-bin", () => pt());
c.handle("senti:open-folder", (t, e) => it(e));
c.handle(
  "senti:serve-list",
  (t, e, n) => ct(String(e ?? ""), String(n ?? ""))
);
c.handle(
  "senti:serve-read",
  (t, e, n) => ut(String(e ?? ""), String(n ?? ""))
);
c.handle("senti:open-file", (t, e) => dt(e));
c.handle("senti:lock-workstation", () => St());
c.handle("senti:power", (t, e) => kt(e));
c.handle("senti:active-window", () => ve());
c.handle("senti:remote-input", (t, e) => F(e));
c.handle("senti:remote-input-stop", () => (ne(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? $t(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : It({
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
let re = "setup", C = null, G = !1;
const _ = 380, O = 132;
function oe(t) {
  if (!o || o.isDestroyed()) return;
  const { workArea: e } = X.getPrimaryDisplay();
  t ? o.setBounds({
    x: Math.round(e.x + (e.width - _) / 2),
    y: Math.round(e.y + (e.height - _) / 2 - e.height * 0.06),
    width: _,
    height: _
  }) : o.setBounds({
    x: Math.round(e.x + e.width - O - 18),
    y: Math.round(e.y + e.height - O - 18),
    width: O,
    height: O
  });
}
function Ce(t) {
  !o || o.isDestroyed() || (re = t, t === "hud" ? (o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!0), o.setAlwaysOnTop(!0, "screen-saver"), o.setIgnoreMouseEvents(!0, { forward: !0 }), oe(!1), o.showInactive()) : t === "setup" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!0), o.setSkipTaskbar(!1), o.setSize(980, 760), o.center(), o.show()) : t === "panel" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(760, 840), o.center(), o.show(), o.focus()) : (o.setIgnoreMouseEvents(!1), o.setFullScreen(!1), o.setAlwaysOnTop(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(680, 780), o.center(), o.show(), o.focus()));
}
function Et() {
  !o || o.isDestroyed() || re !== "hud" || (oe(!0), o.showInactive(), o.setAlwaysOnTop(!0, "screen-saver"));
}
function Tt() {
  !o || o.isDestroyed() || re !== "hud" || oe(!1);
}
function At() {
  const t = [
    u.join(process.resourcesPath || "", "build", "icon.png"),
    u.join(ee, "..", "build", "icon.png")
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
function K() {
  !o || o.isDestroyed() || (o.webContents.send("senti:open-settings"), Ce("panel"), o.show(), o.focus());
}
function Mt() {
  if (!C)
    try {
      C = new Me(At()), C.setToolTip("Senti — listening for you"), C.setContextMenu(
        _e.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => K() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              G = !0, p.quit();
            }
          }
        ])
      ), C.on("click", () => K());
    } catch {
    }
}
c.handle("senti:set-window-mode", (t, e) => e === "setup" || e === "hud" || e === "panel" ? (Ce(e), e === "hud" && Mt(), !0) : !1);
c.handle("senti:enter-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setAlwaysOnTop(!1), o.setFullScreen(!0), o.focus(), !0));
c.handle("senti:exit-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setFullScreen(!1), o.setAlwaysOnTop(!0, "screen-saver"), !0));
c.handle("senti:hud-show", () => (Et(), !0));
c.handle("senti:hud-hide", () => (Tt(), !0));
c.handle("senti:quit", () => (p.quit(), !0));
