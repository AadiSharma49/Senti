import { existsSync as S, readFileSync as I, mkdirSync as T, writeFileSync as A, unlinkSync as ue, readdirSync as Y, rmdirSync as ke, statSync as $e } from "fs";
import { spawn as w, execFileSync as xe, execFile as G } from "child_process";
import de from "http";
import g from "os";
import ve from "electron";
import p from "path";
import { fileURLToPath as Ce } from "url";
const { app: d, BrowserWindow: pe, screen: fe, ipcMain: c, globalShortcut: C, safeStorage: O, session: V, shell: P, Tray: Pe, Menu: Ie, nativeImage: re, powerSaveBlocker: oe, desktopCapturer: he, clipboard: me } = ve, Te = Ce(import.meta.url), X = p.dirname(Te), R = process.env.VITE_DEV_SERVER_URL, ye = "http://localhost:5173";
let r = null, K = "";
const Ae = {
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
}, Ee = 47615;
function De(t) {
  return new Promise((e, n) => {
    const o = de.createServer((l, i) => {
      try {
        let u = decodeURIComponent((l.url || "/").split("?")[0]);
        (u === "/" || u === "") && (u = "/index.html");
        const h = p.normalize(u).replace(/^([/\\])+/, ""), f = p.join(t, h);
        if (!f.startsWith(t) || !S(f)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const m = I(f);
        i.writeHead(200, {
          "Content-Type": Ae[p.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(m);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let s = Ee, a = 0;
    o.on("error", (l) => {
      l.code === "EADDRINUSE" && a < 12 ? (a++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(l);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const x = () => p.join(d.getPath("userData"), "device.token");
function _e(t) {
  try {
    return T(p.dirname(x()), { recursive: !0 }), O.isEncryptionAvailable() ? (A(x(), O.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function ge() {
  try {
    return !S(x()) || !O.isEncryptionAvailable() ? null : O.decryptString(I(x()));
  } catch {
    return null;
  }
}
function Fe() {
  try {
    S(x()) && ue(x());
  } catch {
  }
}
const B = () => p.join(d.getPath("userData"), "setup.json");
function Me() {
  var t;
  try {
    return S(B()) ? ((t = JSON.parse(I(B(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function Oe(t) {
  try {
    T(p.dirname(B()), { recursive: !0 }), A(B(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const be = 200, L = () => p.join(d.getPath("userData"), "memories.json");
function j() {
  try {
    if (!S(L())) return [];
    const t = JSON.parse(I(L(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function Q(t) {
  try {
    T(p.dirname(L()), { recursive: !0 }), A(L(), JSON.stringify(t.slice(-be)));
  } catch {
  }
}
const Re = 21, Be = 3, N = () => p.join(d.getPath("userData"), "activity.json");
function J() {
  try {
    if (!S(N())) return [];
    const t = JSON.parse(I(N(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function we(t) {
  try {
    T(p.dirname(N()), { recursive: !0 }), A(N(), JSON.stringify(t));
  } catch {
  }
}
function Le(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function je(t, e, n) {
  const o = String(t ?? "").slice(0, 60).toLowerCase(), s = String(e ?? "").slice(0, 120), a = Math.max(0, Math.min(120, Number(n) || 0));
  if (!o || !a) return J();
  const l = /* @__PURE__ */ new Date(), i = l.toISOString().slice(0, 10), u = Le(l), h = new Date(l.getTime() - Re * 864e5).toISOString().slice(0, 10), f = J().filter((b) => b.day >= h);
  let m = f.find((b) => b.day === i && b.process === o && b.part === u);
  return m || (m = { day: i, process: o, part: u, minutes: 0, samples: [] }, f.push(m)), m.minutes = Math.round((m.minutes + a) * 10) / 10, s && !m.samples.includes(s) && m.samples.length < Be && m.samples.push(s), we(f), f;
}
function Ne(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return j();
  const n = j(), o = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((a) => a.text.toLowerCase().replace(/\s+/g, " ") === o)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-be);
  return Q(s), s;
}
let E = null;
const Ue = 2e4;
function Ge() {
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
function He() {
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
    G(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", t],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (n, o) => {
        if (n || !o) return e({});
        try {
          const s = JSON.parse(o), a = (s.disks || []).map((l) => ({
            drive: l.drive,
            totalGB: l.totalGB,
            freeGB: l.freeGB,
            usedPct: l.totalGB ? Math.round((l.totalGB - l.freeGB) / l.totalGB * 100) : 0
          }));
          e({
            disks: a,
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
function qe(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? se[e] ? se[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let W = null, ie = 0;
const Ve = /* @__PURE__ */ new Set([
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
function z(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function We() {
  const t = [];
  return process.env.ProgramData && t.push(p.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(p.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function ze() {
  const t = Date.now();
  if (W && t - ie < 5 * 6e4) return W;
  const e = [], n = t, o = (s, a) => {
    if (a > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = Y(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const i of l) {
      const u = p.join(s, i.name);
      i.isDirectory() ? o(u, a + 1) : i.isFile() && i.name.toLowerCase().endsWith(".lnk") && e.push({ name: i.name.slice(0, -4), path: u });
    }
  };
  for (const s of We()) o(s, 0);
  return W = e, ie = t, e;
}
function Ke(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = z(e), o = e.split(/\s+/).map(z).filter((a) => a.length >= 2 && !Ve.has(a));
  if (!n && !o.length) return null;
  let s = null;
  for (const a of ze()) {
    const l = z(a.name);
    let i = 0;
    if (l === n) i = 100;
    else if (n.length >= 3 && l.includes(n)) i = 60 - Math.min(25, l.length - n.length);
    else {
      let u = 0;
      for (const h of o) h.length >= 3 && l.includes(h) && u++;
      u && (i = 20 + u * 12 - Math.min(15, Math.floor(l.length / 6)));
    }
    i > 0 && (!s || i > s.score) && (s = { app: a, score: i });
  }
  return s && s.score >= 20 ? s.app : null;
}
function Je(t) {
  const e = qe(t);
  if (e)
    try {
      return e.kind === "url" ? P.openExternal(e.target) : w("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = Ke(t);
  if (n)
    try {
      return P.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
function Ze(t) {
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
      return { path: d.getPath(s.key), label: s.label };
    } catch {
      return null;
    }
  return null;
}
function Ye(t) {
  const e = Ze(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? w("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && P.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const ae = 8e3, le = 40;
function Xe(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((i) => {
    try {
      return d.getPath(i);
    } catch {
      return null;
    }
  }).filter((i) => !!i), o = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, a = [], l = (i, u) => {
    if (u > 4 || Date.now() - o > ae || a.length >= le) return;
    let h;
    try {
      h = Y(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - o > ae || a.length >= le) return;
      if (f.name.startsWith(".") || s.test(f.name)) continue;
      const m = p.join(i, f.name);
      try {
        if (f.isSymbolicLink()) continue;
        f.isDirectory() ? l(m, u + 1) : f.isFile() && f.name.toLowerCase().includes(e) && a.push({ name: f.name, path: m });
      } catch {
      }
    }
  };
  for (const i of n) l(i, 0);
  if (a.length === 0) return { ok: !1, error: "not-found", count: 0 };
  a.sort((i, u) => {
    const h = i.name.toLowerCase(), f = u.name.toLowerCase(), m = h === e || h.replace(/\.[^.]+$/, "") === e, b = f === e || f.replace(/\.[^.]+$/, "") === e;
    return m !== b ? m ? -1 : 1 : i.name.length - u.name.length;
  });
  try {
    return P.openPath(a[0].path), { ok: !0, label: a[0].name, count: a.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const ce = 2e4;
function Qe() {
  const t = [g.tmpdir(), p.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (a, l) => {
    if (l > 6 || Date.now() - e > ce || !/temp/i.test(a)) return;
    let i;
    try {
      i = Y(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const u of i) {
      if (Date.now() - e > ce) return;
      const h = p.join(a, u.name);
      try {
        if (u.isSymbolicLink()) continue;
        if (u.isDirectory()) {
          s(h, l + 1);
          try {
            ke(h);
          } catch {
          }
        } else if (u.isFile()) {
          const f = $e(h).size;
          ue(h), n += f, o++;
        }
      } catch {
      }
    }
  };
  for (const a of t) s(a, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function et() {
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
    const n = (xe("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [o, s] = n.split(/\s+/).map((a) => parseInt(a, 10));
    return {
      files: Number.isFinite(o) ? o : 0,
      freedMB: Number.isFinite(s) ? Math.round(s / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
const tt = `
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
function nt() {
  return new Promise((t) => {
    try {
      G(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", tt],
        { timeout: 5e3, windowsHide: !0 },
        (e, n) => {
          if (e || !n) return t(null);
          try {
            const o = JSON.parse(n.trim()), s = String(o.title || "").slice(0, 200), a = String(o.process || "").slice(0, 60);
            t(s || a ? { title: s, process: a } : null);
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
const rt = `
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
function ot() {
  if (y && !y.killed) return !0;
  try {
    const t = p.join(d.getPath("userData"), "input.ps1");
    return T(p.dirname(t), { recursive: !0 }), A(t, rt, "utf8"), y = w(
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
const st = {
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
}, D = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function it(t) {
  switch (t.t) {
    case "move":
      return `M ${D(t.x).toFixed(5)} ${D(t.y).toFixed(5)}`;
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      return typeof t.x != "number" || t.x < 0 ? `C ${e} -1 -1 ${n}` : `C ${e} ${D(t.x).toFixed(5)} ${D(t.y).toFixed(5)} ${n}`;
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
      const e = st[String(t.k)];
      if (e === void 0) return null;
      const n = Array.isArray(t.mods) ? t.mods : [], o = (n.includes("shift") ? 1 : 0) | (n.includes("ctrl") ? 2 : 0) | (n.includes("alt") ? 4 : 0);
      return `K ${e} ${o}`;
    }
    default:
      return null;
  }
}
function at(t) {
  if (!Array.isArray(t) || !t.length || !ot() || !(y != null && y.stdin)) return !1;
  const e = t.map((n) => it(n)).filter((n) => !!n);
  if (!e.length) return !0;
  try {
    return y.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return ee(), !1;
  }
}
function lt() {
  try {
    return w("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function ct(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      G("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
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
function ut(t) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return G("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const dt = {
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
function pt(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = dt[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return w("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function ft() {
  if (E && Date.now() - E.at < Ue) return E.data;
  const t = Ge();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await He();
    } catch {
    }
  const n = { ...t, ...e };
  return E = { at: Date.now(), data: n }, n;
}
async function ht(t) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: a = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (a) {
    const i = ge();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${e}${n}`, {
      method: o,
      headers: l,
      body: s === void 0 ? void 0 : JSON.stringify(s)
    }), u = await i.json().catch(() => null);
    return { ok: i.ok, status: i.status, data: u };
  } catch (i) {
    return {
      ok: !1,
      status: 0,
      data: { error: i instanceof Error ? i.message : "Network error" }
    };
  }
}
let U = !0;
const mt = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], yt = "CommandOrControl+Alt+Shift+Q", gt = "CommandOrControl+Shift+Space";
function bt() {
  for (const t of mt)
    try {
      C.isRegistered(t) && C.unregister(t);
    } catch {
    }
}
function $(t) {
  U = t, bt();
}
function wt(t, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), a = () => {
      de.get(t, (u) => {
        u.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(a, 300);
    };
    a();
  });
}
function Se() {
  const { width: t, height: e } = fe.getPrimaryDisplay().workAreaSize, n = p.join(X, "preload.cjs");
  r = new pe({
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
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), R ? r.loadURL(ye).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : K ? r.loadURL(K).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var o, s;
    r == null || r.show(), r == null || r.focus(), R && ((s = (o = r == null ? void 0 : r.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
  }), r.webContents.on("did-fail-load", (o, s, a, l, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: a, validatedURL: l, isMainFrame: i });
  }), r.webContents.on("console-message", (o, s, a) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${l}] ${a}`);
  }), r.webContents.on("render-process-gone", (o, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), r.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), r.on("close", (o) => {
    H || (o.preventDefault(), r == null || r.hide());
  });
}
d.requestSingleInstanceLock() ? d.on("second-instance", () => {
  r && !r.isDestroyed() && Z();
}) : d.quit();
d.whenReady().then(async () => {
  if (R)
    try {
      await wt(ye);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), d.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (V.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(t(n));
  }), V.defaultSession.setPermissionCheckHandler((e, n) => t(n)), V.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    he.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((o) => {
      n(o[0] ? { video: o[0] } : {});
    });
  }), !R)
    try {
      K = await De(p.join(X, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), d.quit();
      return;
    }
  Se(), $(!0);
  try {
    C.register(yt, () => {
      U = !1, d.exit(0);
    });
  } catch {
  }
  try {
    C.register(gt, () => {
      U || r == null || r.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && d.isPackaged && d.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
d.on("activate", () => {
  pe.getAllWindows().length === 0 ? Se() : (r == null || r.show(), r == null || r.focus());
});
d.on("window-all-closed", () => {
  H && process.platform !== "darwin" && d.quit();
});
d.on("before-quit", () => {
  H = !0;
});
d.on("before-quit", () => {
  r = null;
});
d.on("will-quit", () => {
  C.unregisterAll(), ee();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : _e(e.trim()));
c.handle("senti:token-clear", () => (Fe(), !0));
c.handle("senti:token-present", () => !!ge());
c.on("senti:get-setup", (t) => {
  t.returnValue = Me();
});
c.handle("senti:set-setup", (t, e) => (Oe(!!e), !0));
c.handle("senti:system-info", () => ft());
c.handle("senti:clipboard-read", () => {
  try {
    return me.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && me.writeText(e), !0;
  } catch {
    return !1;
  }
});
c.handle("senti:screen-sources", async () => {
  try {
    return (await he.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => j());
c.handle("senti:memory-add", (t, e) => Ne(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = j().filter((o) => o.id !== String(e));
  return Q(n), n;
});
c.handle("senti:memory-clear", () => (Q([]), []));
c.handle(
  "senti:activity-record",
  (t, e, n, o) => je(e, n, o)
);
c.handle("senti:activity-list", () => J());
c.handle("senti:activity-clear", () => (we([]), []));
let k = null;
const _ = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const o = typeof n == "string" && n ? n : "default";
    return e ? _.add(o) : _.delete(o), _.size > 0 && k === null ? k = oe.start("prevent-display-sleep") : _.size === 0 && k !== null && (oe.stop(k), k = null), k !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => Je(e));
c.handle("senti:close-app", (t, e) => pt(e));
c.handle("senti:clean-temp", () => Qe());
c.handle("senti:empty-recycle-bin", () => et());
c.handle("senti:open-folder", (t, e) => Ye(e));
c.handle("senti:open-file", (t, e) => Xe(e));
c.handle("senti:web-search", (t, e) => {
  const n = String(e ?? "").trim().slice(0, 200);
  return n ? (P.openExternal(`https://www.google.com/search?q=${encodeURIComponent(n)}`), { ok: !0 }) : { ok: !1 };
});
c.handle("senti:lock-workstation", () => lt());
c.handle("senti:power", (t, e) => ct(e));
c.handle("senti:active-window", () => nt());
c.handle("senti:remote-input", (t, e) => at(e));
c.handle("senti:remote-input-stop", () => (ee(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? ut(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : ht({
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
let te = "signin", v = null, H = !1;
const F = 380, M = 132;
function ne(t) {
  if (!r || r.isDestroyed()) return;
  const { workArea: e } = fe.getPrimaryDisplay();
  t ? r.setBounds({
    x: Math.round(e.x + (e.width - F) / 2),
    y: Math.round(e.y + (e.height - F) / 2 - e.height * 0.06),
    width: F,
    height: F
  }) : r.setBounds({
    x: Math.round(e.x + e.width - M - 18),
    y: Math.round(e.y + e.height - M - 18),
    width: M,
    height: M
  });
}
function q(t) {
  !r || r.isDestroyed() || (te = t, t === "hud" ? ($(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), r.setIgnoreMouseEvents(!0, { forward: !0 }), ne(!1), r.showInactive()) : t === "setup" ? ($(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : t === "panel" ? ($(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(760, 840), r.center(), r.show(), r.focus()) : ($(!0), r.setIgnoreMouseEvents(!1), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()));
}
function St() {
  !r || r.isDestroyed() || te !== "hud" || (ne(!0), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function kt() {
  !r || r.isDestroyed() || te !== "hud" || ne(!1);
}
function $t() {
  const t = [
    p.join(process.resourcesPath || "", "build", "icon.png"),
    p.join(X, "..", "build", "icon.png")
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
function Z() {
  !r || r.isDestroyed() || (r.webContents.send("senti:open-settings"), q("panel"), r.show(), r.focus());
}
function xt() {
  if (!v)
    try {
      v = new Pe($t()), v.setToolTip("Senti — listening for you"), v.setContextMenu(
        Ie.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => Z() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              H = !0, d.quit();
            }
          }
        ])
      ), v.on("click", () => Z());
    } catch {
    }
}
function vt(t) {
  q(t ? "setup" : "signin");
}
c.handle("senti:set-setup-mode", (t, e) => (vt(!!e), !0));
c.handle("senti:set-window-mode", (t, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (q(e), e === "hud" && xt(), !0) : !1);
c.handle("senti:hud-show", () => (St(), !0));
c.handle("senti:hud-hide", () => (kt(), !0));
c.handle("senti:lock", () => {
  q("signin");
});
c.handle("senti:quit", () => U ? !1 : (d.quit(), !0));
