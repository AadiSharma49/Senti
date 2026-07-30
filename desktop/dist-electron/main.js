import { existsSync as $, readFileSync as O, mkdirSync as L, writeFileSync as j, unlinkSync as ae, readdirSync as K, rmdirSync as be, statSync as we } from "fs";
import { spawn as b, execFileSync as Se, execFile as N } from "child_process";
import le from "http";
import y from "os";
import ke from "electron";
import p from "path";
import { fileURLToPath as $e } from "url";
const { app: d, BrowserWindow: ce, screen: ue, ipcMain: c, globalShortcut: v, safeStorage: F, session: q, shell: C, Tray: xe, Menu: ve, nativeImage: ee, powerSaveBlocker: te, desktopCapturer: de, clipboard: pe } = ke, Ce = $e(import.meta.url), Z = p.dirname(Ce), D = process.env.VITE_DEV_SERVER_URL, fe = "http://localhost:5173";
let r = null, W = "";
const Pe = {
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
}, Ie = 47615;
function Te(t) {
  return new Promise((e, n) => {
    const o = le.createServer((l, i) => {
      try {
        let u = decodeURIComponent((l.url || "/").split("?")[0]);
        (u === "/" || u === "") && (u = "/index.html");
        const h = p.normalize(u).replace(/^([/\\])+/, ""), f = p.join(t, h);
        if (!f.startsWith(t) || !$(f)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const g = O(f);
        i.writeHead(200, {
          "Content-Type": Pe[p.extname(f).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(g);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    let s = Ie, a = 0;
    o.on("error", (l) => {
      l.code === "EADDRINUSE" && a < 12 ? (a++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(l);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const k = () => p.join(d.getPath("userData"), "device.token");
function Ee(t) {
  try {
    return L(p.dirname(k()), { recursive: !0 }), F.isEncryptionAvailable() ? (j(k(), F.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function he() {
  try {
    return !$(k()) || !F.isEncryptionAvailable() ? null : F.decryptString(O(k()));
  } catch {
    return null;
  }
}
function Ae() {
  try {
    $(k()) && ae(k());
  } catch {
  }
}
const _ = () => p.join(d.getPath("userData"), "setup.json");
function Fe() {
  var t;
  try {
    return $(_()) ? ((t = JSON.parse(O(_(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function De(t) {
  try {
    L(p.dirname(_()), { recursive: !0 }), j(_(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const me = 200, M = () => p.join(d.getPath("userData"), "memories.json");
function R() {
  try {
    if (!$(M())) return [];
    const t = JSON.parse(O(M(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function J(t) {
  try {
    L(p.dirname(M()), { recursive: !0 }), j(M(), JSON.stringify(t.slice(-me)));
  } catch {
  }
}
function _e(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return R();
  const n = R(), o = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((a) => a.text.toLowerCase().replace(/\s+/g, " ") === o)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-me);
  return J(s), s;
}
let P = null;
const Me = 2e4;
function Re() {
  var o, s;
  const t = y.totalmem() / 1073741824, e = y.freemem() / 1024 ** 3, n = t - e;
  return {
    os: `${y.type()} ${y.release()}`,
    cpu: ((s = (o = y.cpus()[0]) == null ? void 0 : o.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: y.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / t * 100),
    uptimeHours: +(y.uptime() / 3600).toFixed(1)
  };
}
function Be() {
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
    N(
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
const ne = {
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
function Oe(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? ne[e] ? ne[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let H = null, re = 0;
const Le = /* @__PURE__ */ new Set([
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
function je() {
  const t = [];
  return process.env.ProgramData && t.push(p.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(p.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function Ne() {
  const t = Date.now();
  if (H && t - re < 5 * 6e4) return H;
  const e = [], n = t, o = (s, a) => {
    if (a > 4 || Date.now() - n > 4e3) return;
    let l;
    try {
      l = K(s, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const i of l) {
      const u = p.join(s, i.name);
      i.isDirectory() ? o(u, a + 1) : i.isFile() && i.name.toLowerCase().endsWith(".lnk") && e.push({ name: i.name.slice(0, -4), path: u });
    }
  };
  for (const s of je()) o(s, 0);
  return H = e, re = t, e;
}
function Ue(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), n = V(e), o = e.split(/\s+/).map(V).filter((a) => a.length >= 2 && !Le.has(a));
  if (!n && !o.length) return null;
  let s = null;
  for (const a of Ne()) {
    const l = V(a.name);
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
function Ge(t) {
  const e = Oe(t);
  if (e)
    try {
      return e.kind === "url" ? C.openExternal(e.target) : b("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const n = Ue(t);
  if (n)
    try {
      return C.openPath(n.path), { ok: !0, label: n.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
function qe(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|show|go to|reveal)\s+/, "").replace(/^(my|the)\s+/, "").replace(/\s+(folder|directory)$/, "").trim(), n = {
    temp: { shell: y.tmpdir(), label: "your Temp folder" },
    "temp files": { shell: y.tmpdir(), label: "your Temp folder" },
    "temporary files": { shell: y.tmpdir(), label: "your Temp folder" },
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
function He(t) {
  const e = qe(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? b("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && C.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const oe = 8e3, se = 40;
function Ve(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((i) => {
    try {
      return d.getPath(i);
    } catch {
      return null;
    }
  }).filter((i) => !!i), o = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, a = [], l = (i, u) => {
    if (u > 4 || Date.now() - o > oe || a.length >= se) return;
    let h;
    try {
      h = K(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const f of h) {
      if (Date.now() - o > oe || a.length >= se) return;
      if (f.name.startsWith(".") || s.test(f.name)) continue;
      const g = p.join(i, f.name);
      try {
        if (f.isSymbolicLink()) continue;
        f.isDirectory() ? l(g, u + 1) : f.isFile() && f.name.toLowerCase().includes(e) && a.push({ name: f.name, path: g });
      } catch {
      }
    }
  };
  for (const i of n) l(i, 0);
  if (a.length === 0) return { ok: !1, error: "not-found", count: 0 };
  a.sort((i, u) => {
    const h = i.name.toLowerCase(), f = u.name.toLowerCase(), g = h === e || h.replace(/\.[^.]+$/, "") === e, ge = f === e || f.replace(/\.[^.]+$/, "") === e;
    return g !== ge ? g ? -1 : 1 : i.name.length - u.name.length;
  });
  try {
    return C.openPath(a[0].path), { ok: !0, label: a[0].name, count: a.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const ie = 2e4;
function We() {
  const t = [y.tmpdir(), p.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (a, l) => {
    if (l > 6 || Date.now() - e > ie || !/temp/i.test(a)) return;
    let i;
    try {
      i = K(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const u of i) {
      if (Date.now() - e > ie) return;
      const h = p.join(a, u.name);
      try {
        if (u.isSymbolicLink()) continue;
        if (u.isDirectory()) {
          s(h, l + 1);
          try {
            be(h);
          } catch {
          }
        } else if (u.isFile()) {
          const f = we(h).size;
          ae(h), n += f, o++;
        }
      } catch {
      }
    }
  };
  for (const a of t) s(a, 0);
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
    const n = (Se("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
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
const Ke = `
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
function Ze() {
  return new Promise((t) => {
    try {
      N(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", Ke],
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
const Je = `
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
let m = null;
function Ye() {
  if (m && !m.killed) return !0;
  try {
    const t = p.join(d.getPath("userData"), "input.ps1");
    return L(p.dirname(t), { recursive: !0 }), j(t, Je, "utf8"), m = b(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", t],
      { stdio: ["pipe", "ignore", "ignore"], windowsHide: !0 }
    ), m.on("exit", () => {
      m = null;
    }), !0;
  } catch {
    return m = null, !1;
  }
}
function Y() {
  try {
    m == null || m.kill();
  } catch {
  }
  m = null;
}
const Xe = {
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
}, I = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function Qe(t) {
  switch (t.t) {
    case "move":
      return `M ${I(t.x).toFixed(5)} ${I(t.y).toFixed(5)}`;
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), n = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !n ? null : `R ${e} ${n}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", n = t.d === 2 ? "2" : "1";
      return typeof t.x != "number" || t.x < 0 ? `C ${e} -1 -1 ${n}` : `C ${e} ${I(t.x).toFixed(5)} ${I(t.y).toFixed(5)} ${n}`;
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
      const e = Xe[String(t.k)];
      if (e === void 0) return null;
      const n = Array.isArray(t.mods) ? t.mods : [], o = (n.includes("shift") ? 1 : 0) | (n.includes("ctrl") ? 2 : 0) | (n.includes("alt") ? 4 : 0);
      return `K ${e} ${o}`;
    }
    default:
      return null;
  }
}
function et(t) {
  if (!Array.isArray(t) || !t.length || !Ye() || !(m != null && m.stdin)) return !1;
  const e = t.map((n) => Qe(n)).filter((n) => !!n);
  if (!e.length) return !0;
  try {
    return m.stdin.write(e.join(`
`) + `
`), !0;
  } catch {
    return Y(), !1;
  }
}
function tt() {
  try {
    return b("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function nt(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      N("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
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
function rt(t) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return N("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const ot = {
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
function st(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = ot[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return b("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function it() {
  if (P && Date.now() - P.at < Me) return P.data;
  const t = Re();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await Be();
    } catch {
    }
  const n = { ...t, ...e };
  return P = { at: Date.now(), data: n }, n;
}
async function at(t) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: a = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (a) {
    const i = he();
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
let B = !0;
const lt = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], ct = "CommandOrControl+Alt+Shift+Q", ut = "CommandOrControl+Shift+Space";
function dt() {
  for (const t of lt)
    try {
      v.isRegistered(t) && v.unregister(t);
    } catch {
    }
}
function S(t) {
  B = t, dt();
}
function pt(t, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), a = () => {
      le.get(t, (u) => {
        u.statusCode === 200 ? n() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(a, 300);
    };
    a();
  });
}
function ye() {
  const { width: t, height: e } = ue.getPrimaryDisplay().workAreaSize, n = p.join(Z, "preload.cjs");
  r = new ce({
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
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), D ? r.loadURL(fe).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : W ? r.loadURL(W).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var o, s;
    r == null || r.show(), r == null || r.focus(), D && ((s = (o = r == null ? void 0 : r.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
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
    U || (o.preventDefault(), r == null || r.hide());
  });
}
d.requestSingleInstanceLock() ? d.on("second-instance", () => {
  r && !r.isDestroyed() && z();
}) : d.quit();
d.whenReady().then(async () => {
  if (D)
    try {
      await pt(fe);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), d.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (q.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(t(n));
  }), q.defaultSession.setPermissionCheckHandler((e, n) => t(n)), q.defaultSession.setDisplayMediaRequestHandler((e, n) => {
    de.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((o) => {
      n(o[0] ? { video: o[0] } : {});
    });
  }), !D)
    try {
      W = await Te(p.join(Z, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), d.quit();
      return;
    }
  ye(), S(!0);
  try {
    v.register(ct, () => {
      B = !1, d.exit(0);
    });
  } catch {
  }
  try {
    v.register(ut, () => {
      B || r == null || r.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && d.isPackaged && d.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
d.on("activate", () => {
  ce.getAllWindows().length === 0 ? ye() : (r == null || r.show(), r == null || r.focus());
});
d.on("window-all-closed", () => {
  U && process.platform !== "darwin" && d.quit();
});
d.on("before-quit", () => {
  U = !0;
});
d.on("before-quit", () => {
  r = null;
});
d.on("will-quit", () => {
  v.unregisterAll(), Y();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : Ee(e.trim()));
c.handle("senti:token-clear", () => (Ae(), !0));
c.handle("senti:token-present", () => !!he());
c.on("senti:get-setup", (t) => {
  t.returnValue = Fe();
});
c.handle("senti:set-setup", (t, e) => (De(!!e), !0));
c.handle("senti:system-info", () => it());
c.handle("senti:clipboard-read", () => {
  try {
    return pe.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && pe.writeText(e), !0;
  } catch {
    return !1;
  }
});
c.handle("senti:screen-sources", async () => {
  try {
    return (await de.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
c.handle("senti:memory-list", () => R());
c.handle("senti:memory-add", (t, e) => _e(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const n = R().filter((o) => o.id !== String(e));
  return J(n), n;
});
c.handle("senti:memory-clear", () => (J([]), []));
let w = null;
const T = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, n) => {
  try {
    const o = typeof n == "string" && n ? n : "default";
    return e ? T.add(o) : T.delete(o), T.size > 0 && w === null ? w = te.start("prevent-display-sleep") : T.size === 0 && w !== null && (te.stop(w), w = null), w !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => Ge(e));
c.handle("senti:close-app", (t, e) => st(e));
c.handle("senti:clean-temp", () => We());
c.handle("senti:empty-recycle-bin", () => ze());
c.handle("senti:open-folder", (t, e) => He(e));
c.handle("senti:open-file", (t, e) => Ve(e));
c.handle("senti:web-search", (t, e) => {
  const n = String(e ?? "").trim().slice(0, 200);
  return n ? (C.openExternal(`https://www.google.com/search?q=${encodeURIComponent(n)}`), { ok: !0 }) : { ok: !1 };
});
c.handle("senti:lock-workstation", () => tt());
c.handle("senti:power", (t, e) => nt(e));
c.handle("senti:active-window", () => Ze());
c.handle("senti:remote-input", (t, e) => et(e));
c.handle("senti:remote-input-stop", () => (Y(), !0));
c.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? rt(n) : !1;
});
c.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : at({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: y.hostname(),
  platform: process.platform
}));
c.handle("senti:set-lock-state", (t, e) => {
  S(!!e);
});
let X = "signin", x = null, U = !1;
const E = 380, A = 132;
function Q(t) {
  if (!r || r.isDestroyed()) return;
  const { workArea: e } = ue.getPrimaryDisplay();
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
function G(t) {
  !r || r.isDestroyed() || (X = t, t === "hud" ? (S(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), r.setIgnoreMouseEvents(!0, { forward: !0 }), Q(!1), r.showInactive()) : t === "setup" ? (S(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : t === "panel" ? (S(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(760, 840), r.center(), r.show(), r.focus()) : (S(!0), r.setIgnoreMouseEvents(!1), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()));
}
function ft() {
  !r || r.isDestroyed() || X !== "hud" || (Q(!0), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function ht() {
  !r || r.isDestroyed() || X !== "hud" || Q(!1);
}
function mt() {
  const t = [
    p.join(process.resourcesPath || "", "build", "icon.png"),
    p.join(Z, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if ($(e)) {
        const n = ee.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return ee.createEmpty();
}
function z() {
  !r || r.isDestroyed() || (r.webContents.send("senti:open-settings"), G("panel"), r.show(), r.focus());
}
function yt() {
  if (!x)
    try {
      x = new xe(mt()), x.setToolTip("Senti — listening for you"), x.setContextMenu(
        ve.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => z() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              U = !0, d.quit();
            }
          }
        ])
      ), x.on("click", () => z());
    } catch {
    }
}
function gt(t) {
  G(t ? "setup" : "signin");
}
c.handle("senti:set-setup-mode", (t, e) => (gt(!!e), !0));
c.handle("senti:set-window-mode", (t, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (G(e), e === "hud" && yt(), !0) : !1);
c.handle("senti:hud-show", () => (ft(), !0));
c.handle("senti:hud-hide", () => (ht(), !0));
c.handle("senti:lock", () => {
  G("signin");
});
c.handle("senti:quit", () => B ? !1 : (d.quit(), !0));
