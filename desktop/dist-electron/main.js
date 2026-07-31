import { existsSync as S, readFileSync as v, mkdirSync as C, writeFileSync as F, unlinkSync as de, readdirSync as U, statSync as Y, rmdirSync as Ce } from "fs";
import { spawn as b, execFileSync as Fe, execFile as E } from "child_process";
import pe from "http";
import g from "os";
import Ee from "electron";
import d from "path";
import { fileURLToPath as Te } from "url";
function Ae(t, e) {
  const n = d.resolve(t), r = d.resolve(n, e || ""), s = n.endsWith(d.sep) ? n : n + d.sep;
  return r !== n && !r.startsWith(s) ? null : r;
}
const { app: p, BrowserWindow: fe, screen: he, ipcMain: c, globalShortcut: me, safeStorage: N, session: H, shell: $, Tray: De, Menu: _e, nativeImage: re, powerSaveBlocker: oe, desktopCapturer: ye, clipboard: ge } = Ee, Me = Te(import.meta.url), X = d.dirname(Me), R = process.env.VITE_DEV_SERVER_URL, we = "http://localhost:5173";
let o = null, Z = "";
const Oe = {
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
function Re(t) {
  return new Promise((e, n) => {
    const r = pe.createServer((l, a) => {
      try {
        let u = decodeURIComponent((l.url || "/").split("?")[0]);
        (u === "/" || u === "") && (u = "/index.html");
        const h = d.normalize(u).replace(/^([/\\])+/, ""), f = d.join(t, h);
        if (!f.startsWith(t) || !S(f)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const m = v(f);
        a.writeHead(200, {
          "Content-Type": Oe[d.extname(f).toLowerCase()] || "application/octet-stream",
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
const x = () => d.join(p.getPath("userData"), "device.token");
function Be(t) {
  try {
    return C(d.dirname(x()), { recursive: !0 }), N.isEncryptionAvailable() ? (F(x(), N.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function be() {
  try {
    return !S(x()) || !N.isEncryptionAvailable() ? null : N.decryptString(v(x()));
  } catch {
    return null;
  }
}
function Le() {
  try {
    S(x()) && de(x());
  } catch {
  }
}
const B = () => d.join(p.getPath("userData"), "setup.json");
function je() {
  var t;
  try {
    return S(B()) ? ((t = JSON.parse(v(B(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function We(t) {
  try {
    C(d.dirname(B()), { recursive: !0 }), F(B(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const Se = 200, L = () => d.join(p.getPath("userData"), "memories.json");
function j() {
  try {
    if (!S(L())) return [];
    const t = JSON.parse(v(L(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function Q(t) {
  try {
    C(d.dirname(L()), { recursive: !0 }), F(L(), JSON.stringify(t.slice(-Se)));
  } catch {
  }
}
const Ue = 21, Ge = 3, W = () => d.join(p.getPath("userData"), "activity.json");
function J() {
  try {
    if (!S(W())) return [];
    const t = JSON.parse(v(W(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function ke(t) {
  try {
    C(d.dirname(W()), { recursive: !0 }), F(W(), JSON.stringify(t));
  } catch {
  }
}
function He(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function ze(t, e, n) {
  const r = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(n) || 0));
  if (!r || !i) return J();
  const l = /* @__PURE__ */ new Date(), a = l.toISOString().slice(0, 10), u = He(l), h = new Date(l.getTime() - Ue * 864e5).toISOString().slice(0, 10), f = J().filter((w) => w.day >= h);
  let m = f.find((w) => w.day === a && w.process === r && w.part === u);
  return m || (m = { day: a, process: r, part: u, minutes: 0, samples: [] }, f.push(m)), m.minutes = Math.round((m.minutes + i) * 10) / 10, s && !m.samples.includes(s) && m.samples.length < Ge && m.samples.push(s), ke(f), f;
}
function qe(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return j();
  const n = j(), r = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === r)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-Se);
  return Q(s), s;
}
let T = null;
const Ve = 2e4;
function Ze() {
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
function Je() {
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
const se = {
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
function Ke(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? se[e] ? se[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let z = null, ie = 0;
const Ye = /* @__PURE__ */ new Set([
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
function Xe() {
  const t = [];
  return process.env.ProgramData && t.push(d.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(d.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function Qe() {
  const t = Date.now();
  if (z && t - ie < 5 * 6e4) return z;
  const e = [], n = t, r = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = U(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const u = d.join(s, a.name);
      a.isDirectory() ? r(u, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: u });
    }
  };
  for (const s of Xe()) r(s, 0);
  return z = e, ie = t, e;
}
function V(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = q(e), r = e.split(/\s+/).map(q).filter((i) => i.length >= 2 && !Ye.has(i));
  if (!n && !r.length) return null;
  let s = null;
  for (const i of Qe()) {
    const l = q(i.name);
    let a = 0;
    if (l === n) a = 100;
    else if (n.length >= 3 && l.includes(n)) a = 60 - Math.min(25, l.length - n.length);
    else {
      let u = 0;
      for (const h of r) h.length >= 3 && l.includes(h) && u++;
      u && (a = 20 + u * 12 - Math.min(15, Math.floor(l.length / 6)));
    }
    a > 0 && (!s || a > s.score) && (s = { app: i, score: a });
  }
  return s && s.score >= 20 ? s.app : null;
}
async function et(t) {
  const e = Ke(t);
  if (e)
    try {
      if (e.kind === "url")
        return $.openExternal(e.target), { ok: !0, label: e.label };
      if (await rt(e.label, e.target))
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
const tt = `
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
`, nt = {
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
function rt(t, e) {
  const n = (nt[t] ?? [e.replace(/\.exe$/i, "")]).map((s) => s.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!n.length) return Promise.resolve(!1);
  const r = `$names = @(${n.map((s) => `'${s}'`).join(",")})
`;
  return new Promise((s) => {
    try {
      E(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", r + tt],
        { timeout: 6e3, windowsHide: !0 },
        (i, l) => s(!i && String(l).trim() === "yes")
      );
    } catch {
      s(!1);
    }
  });
}
function ot(t) {
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
function st(t) {
  const e = ot(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? b("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && $.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const it = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, at = 15 * 1024 * 1024;
function $e(t, e) {
  const n = it[t];
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
function lt(t, e) {
  const n = $e(t, e);
  if (!n) throw new Error("Not allowed");
  const s = U(n.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let l = 0, a = 0;
    try {
      const u = Y(d.join(n.full, i.name));
      l = u.size, a = u.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: l, modified: a };
  }).sort((i, l) => i.dir === l.dir ? i.name.localeCompare(l.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: s });
}
function ct(t, e) {
  const n = $e(t, e);
  if (!n) throw new Error("Not allowed");
  const r = Y(n.full);
  if (!r.isFile()) throw new Error("Not a file");
  if (r.size > at) throw new Error("File is too large to send (15 MB limit)");
  const s = v(n.full);
  return JSON.stringify({
    name: d.basename(n.full),
    size: r.size,
    base64: s.toString("base64")
  });
}
const ae = 8e3, le = 40;
function ut(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return p.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), r = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, u) => {
    if (u > 4 || Date.now() - r > ae || i.length >= le) return;
    let h;
    try {
      h = U(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - r > ae || i.length >= le) return;
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
    const h = a.name.toLowerCase(), f = u.name.toLowerCase(), m = h === e || h.replace(/\.[^.]+$/, "") === e, w = f === e || f.replace(/\.[^.]+$/, "") === e;
    return m !== w ? m ? -1 : 1 : a.name.length - u.name.length;
  });
  try {
    return $.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const ce = 2e4;
function xe() {
  const t = [g.tmpdir(), d.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, r = 0;
  const s = (i, l) => {
    if (l > 6 || Date.now() - e > ce || !/temp/i.test(i)) return;
    let a;
    try {
      a = U(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const u of a) {
      if (Date.now() - e > ce) return;
      const h = d.join(i, u.name);
      try {
        if (u.isSymbolicLink()) continue;
        if (u.isDirectory()) {
          s(h, l + 1);
          try {
            Ce(h);
          } catch {
          }
        } else if (u.isFile()) {
          const f = Y(h).size;
          de(h), n += f, r++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: r };
}
function dt() {
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
    const n = (Fe("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
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
const pt = `
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
      E(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", pt],
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
const ft = `
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
function ht() {
  if (y && !y.killed) return !0;
  try {
    const t = d.join(p.getPath("userData"), "input.ps1");
    return C(d.dirname(t), { recursive: !0 }), F(t, ft, "utf8"), y = b(
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
function ee() {
  try {
    y == null || y.kill();
  } catch {
  }
  y = null;
}
const mt = {
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
}, A = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function yt(t) {
  switch (t.t) {
    case "move":
      return `M ${A(t.x).toFixed(5)} ${A(t.y).toFixed(5)}`;
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      return typeof t.x != "number" || t.x < 0 ? `C ${e} -1 -1 ${n}` : `C ${e} ${A(t.x).toFixed(5)} ${A(t.y).toFixed(5)} ${n}`;
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
      const e = String(t.k), n = mt[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const r = Array.isArray(t.mods) ? t.mods : [], s = (r.includes("shift") ? 1 : 0) | (r.includes("ctrl") ? 2 : 0) | (r.includes("alt") ? 4 : 0);
      return `K ${n} ${s}`;
    }
    default:
      return null;
  }
}
function I(t) {
  if (!Array.isArray(t) || !t.length || !ht() || !(y != null && y.stdin)) return !1;
  const e = t.map((n) => yt(n)).filter((n) => !!n);
  if (!e.length) return !0;
  try {
    return y.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return ee(), !1;
  }
}
const gt = 900;
function D(t) {
  return new Promise((e) => setTimeout(e, t));
}
async function ue(t) {
  const e = await ve();
  if (!e) return !1;
  const n = e.process.toLowerCase();
  return n !== "explorer" && n !== "cabinetwclass" ? !1 : e.title.toLowerCase().includes(t.toLowerCase());
}
async function wt() {
  const t = g.tmpdir(), e = d.basename(t);
  try {
    $.openPath(t);
  } catch {
    return !1;
  }
  let n = !1;
  for (let r = 0; r < 14; r++)
    if (await D(400), await ue(e)) {
      n = !0;
      break;
    }
  if (!n || !I([{ t: "key", k: "a", mods: ["ctrl"] }]) || (await D(700), !await ue(e)) || !I([{ t: "key", k: "Delete", mods: ["shift"] }])) return !1;
  await D(gt), I([{ t: "key", k: "Enter" }]);
  for (let r = 0; r < 3; r++)
    await D(1200), I([{ t: "key", k: "Enter" }]);
  return !0;
}
function bt() {
  try {
    return b("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function St(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      E("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
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
function kt(t) {
  const r = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return E("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", r], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const $t = {
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
function xt(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = $t[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return b("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function vt() {
  if (T && Date.now() - T.at < Ve) return T.data;
  const t = Ze();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await Je();
    } catch {
    }
  const n = { ...t, ...e };
  return T = { at: Date.now(), data: n }, n;
}
async function Pt(t) {
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
const It = "CommandOrControl+Shift+Space";
function Ct(t, e = 15e3) {
  return new Promise((n, r) => {
    const s = Date.now(), i = () => {
      pe.get(t, (u) => {
        u.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? r(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function Pe() {
  const { width: t, height: e } = he.getPrimaryDisplay().workAreaSize, n = d.join(X, "preload.cjs");
  o = new fe({
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
  }), o.setVisibleOnAllWorkspaces(!0), o.setMenuBarVisibility(!1), o.setAlwaysOnTop(!0, "screen-saver"), R ? o.loadURL(we).catch((r) => {
    console.error("[Electron] Failed to load dev server:", r.message);
  }) : Z ? o.loadURL(Z).catch((r) => {
    console.error("[Electron] Failed to load prod server:", r.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), o.webContents.on("did-finish-load", () => {
    var r, s;
    o == null || o.show(), o == null || o.focus(), R && ((s = (r = o == null ? void 0 : o.webContents) == null ? void 0 : r.openDevTools) == null || s.call(r));
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
  if (R)
    try {
      await Ct(we);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), p.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (H.defaultSession.setPermissionRequestHandler((e, n, r) => {
    r(t(n));
  }), H.defaultSession.setPermissionCheckHandler((e, n) => t(n)), H.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    ye.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((r) => {
      n(r[0] ? { video: r[0] } : {});
    });
  }), !R)
    try {
      Z = await Re(d.join(X, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), p.quit();
      return;
    }
  Pe();
  try {
    me.register(It, () => {
      o == null || o.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && p.isPackaged && p.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
p.on("activate", () => {
  fe.getAllWindows().length === 0 ? Pe() : (o == null || o.show(), o == null || o.focus());
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
  me.unregisterAll(), ee();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : Be(e.trim()));
c.handle("senti:token-clear", () => (Le(), !0));
c.handle("senti:token-present", () => !!be());
c.on("senti:get-setup", (t) => {
  t.returnValue = je();
});
c.handle("senti:set-setup", (t, e) => (We(!!e), !0));
c.handle("senti:system-info", () => vt());
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
c.handle("senti:memory-add", (t, e) => qe(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = j().filter((r) => r.id !== String(e));
  return Q(n), n;
});
c.handle("senti:memory-clear", () => (Q([]), []));
c.handle(
  "senti:activity-record",
  (t, e, n, r) => ze(e, n, r)
);
c.handle("senti:activity-list", () => J());
c.handle("senti:activity-clear", () => (ke([]), []));
let k = null;
const _ = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const r = typeof n == "string" && n ? n : "default";
    return e ? _.add(r) : _.delete(r), _.size > 0 && k === null ? k = oe.start("prevent-display-sleep") : _.size === 0 && k !== null && (oe.stop(k), k = null), k !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => et(e));
c.handle("senti:close-app", (t, e) => xt(e));
c.handle("senti:clean-temp", () => xe());
c.handle("senti:clean-temp-visible", async () => {
  const t = await wt();
  return { ...xe(), shown: t };
});
c.handle("senti:empty-recycle-bin", () => dt());
c.handle("senti:open-folder", (t, e) => st(e));
c.handle(
  "senti:serve-list",
  (t, e, n) => lt(String(e ?? ""), String(n ?? ""))
);
c.handle(
  "senti:serve-read",
  (t, e, n) => ct(String(e ?? ""), String(n ?? ""))
);
c.handle("senti:open-file", (t, e) => ut(e));
c.handle("senti:lock-workstation", () => bt());
c.handle("senti:power", (t, e) => St(e));
c.handle("senti:active-window", () => ve());
c.handle("senti:remote-input", (t, e) => I(e));
c.handle("senti:remote-input-stop", () => (ee(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? kt(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Pt({
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
let te = "setup", P = null, G = !1;
const M = 380, O = 132;
function ne(t) {
  if (!o || o.isDestroyed()) return;
  const { workArea: e } = he.getPrimaryDisplay();
  t ? o.setBounds({
    x: Math.round(e.x + (e.width - M) / 2),
    y: Math.round(e.y + (e.height - M) / 2 - e.height * 0.06),
    width: M,
    height: M
  }) : o.setBounds({
    x: Math.round(e.x + e.width - O - 18),
    y: Math.round(e.y + e.height - O - 18),
    width: O,
    height: O
  });
}
function Ie(t) {
  !o || o.isDestroyed() || (te = t, t === "hud" ? (o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!0), o.setAlwaysOnTop(!0, "screen-saver"), o.setIgnoreMouseEvents(!0, { forward: !0 }), ne(!1), o.showInactive()) : t === "setup" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!0), o.setSkipTaskbar(!1), o.setSize(980, 760), o.center(), o.show()) : t === "panel" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(760, 840), o.center(), o.show(), o.focus()) : (o.setIgnoreMouseEvents(!1), o.setFullScreen(!1), o.setAlwaysOnTop(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(680, 780), o.center(), o.show(), o.focus()));
}
function Ft() {
  !o || o.isDestroyed() || te !== "hud" || (ne(!0), o.showInactive(), o.setAlwaysOnTop(!0, "screen-saver"));
}
function Et() {
  !o || o.isDestroyed() || te !== "hud" || ne(!1);
}
function Tt() {
  const t = [
    d.join(process.resourcesPath || "", "build", "icon.png"),
    d.join(X, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (S(e)) {
        const n = re.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return re.createEmpty();
}
function K() {
  !o || o.isDestroyed() || (o.webContents.send("senti:open-settings"), Ie("panel"), o.show(), o.focus());
}
function At() {
  if (!P)
    try {
      P = new De(Tt()), P.setToolTip("Senti — listening for you"), P.setContextMenu(
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
      ), P.on("click", () => K());
    } catch {
    }
}
c.handle("senti:set-window-mode", (t, e) => e === "setup" || e === "hud" || e === "panel" ? (Ie(e), e === "hud" && At(), !0) : !1);
c.handle("senti:enter-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setAlwaysOnTop(!1), o.setFullScreen(!0), o.focus(), !0));
c.handle("senti:exit-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setFullScreen(!1), o.setAlwaysOnTop(!0, "screen-saver"), !0));
c.handle("senti:hud-show", () => (Ft(), !0));
c.handle("senti:hud-hide", () => (Et(), !0));
c.handle("senti:quit", () => (p.quit(), !0));
