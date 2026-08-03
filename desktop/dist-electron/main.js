import { existsSync as w, readFileSync as v, mkdirSync as P, writeFileSync as I, unlinkSync as he, readdirSync as G, statSync as X, rmdirSync as Fe } from "fs";
import { spawn as S, execFileSync as De, execFile as D } from "child_process";
import me from "http";
import g from "os";
import Te from "electron";
import u from "path";
import { fileURLToPath as Ae } from "url";
function Me(t, e) {
  const n = u.resolve(t), r = u.resolve(n, e || ""), s = n.endsWith(u.sep) ? n : n + u.sep;
  return r !== n && !r.startsWith(s) ? null : r;
}
const { app: p, BrowserWindow: ye, screen: Q, ipcMain: c, globalShortcut: ge, safeStorage: N, session: H, shell: $, Tray: _e, Menu: Oe, nativeImage: ie, powerSaveBlocker: ae, desktopCapturer: ee, clipboard: we } = Te, Re = Ae(import.meta.url), te = u.dirname(Re), j = process.env.VITE_DEV_SERVER_URL, be = "http://localhost:5173";
let o = null, J = "";
const Ne = {
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
}, je = 47615;
function Be(t) {
  for (const e of t)
    try {
      if (e && w(e)) return e;
    } catch {
    }
  return null;
}
function C() {
  if (process.platform !== "win32") return null;
  const t = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", e = u.join(t, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), n = u.join(t, "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe");
  return Be([e, n, "powershell.exe"]);
}
function Le(t) {
  return new Promise((e, n) => {
    const r = me.createServer((l, a) => {
      try {
        let d = decodeURIComponent((l.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const h = u.normalize(d).replace(/^([/\\])+/, ""), f = u.join(t, h);
        if (!f.startsWith(t) || !w(f)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const m = v(f);
        a.writeHead(200, {
          "Content-Type": Ne[u.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(m);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = je, i = 0;
    r.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => r.listen(s, "127.0.0.1"), 40)) : n(l);
    }), r.on("listening", () => e(`http://127.0.0.1:${s}`)), r.listen(s, "127.0.0.1");
  });
}
const x = () => u.join(p.getPath("userData"), "device.token");
function We(t) {
  try {
    return P(u.dirname(x()), { recursive: !0 }), N.isEncryptionAvailable() ? (I(x(), N.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function Se() {
  try {
    return !w(x()) || !N.isEncryptionAvailable() ? null : N.decryptString(v(x()));
  } catch {
    return null;
  }
}
function Ue() {
  try {
    w(x()) && he(x());
  } catch {
  }
}
const B = () => u.join(p.getPath("userData"), "setup.json");
function Ge() {
  var t;
  try {
    return w(B()) ? ((t = JSON.parse(v(B(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function ze(t) {
  try {
    P(u.dirname(B()), { recursive: !0 }), I(B(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const ke = 200, L = () => u.join(p.getPath("userData"), "memories.json");
function W() {
  try {
    if (!w(L())) return [];
    const t = JSON.parse(v(L(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function ne(t) {
  try {
    P(u.dirname(L()), { recursive: !0 }), I(L(), JSON.stringify(t.slice(-ke)));
  } catch {
  }
}
const He = 21, qe = 3, U = () => u.join(p.getPath("userData"), "activity.json");
function K() {
  try {
    if (!w(U())) return [];
    const t = JSON.parse(v(U(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function $e(t) {
  try {
    P(u.dirname(U()), { recursive: !0 }), I(U(), JSON.stringify(t));
  } catch {
  }
}
function Ve(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function Ze(t, e, n) {
  const r = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(n) || 0));
  if (!r || !i) return K();
  const l = /* @__PURE__ */ new Date(), a = l.toISOString().slice(0, 10), d = Ve(l), h = new Date(l.getTime() - He * 864e5).toISOString().slice(0, 10), f = K().filter((b) => b.day >= h);
  let m = f.find((b) => b.day === a && b.process === r && b.part === d);
  return m || (m = { day: a, process: r, part: d, minutes: 0, samples: [] }, f.push(m)), m.minutes = Math.round((m.minutes + i) * 10) / 10, s && !m.samples.includes(s) && m.samples.length < qe && m.samples.push(s), $e(f), f;
}
function Je(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return W();
  const n = W(), r = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === r)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-ke);
  return ne(s), s;
}
let T = null;
const Ke = 2e4;
function Ye() {
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
function Xe() {
  const t = C();
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
    D(
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
const le = {
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
function Qe(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? le[e] ? le[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let q = null, ce = 0;
const et = /* @__PURE__ */ new Set([
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
function V(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function tt() {
  const t = [];
  return process.env.ProgramData && t.push(u.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(u.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function nt() {
  const t = Date.now();
  if (q && t - ce < 5 * 6e4) return q;
  const e = [], n = t, r = (s, i) => {
    if (i > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = G(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const d = u.join(s, a.name);
      a.isDirectory() ? r(d, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: d });
    }
  };
  for (const s of tt()) r(s, 0);
  return q = e, ce = t, e;
}
function Z(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = V(e), r = e.split(/\s+/).map(V).filter((i) => i.length >= 2 && !et.has(i));
  if (!n && !r.length) return null;
  let s = null;
  for (const i of nt()) {
    const l = V(i.name);
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
async function rt(t) {
  const e = Qe(t);
  if (e)
    try {
      if (e.kind === "url")
        return $.openExternal(e.target), { ok: !0, label: e.label };
      if (await it(e.label, e.target))
        return { ok: !0, label: e.label, focused: !0 };
      const r = Z(e.label) || Z(e.target);
      return r ? ($.openPath(r.path), { ok: !0, label: e.label }) : (S("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label });
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = Z(t);
  if (n)
    try {
      return $.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
const ot = `
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
`, st = {
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
function it(t, e) {
  const n = C();
  if (!n) return Promise.resolve(!1);
  const r = (st[t] ?? [e.replace(/\.exe$/i, "")]).map((i) => i.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!r.length) return Promise.resolve(!1);
  const s = `$names = @(${r.map((i) => `'${i}'`).join(",")})
`;
  return new Promise((i) => {
    try {
      D(
        n,
        ["-NoProfile", "-NonInteractive", "-Command", s + ot],
        { timeout: 6e3, windowsHide: !0 },
        (l, a) => i(!l && String(a).trim() === "yes")
      );
    } catch {
      i(!1);
    }
  });
}
function at(t) {
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
function lt(t) {
  const e = at(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? S("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && $.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const ct = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, ut = 15 * 1024 * 1024;
function xe(t, e) {
  const n = ct[t];
  if (!n) return null;
  let r;
  try {
    r = p.getPath(n);
  } catch {
    return null;
  }
  const s = Me(r, e);
  return s ? { base: r, full: s } : null;
}
function dt(t, e) {
  const n = xe(t, e);
  if (!n) throw new Error("Not allowed");
  const s = G(n.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let l = 0, a = 0;
    try {
      const d = X(u.join(n.full, i.name));
      l = d.size, a = d.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: l, modified: a };
  }).sort((i, l) => i.dir === l.dir ? i.name.localeCompare(l.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: s });
}
function pt(t, e) {
  const n = xe(t, e);
  if (!n) throw new Error("Not allowed");
  const r = X(n.full);
  if (!r.isFile()) throw new Error("Not a file");
  if (r.size > ut) throw new Error("File is too large to send (15 MB limit)");
  const s = v(n.full);
  return JSON.stringify({
    name: u.basename(n.full),
    size: r.size,
    base64: s.toString("base64")
  });
}
const ue = 8e3, de = 40;
function ft(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return p.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), r = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, d) => {
    if (d > 4 || Date.now() - r > ue || i.length >= de) return;
    let h;
    try {
      h = G(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - r > ue || i.length >= de) return;
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
    const h = a.name.toLowerCase(), f = d.name.toLowerCase(), m = h === e || h.replace(/\.[^.]+$/, "") === e, b = f === e || f.replace(/\.[^.]+$/, "") === e;
    return m !== b ? m ? -1 : 1 : a.name.length - d.name.length;
  });
  try {
    return $.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const pe = 2e4;
function ve() {
  const t = [g.tmpdir(), u.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, r = 0;
  const s = (i, l) => {
    if (l > 6 || Date.now() - e > pe || !/temp/i.test(i)) return;
    let a;
    try {
      a = G(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of a) {
      if (Date.now() - e > pe) return;
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
          const f = X(h).size;
          he(h), n += f, r++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: r };
}
function ht() {
  const t = C();
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
    const r = (De(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
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
const mt = `
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
function Pe() {
  const t = C();
  return t ? new Promise((e) => {
    try {
      D(
        t,
        ["-NoProfile", "-NonInteractive", "-Command", mt],
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
const yt = `
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
function gt() {
  if (y && !y.killed) return !0;
  const t = C();
  if (!t)
    return console.error("[RemoteInput] PowerShell not found; remote control input disabled."), !1;
  try {
    const e = u.join(p.getPath("userData"), "input.ps1");
    return P(u.dirname(e), { recursive: !0 }), I(e, yt, "utf8"), y = S(
      t,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", e],
      { stdio: ["pipe", "ignore", "ignore"], windowsHide: !0 }
    ), y.on("error", (n) => {
      console.error("[RemoteInput] PowerShell injector failed:", n), y = null;
    }), y.on("exit", () => {
      y = null;
    }), !0;
  } catch {
    return y = null, !1;
  }
}
function re() {
  try {
    y == null || y.kill();
  } catch {
  }
  y = null;
}
const wt = {
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
function bt(t) {
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
      const e = String(t.k), n = wt[e] ?? (/^[a-zA-Z0-9]$/.test(e) ? e.toUpperCase().charCodeAt(0) : void 0);
      if (n === void 0) return null;
      const r = Array.isArray(t.mods) ? t.mods : [], s = (r.includes("shift") ? 1 : 0) | (r.includes("ctrl") ? 2 : 0) | (r.includes("alt") ? 4 : 0);
      return `K ${n} ${s}`;
    }
    default:
      return null;
  }
}
function F(t) {
  if (!Array.isArray(t) || !t.length || !gt() || !(y != null && y.stdin)) return !1;
  const e = t.map((n) => bt(n)).filter((n) => !!n);
  if (!e.length) return !0;
  try {
    return y.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return re(), !1;
  }
}
const St = 900;
function M(t) {
  return new Promise((e) => setTimeout(e, t));
}
async function fe(t) {
  const e = await Pe();
  if (!e) return !1;
  const n = e.process.toLowerCase();
  return n !== "explorer" && n !== "cabinetwclass" ? !1 : e.title.toLowerCase().includes(t.toLowerCase());
}
async function kt() {
  const t = g.tmpdir(), e = u.basename(t);
  try {
    $.openPath(t);
  } catch {
    return !1;
  }
  let n = !1;
  for (let r = 0; r < 14; r++)
    if (await M(400), await fe(e)) {
      n = !0;
      break;
    }
  if (!n || !F([{ t: "key", k: "a", mods: ["ctrl"] }]) || (await M(700), !await fe(e)) || !F([{ t: "key", k: "Delete", mods: ["shift"] }])) return !1;
  await M(St), F([{ t: "key", k: "Enter" }]);
  for (let r = 0; r < 3; r++)
    await M(1200), F([{ t: "key", k: "Enter" }]);
  return !0;
}
function $t() {
  try {
    return S("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function xt(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      D("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
    else if (e === "restart" || e === "reboot")
      S("shutdown", ["/r", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else if (e === "shutdown" || e === "shut down" || e === "off")
      S("shutdown", ["/s", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else
      return !1;
    return !0;
  } catch {
    return !1;
  }
}
function vt(t) {
  const e = C();
  if (!e) return !1;
  const s = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return D(e, ["-NoProfile", "-NonInteractive", "-Command", s], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const Pt = {
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
function It(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = Pt[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return S("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Ct() {
  if (T && Date.now() - T.at < Ke) return T.data;
  const t = Ye();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await Xe();
    } catch {
    }
  const n = { ...t, ...e };
  return T = { at: Date.now(), data: n }, n;
}
async function Et(t) {
  const { baseUrl: e, path: n, method: r = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = Se();
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
const Ft = "CommandOrControl+Shift+Space";
function Dt(t, e = 15e3) {
  return new Promise((n, r) => {
    const s = Date.now(), i = () => {
      me.get(t, (d) => {
        d.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? r(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function Ie() {
  const { width: t, height: e } = Q.getPrimaryDisplay().workAreaSize, n = u.join(te, "preload.cjs");
  o = new ye({
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
  }), o.setVisibleOnAllWorkspaces(!0), o.setMenuBarVisibility(!1), o.setAlwaysOnTop(!0, "screen-saver"), j ? o.loadURL(be).catch((r) => {
    console.error("[Electron] Failed to load dev server:", r.message);
  }) : J ? o.loadURL(J).catch((r) => {
    console.error("[Electron] Failed to load prod server:", r.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), o.webContents.on("did-finish-load", () => {
    var r, s;
    o == null || o.show(), o == null || o.focus(), j && ((s = (r = o == null ? void 0 : o.webContents) == null ? void 0 : r.openDevTools) == null || s.call(r));
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
    z || (r.preventDefault(), o == null || o.hide());
  });
}
p.requestSingleInstanceLock() ? p.on("second-instance", () => {
  o && !o.isDestroyed() && Y();
}) : p.quit();
p.whenReady().then(async () => {
  if (j)
    try {
      await Dt(be);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), p.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (H.defaultSession.setPermissionRequestHandler((e, n, r) => {
    r(t(n));
  }), H.defaultSession.setPermissionCheckHandler((e, n) => t(n)), H.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    ee.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((r) => {
      n(r[0] ? { video: r[0] } : {});
    });
  }), !j)
    try {
      J = await Le(u.join(te, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), p.quit();
      return;
    }
  Ie();
  try {
    ge.register(Ft, () => {
      o == null || o.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && p.isPackaged && p.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
p.on("activate", () => {
  ye.getAllWindows().length === 0 ? Ie() : (o == null || o.show(), o == null || o.focus());
});
p.on("window-all-closed", () => {
  z && process.platform !== "darwin" && p.quit();
});
p.on("before-quit", () => {
  z = !0;
});
p.on("before-quit", () => {
  o = null;
});
p.on("will-quit", () => {
  ge.unregisterAll(), re();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : We(e.trim()));
c.handle("senti:token-clear", () => (Ue(), !0));
c.handle("senti:token-present", () => !!Se());
c.on("senti:get-setup", (t) => {
  t.returnValue = Ge();
});
c.handle("senti:set-setup", (t, e) => (ze(!!e), !0));
c.handle("senti:system-info", () => Ct());
c.handle("senti:clipboard-read", () => {
  try {
    return we.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && we.writeText(e), !0;
  } catch {
    return !1;
  }
});
async function Ce(t = 1600) {
  var e;
  try {
    const n = Q.getPrimaryDisplay(), { width: r, height: s } = n.size, i = Math.min(1, t / r), a = (e = (await ee.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(r * i), height: Math.round(s * i) }
    }))[0]) == null ? void 0 : e.thumbnail;
    return !a || a.isEmpty() ? null : a.toDataURL();
  } catch {
    return null;
  }
}
async function Tt() {
  const t = await Ce(4096);
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
c.handle("senti:screenshot-save", () => Tt());
c.handle("senti:screenshot-grab", () => Ce(1600));
c.handle("senti:screen-sources", async () => {
  try {
    return (await ee.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => W());
c.handle("senti:memory-add", (t, e) => Je(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = W().filter((r) => r.id !== String(e));
  return ne(n), n;
});
c.handle("senti:memory-clear", () => (ne([]), []));
c.handle(
  "senti:activity-record",
  (t, e, n, r) => Ze(e, n, r)
);
c.handle("senti:activity-list", () => K());
c.handle("senti:activity-clear", () => ($e([]), []));
let k = null;
const _ = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const r = typeof n == "string" && n ? n : "default";
    return e ? _.add(r) : _.delete(r), _.size > 0 && k === null ? k = ae.start("prevent-display-sleep") : _.size === 0 && k !== null && (ae.stop(k), k = null), k !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => rt(e));
c.handle("senti:close-app", (t, e) => It(e));
c.handle("senti:clean-temp", () => ve());
c.handle("senti:clean-temp-visible", async () => {
  const t = await kt();
  return { ...ve(), shown: t };
});
c.handle("senti:empty-recycle-bin", () => ht());
c.handle("senti:open-folder", (t, e) => lt(e));
c.handle(
  "senti:serve-list",
  (t, e, n) => dt(String(e ?? ""), String(n ?? ""))
);
c.handle(
  "senti:serve-read",
  (t, e, n) => pt(String(e ?? ""), String(n ?? ""))
);
c.handle("senti:open-file", (t, e) => ft(e));
c.handle("senti:lock-workstation", () => $t());
c.handle("senti:power", (t, e) => xt(e));
c.handle("senti:active-window", () => Pe());
c.handle("senti:remote-input", (t, e) => F(e));
c.handle("senti:remote-input-stop", () => (re(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? vt(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Et({
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
let oe = "setup", E = null, z = !1;
const O = 380, R = 132;
function se(t) {
  if (!o || o.isDestroyed()) return;
  const { workArea: e } = Q.getPrimaryDisplay();
  t ? o.setBounds({
    x: Math.round(e.x + (e.width - O) / 2),
    y: Math.round(e.y + (e.height - O) / 2 - e.height * 0.06),
    width: O,
    height: O
  }) : o.setBounds({
    x: Math.round(e.x + e.width - R - 18),
    y: Math.round(e.y + e.height - R - 18),
    width: R,
    height: R
  });
}
function Ee(t) {
  !o || o.isDestroyed() || (oe = t, t === "hud" ? (o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!0), o.setAlwaysOnTop(!0, "screen-saver"), o.setIgnoreMouseEvents(!0, { forward: !0 }), se(!1), o.showInactive()) : t === "setup" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!0), o.setSkipTaskbar(!1), o.setSize(980, 760), o.center(), o.show()) : t === "panel" ? (o.setIgnoreMouseEvents(!1), o.setAlwaysOnTop(!1), o.setFullScreen(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(760, 840), o.center(), o.show(), o.focus()) : (o.setIgnoreMouseEvents(!1), o.setFullScreen(!1), o.setAlwaysOnTop(!1), o.setResizable(!1), o.setSkipTaskbar(!1), o.setSize(680, 780), o.center(), o.show(), o.focus()));
}
function At() {
  !o || o.isDestroyed() || oe !== "hud" || (se(!0), o.showInactive(), o.setAlwaysOnTop(!0, "screen-saver"));
}
function Mt() {
  !o || o.isDestroyed() || oe !== "hud" || se(!1);
}
function _t() {
  const t = [
    u.join(process.resourcesPath || "", "build", "icon.png"),
    u.join(te, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (w(e)) {
        const n = ie.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return ie.createEmpty();
}
function Y() {
  !o || o.isDestroyed() || (o.webContents.send("senti:open-settings"), Ee("panel"), o.show(), o.focus());
}
function Ot() {
  if (!E)
    try {
      E = new _e(_t()), E.setToolTip("Senti — listening for you"), E.setContextMenu(
        Oe.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => Y() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              z = !0, p.quit();
            }
          }
        ])
      ), E.on("click", () => Y());
    } catch {
    }
}
c.handle("senti:set-window-mode", (t, e) => e === "setup" || e === "hud" || e === "panel" ? (Ee(e), e === "hud" && Ot(), !0) : !1);
c.handle("senti:enter-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setAlwaysOnTop(!1), o.setFullScreen(!0), o.focus(), !0));
c.handle("senti:exit-fullscreen", () => !o || o.isDestroyed() ? !1 : (o.setFullScreen(!1), o.setAlwaysOnTop(!0, "screen-saver"), !0));
c.handle("senti:hud-show", () => (At(), !0));
c.handle("senti:hud-hide", () => (Mt(), !0));
c.handle("senti:quit", () => (p.quit(), !0));
