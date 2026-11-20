var Xe = Object.defineProperty;
var Qe = (t, e, r) => e in t ? Xe(t, e, { enumerable: !0, configurable: !0, writable: !0, value: r }) : t[e] = r;
var T = (t, e, r) => Qe(t, typeof e != "symbol" ? e + "" : e, r);
import { existsSync as b, readFileSync as I, mkdirSync as D, writeFileSync as M, unlinkSync as Ee, readdirSync as Y, statSync as de, rmdirSync as et } from "fs";
import { execFileSync as X, spawn as g, execFile as P } from "child_process";
import Ae from "http";
import w from "os";
import tt from "electron";
import u from "path";
import { fileURLToPath as rt } from "url";
function nt(t, e) {
  const r = u.resolve(t), n = u.resolve(r, e || ""), o = r.endsWith(u.sep) ? r : r + u.sep;
  return n !== r && !n.startsWith(o) ? null : n;
}
const be = {
  Backspace: 8,
  Tab: 9,
  Enter: 13,
  Escape: 27,
  Space: 32,
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
  Shift: 16,
  ShiftLeft: 16,
  ShiftRight: 16,
  Control: 17,
  ControlLeft: 17,
  ControlRight: 17,
  Alt: 18,
  AltLeft: 18,
  AltRight: 18,
  Meta: 91,
  MetaLeft: 91,
  MetaRight: 92,
  ContextMenu: 93,
  NumpadMultiply: 106,
  NumpadAdd: 107,
  NumpadEnter: 13,
  NumpadSubtract: 109,
  NumpadDecimal: 110,
  NumpadDivide: 111,
  Semicolon: 186,
  Equal: 187,
  Comma: 188,
  Minus: 189,
  Period: 190,
  Slash: 191,
  Backquote: 192,
  BracketLeft: 219,
  Backslash: 220,
  BracketRight: 221,
  Quote: 222
}, st = /* @__PURE__ */ new Map([["shift", 16], ["ctrl", 17], ["alt", 18], ["meta", 91]]), Se = (t) => t === 16 || t === 17 || t === 18 || t === 91 || t === 92;
function te(t) {
  if (typeof t == "string") {
    if (Object.prototype.hasOwnProperty.call(be, t)) return be[t];
    if (/^Key[A-Z]$/.test(t)) return t.charCodeAt(3);
    if (/^Digit\d$/.test(t)) return t.charCodeAt(5);
    if (/^[a-zA-Z0-9]$/.test(t)) return t.toUpperCase().charCodeAt(0);
    if (/^Numpad\d$/.test(t)) return 96 + Number(t.slice(6));
    if (/^F([1-9]|1\d|2[0-4])$/.test(t)) return 111 + Number(t.slice(1));
  }
}
class Fe {
  constructor() {
    T(this, "last", 0);
  }
  accept(e) {
    return e.seq === void 0 ? !0 : !Number.isSafeInteger(e.seq) || e.seq <= this.last ? !1 : (this.last = e.seq, !0);
  }
}
class ot {
  constructor(e) {
    T(this, "held", /* @__PURE__ */ new Map());
    T(this, "down", /* @__PURE__ */ new Set());
    // A release-only snapshot may tell us a keydown never arrived. In that
    // case don't turn Ctrl+click into a plain click; wait for its release.
    T(this, "missing", /* @__PURE__ */ new Set());
    T(this, "repeats", /* @__PURE__ */ new Map());
    this.write = e;
  }
  line(e, r) {
    this.write(`${e} 0x${r.toString(16)}`);
  }
  press(e) {
    if (!this.down.has(e) && (this.down.add(e), this.line("D", e), !Se(e))) {
      const r = () => {
        this.down.has(e) && (this.repeats.set(e, setTimeout(r, 32)), this.line("D", e));
      };
      this.repeats.set(e, setTimeout(r, 400));
    }
  }
  releaseUnused() {
    const e = /* @__PURE__ */ new Set();
    for (const { vk: r, borrowed: n } of this.held.values())
      e.add(r), n.forEach((o) => e.add(o));
    for (const r of [...this.down].reverse())
      e.has(r) || (clearTimeout(this.repeats.get(r)), this.repeats.delete(r), this.down.delete(r), this.line("U", r));
  }
  remove(e) {
    var r;
    clearTimeout((r = this.held.get(e)) == null ? void 0 : r.lease), this.held.delete(e), this.releaseUnused();
  }
  renew(e, r, n = !1) {
    clearTimeout(r.lease), r.lease = setTimeout(() => this.remove(e), n ? 3e4 : 3e3);
  }
  reset() {
    for (const e of this.held.values()) clearTimeout(e.lease);
    this.held.clear(), this.missing.clear(), this.releaseUnused();
  }
  handle(e) {
    if (e.t === "keyreset")
      return this.reset(), !0;
    if (e.t === "keysync") {
      const l = new Set(Array.isArray(e.keys) ? e.keys : []);
      this.missing = new Set([...l].filter((a) => te(a) !== void 0 && !this.held.has(a)));
      for (const [a, d] of this.held)
        l.has(a) ? this.renew(a, d) : this.remove(a);
      return !0;
    }
    if (e.t !== "keydown" && e.t !== "keyup") return this.missing.size > 0;
    const r = te(e.code) ?? te(e.k);
    if (r === void 0) return !0;
    const n = e.code || (e.seq === void 0 ? String(r) : e.k);
    if (e.t === "keyup") {
      if (Se(r)) for (const l of this.held.values()) l.borrowed = l.borrowed.filter((a) => a !== r);
      return this.missing.delete(n), this.remove(n), !0;
    }
    if (this.missing.size)
      return this.missing.add(n), !0;
    if (this.held.has(n)) return !0;
    const o = Array.isArray(e.mods) ? [...st].filter(([l, a]) => a !== r && e.mods.includes(l)).map(([, l]) => l) : [], i = { vk: r, borrowed: o };
    return this.held.set(n, i), o.forEach((l) => this.press(l)), this.press(r), this.renew(n, i, e.seq === void 0), !0;
  }
}
function it(t, e) {
  return new Promise((r) => {
    var i;
    const n = () => {
      t.off("close", n), clearTimeout(o), r();
    }, o = setTimeout(() => {
      try {
        t.kill();
      } catch {
      }
      n();
    }, 4e3);
    t.once("close", n);
    try {
      e();
    } finally {
      try {
        (i = t.stdin) == null || i.end();
      } catch {
      }
    }
  });
}
const { app: f, BrowserWindow: _e, screen: C, ipcMain: c, globalShortcut: ae, safeStorage: G, session: re, shell: F, Tray: at, Menu: lt, nativeImage: ke, powerSaveBlocker: $e, desktopCapturer: pe, clipboard: Ne } = tt;
let k = null, $ = null;
const ct = rt(import.meta.url), fe = u.dirname(ct), q = process.env.VITE_DEV_SERVER_URL, Oe = "http://localhost:5173";
let s = null, le = "";
const ut = {
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
}, dt = 47615;
function pt(t) {
  for (const e of t)
    try {
      if (e && b(e)) return e;
    } catch {
    }
  return null;
}
function S() {
  if (process.platform !== "win32") return null;
  const t = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows", e = u.join(t, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), r = u.join(t, "Sysnative", "WindowsPowerShell", "v1.0", "powershell.exe");
  return pt([e, r, "powershell.exe"]);
}
function ft(t) {
  return new Promise((e, r) => {
    const n = Ae.createServer((l, a) => {
      try {
        let d = decodeURIComponent((l.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const h = u.normalize(d).replace(/^([/\\])+/, ""), p = u.join(t, h);
        if (!p.startsWith(t) || !b(p)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const m = I(p);
        a.writeHead(200, {
          "Content-Type": ut[u.extname(p).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(m);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let o = dt, i = 0;
    n.on("error", (l) => {
      l.code === "EADDRINUSE" && i < 12 ? (i++, o++, setTimeout(() => n.listen(o, "127.0.0.1"), 40)) : r(l);
    }), n.on("listening", () => e(`http://127.0.0.1:${o}`)), n.listen(o, "127.0.0.1");
  });
}
const N = () => u.join(f.getPath("userData"), "device.token");
function ht(t) {
  try {
    return D(u.dirname(N()), { recursive: !0 }), G.isEncryptionAvailable() ? (M(N(), G.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function Re() {
  try {
    return !b(N()) || !G.isEncryptionAvailable() ? null : G.decryptString(I(N()));
  } catch {
    return null;
  }
}
function mt() {
  try {
    b(N()) && Ee(N());
  } catch {
  }
}
const z = () => u.join(f.getPath("userData"), "screen-source.json");
function yt() {
  var t;
  try {
    if (!b(z())) return null;
    const e = (t = JSON.parse(I(z(), "utf8"))) == null ? void 0 : t.displayId;
    return typeof e == "string" && e ? e : null;
  } catch {
    return null;
  }
}
function wt(t) {
  try {
    D(u.dirname(z()), { recursive: !0 }), M(z(), JSON.stringify({ displayId: t }));
  } catch {
  }
}
let ce = yt();
function he() {
  if (ce) {
    const t = C.getAllDisplays().find((e) => String(e.id) === ce);
    if (t) return t;
  }
  return C.getPrimaryDisplay();
}
function gt() {
  const t = C.getAllDisplays(), e = Math.min(...t.map((i) => i.bounds.x)), r = Math.min(...t.map((i) => i.bounds.y)), n = Math.max(...t.map((i) => i.bounds.x + i.bounds.width)), o = Math.max(...t.map((i) => i.bounds.y + i.bounds.height));
  return { x: e, y: r, width: n - e, height: o - r };
}
const V = () => u.join(f.getPath("userData"), "setup.json");
function bt() {
  var t;
  try {
    return b(V()) ? ((t = JSON.parse(I(V(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function St(t) {
  try {
    D(u.dirname(V()), { recursive: !0 }), M(V(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const Le = 200, K = () => u.join(f.getPath("userData"), "memories.json");
function J() {
  try {
    if (!b(K())) return [];
    const t = JSON.parse(I(K(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function me(t) {
  try {
    D(u.dirname(K()), { recursive: !0 }), M(K(), JSON.stringify(t.slice(-Le)));
  } catch {
  }
}
const kt = 21, $t = 3, Z = () => u.join(f.getPath("userData"), "activity.json");
function ue() {
  try {
    if (!b(Z())) return [];
    const t = JSON.parse(I(Z(), "utf8"));
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}
function je(t) {
  try {
    D(u.dirname(Z()), { recursive: !0 }), M(Z(), JSON.stringify(t));
  } catch {
  }
}
function xt(t) {
  const e = t.getHours();
  return e < 6 ? "night" : e < 12 ? "morning" : e < 18 ? "afternoon" : "evening";
}
function vt(t, e, r) {
  const n = String(t ?? "").slice(0, 60).toLowerCase(), o = String(e ?? "").slice(0, 120), i = Math.max(0, Math.min(120, Number(r) || 0));
  if (!n || !i) return ue();
  const l = /* @__PURE__ */ new Date(), a = l.toISOString().slice(0, 10), d = xt(l), h = new Date(l.getTime() - kt * 864e5).toISOString().slice(0, 10), p = ue().filter((x) => x.day >= h);
  let m = p.find((x) => x.day === a && x.process === n && x.part === d);
  return m || (m = { day: a, process: n, part: d, minutes: 0, samples: [] }, p.push(m)), m.minutes = Math.round((m.minutes + i) * 10) / 10, o && !m.samples.includes(o) && m.samples.length < $t && m.samples.push(o), je(p), p;
}
function Pt(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return J();
  const r = J(), n = e.toLowerCase().replace(/\s+/g, " ");
  if (r.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === n)) return r;
  r.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const o = r.slice(-Le);
  return me(o), o;
}
let j = null;
const Ct = 2e4;
function It() {
  var n, o;
  const t = w.totalmem() / 1073741824, e = w.freemem() / 1024 ** 3, r = t - e;
  return {
    os: `${w.type()} ${w.release()}`,
    cpu: ((o = (n = w.cpus()[0]) == null ? void 0 : n.model) == null ? void 0 : o.trim()) ?? "unknown",
    cores: w.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +r.toFixed(1),
    ramUsedPct: Math.round(r / t * 100),
    uptimeHours: +(w.uptime() / 3600).toFixed(1)
  };
}
function Dt() {
  const t = S();
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
  return new Promise((r) => {
    P(
      t,
      ["-NoProfile", "-NonInteractive", "-Command", e],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (n, o) => {
        if (n || !o) return r({});
        try {
          const i = JSON.parse(o), l = (i.disks || []).map((a) => ({
            drive: a.drive,
            totalGB: a.totalGB,
            freeGB: a.freeGB,
            usedPct: a.totalGB ? Math.round((a.totalGB - a.freeGB) / a.totalGB * 100) : 0
          }));
          r({
            disks: l,
            topProcesses: i.topProcesses || [],
            startupApps: typeof i.startupApps == "number" ? i.startupApps : void 0
          });
        } catch {
          r({});
        }
      }
    );
  });
}
const xe = {
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
function Mt(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? xe[e] ? xe[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
let ne = null, ve = 0;
const Tt = /* @__PURE__ */ new Set([
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
function Et() {
  const t = [];
  return process.env.ProgramData && t.push(u.join(process.env.ProgramData, "Microsoft", "Windows", "Start Menu", "Programs")), process.env.APPDATA && t.push(u.join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs")), t;
}
function At() {
  const t = Date.now();
  if (ne && t - ve < 5 * 6e4) return ne;
  const e = [], r = t, n = (o, i) => {
    if (i > 4 || Date.now() - r > 4e3) return;
    let l;
    try {
      l = Y(o, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const a of l) {
      const d = u.join(o, a.name);
      a.isDirectory() ? n(d, i + 1) : a.isFile() && a.name.toLowerCase().endsWith(".lnk") && e.push({ name: a.name.slice(0, -4), path: d });
    }
  };
  for (const o of Et()) n(o, 0);
  return ne = e, ve = t, e;
}
function oe(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().replace(/^(open|launch|start|run|play)\s+/, "").trim(), r = se(e), n = e.split(/\s+/).map(se).filter((i) => i.length >= 2 && !Tt.has(i));
  if (!r && !n.length) return null;
  let o = null;
  for (const i of At()) {
    const l = se(i.name);
    let a = 0;
    if (l === r) a = 100;
    else if (r.length >= 3 && l.includes(r)) a = 60 - Math.min(25, l.length - r.length);
    else {
      let d = 0;
      for (const h of n) h.length >= 3 && l.includes(h) && d++;
      d && (a = 20 + d * 12 - Math.min(15, Math.floor(l.length / 6)));
    }
    a > 0 && (!o || a > o.score) && (o = { app: i, score: a });
  }
  return o && o.score >= 20 ? o.app : null;
}
async function Ft(t) {
  const e = Mt(t);
  if (e)
    try {
      if (e.kind === "url")
        return F.openExternal(e.target), { ok: !0, label: e.label };
      if (await Ot(e.label, e.target))
        return { ok: !0, label: e.label, focused: !0 };
      const n = oe(e.label) || oe(e.target);
      return n ? (F.openPath(n.path), { ok: !0, label: e.label }) : (g("cmd", ["/c", "start", "", e.target], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label });
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  const r = oe(t);
  if (r)
    try {
      return F.openPath(r.path), { ok: !0, label: r.name };
    } catch {
      return { ok: !1, error: "launch-failed" };
    }
  return { ok: !1, error: "unknown" };
}
const _t = `
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
`, Nt = {
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
function Ot(t, e) {
  const r = S();
  if (!r) return Promise.resolve(!1);
  const n = (Nt[t] ?? [e.replace(/\.exe$/i, "")]).map((i) => i.replace(/[^A-Za-z0-9_.-]/g, "")).filter(Boolean);
  if (!n.length) return Promise.resolve(!1);
  const o = `$names = @(${n.map((i) => `'${i}'`).join(",")})
`;
  return new Promise((i) => {
    try {
      P(
        r,
        ["-NoProfile", "-NonInteractive", "-Command", o + _t],
        { timeout: 6e3, windowsHide: !0 },
        (l, a) => i(!l && String(a).trim() === "yes")
      );
    } catch {
      i(!1);
    }
  });
}
function Rt(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|show|go to|reveal)\s+/, "").replace(/^(my|the)\s+/, "").replace(/\s+(folder|directory)$/, "").trim(), r = {
    temp: { shell: w.tmpdir(), label: "your Temp folder" },
    "temp files": { shell: w.tmpdir(), label: "your Temp folder" },
    "temporary files": { shell: w.tmpdir(), label: "your Temp folder" },
    "recycle bin": { shell: "shell:RecycleBinFolder", label: "Recycle Bin" },
    trash: { shell: "shell:RecycleBinFolder", label: "Recycle Bin" },
    "this pc": { shell: "shell:MyComputerFolder", label: "This PC" },
    "my computer": { shell: "shell:MyComputerFolder", label: "This PC" },
    computer: { shell: "shell:MyComputerFolder", label: "This PC" }
  };
  if (r[e]) return r[e];
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
      return { path: f.getPath(o.key), label: o.label };
    } catch {
      return null;
    }
  return null;
}
function Lt(t) {
  const e = Rt(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? g("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && F.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const jt = {
  desktop: "desktop",
  documents: "documents",
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
  music: "music"
}, Bt = 15 * 1024 * 1024;
function Be(t, e) {
  const r = jt[t];
  if (!r) return null;
  let n;
  try {
    n = f.getPath(r);
  } catch {
    return null;
  }
  const o = nt(n, e);
  return o ? { base: n, full: o } : null;
}
function Ht(t, e) {
  const r = Be(t, e);
  if (!r) throw new Error("Not allowed");
  const o = Y(r.full, { withFileTypes: !0 }).filter((i) => !i.name.startsWith(".")).slice(0, 500).map((i) => {
    let l = 0, a = 0;
    try {
      const d = de(u.join(r.full, i.name));
      l = d.size, a = d.mtimeMs;
    } catch {
    }
    return { name: i.name, dir: i.isDirectory(), size: l, modified: a };
  }).sort((i, l) => i.dir === l.dir ? i.name.localeCompare(l.name) : i.dir ? -1 : 1);
  return JSON.stringify({ root: t, relPath: e, items: o });
}
function Wt(t, e) {
  const r = Be(t, e);
  if (!r) throw new Error("Not allowed");
  const n = de(r.full);
  if (!n.isFile()) throw new Error("Not a file");
  if (n.size > Bt) throw new Error("File is too large to send (15 MB limit)");
  const o = I(r.full);
  return JSON.stringify({
    name: u.basename(r.full),
    size: n.size,
    base64: o.toString("base64")
  });
}
const Pe = 8e3, Ce = 40;
function Ut(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const r = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return f.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), n = Date.now(), o = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], l = (a, d) => {
    if (d > 4 || Date.now() - n > Pe || i.length >= Ce) return;
    let h;
    try {
      h = Y(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const p of h) {
      if (Date.now() - n > Pe || i.length >= Ce) return;
      if (p.name.startsWith(".") || o.test(p.name)) continue;
      const m = u.join(a, p.name);
      try {
        if (p.isSymbolicLink()) continue;
        p.isDirectory() ? l(m, d + 1) : p.isFile() && p.name.toLowerCase().includes(e) && i.push({ name: p.name, path: m });
      } catch {
      }
    }
  };
  for (const a of r) l(a, 0);
  if (i.length === 0) return { ok: !1, error: "not-found", count: 0 };
  i.sort((a, d) => {
    const h = a.name.toLowerCase(), p = d.name.toLowerCase(), m = h === e || h.replace(/\.[^.]+$/, "") === e, x = p === e || p.replace(/\.[^.]+$/, "") === e;
    return m !== x ? m ? -1 : 1 : a.name.length - d.name.length;
  });
  try {
    return F.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const Ie = 2e4;
function He() {
  const t = [w.tmpdir(), u.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let r = 0, n = 0;
  const o = (i, l) => {
    if (l > 6 || Date.now() - e > Ie || !/temp/i.test(i)) return;
    let a;
    try {
      a = Y(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of a) {
      if (Date.now() - e > Ie) return;
      const h = u.join(i, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          o(h, l + 1);
          try {
            et(h);
          } catch {
          }
        } else if (d.isFile()) {
          const p = de(h).size;
          Ee(h), r += p, n++;
        }
      } catch {
      }
    }
  };
  for (const i of t) o(i, 0);
  return { freedMB: Math.round(r / 1024 / 1024), files: n };
}
function Gt() {
  const t = S();
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
    const n = (X(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
      timeout: 3e4,
      windowsHide: !0,
      encoding: "utf8"
    }) || "").trim().split(/\r?\n/).pop() || "", [o, i] = n.split(/\s+/).map((l) => parseInt(l, 10));
    return {
      files: Number.isFinite(o) ? o : 0,
      freedMB: Number.isFinite(i) ? Math.round(i / 1024 / 1024) : 0
    };
  } catch {
    return { freedMB: 0, files: 0 };
  }
}
const qt = `
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
function ye() {
  const t = S();
  return t ? new Promise((e) => {
    try {
      P(
        t,
        ["-NoProfile", "-NonInteractive", "-Command", qt],
        { timeout: 5e3, windowsHide: !0 },
        (r, n) => {
          if (r || !n) return e(null);
          try {
            const o = JSON.parse(n.trim()), i = String(o.title || "").slice(0, 200), l = String(o.process || "").slice(0, 60);
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
const zt = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SentinelIn {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
  // Unicode text taps do not synthesize (and then accidentally release) a
  // Shift/Ctrl/Alt that belongs to a physically held remote chord. INPUT's
  // union must also fit MOUSEINPUT, including pointer alignment on Win64.
  [StructLayout(LayoutKind.Sequential)] struct Keyboard { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct Mouse { public int x, y; public uint data, flags, time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct Payload { [FieldOffset(0)] public Mouse mouse; [FieldOffset(0)] public Keyboard key; }
  [StructLayout(LayoutKind.Sequential)] struct Input { public uint type; public Payload payload; }
  [DllImport("user32.dll")] static extern uint SendInput(uint n, Input[] inputs, int size);
  public static void TypeText(string text) {
    foreach (char ch in text) {
      Keyboard k = new Keyboard();
      if (ch == '\\n') k.vk = 13;
      else { k.scan = ch; k.flags = 4; }
      Input press = new Input(); press.type = 1; press.payload.key = k;
      Input release = press; release.payload.key.flags |= 2;
      SendInput(2, new Input[] { press, release }, Marshal.SizeOf(typeof(Input)));
    }
  }
}
"@
$MOVE=0x0001; $ABS=0x8000; $VDESK=0x4000; $LD=0x0002; $LU=0x0004; $RD=0x0008; $RU=0x0010
$MD=0x0020; $MU=0x0040; $WHEEL=0x0800; $HWHEEL=0x01000; $KEYUP=0x0002

$held = New-Object 'System.Collections.Generic.HashSet[byte]'
function Key-Down([byte]$vk) {
  [void]$held.Add($vk)
  [SentinelIn]::keybd_event($vk,0,0,[IntPtr]::Zero)
}
function Key-Up([byte]$vk) {
  [SentinelIn]::keybd_event($vk,0,0x0002,[IntPtr]::Zero)
  [void]$held.Remove($vk)
}

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
      [SentinelIn]::TypeText($text)
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
# Parent crashed/closed stdin before a tidy reset: release only our keys.
foreach ($vk in @($held)) { [SentinelIn]::keybd_event($vk,0,2,[IntPtr]::Zero) }
`;
let y = null, v = null, We = new Fe();
const O = new ot(Ue);
function Ue(t) {
  var e;
  try {
    (e = y == null ? void 0 : y.stdin) == null || e.write(t + `
`);
  } catch {
  }
}
function Vt() {
  var e;
  if (y && !y.killed) return !0;
  const t = S();
  if (!t)
    return console.error("[RemoteInput] PowerShell not found; remote control input disabled."), !1;
  try {
    const r = u.join(f.getPath("userData"), "input.ps1");
    D(u.dirname(r), { recursive: !0 }), M(r, zt, "utf8"), y = g(
      t,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", r],
      { stdio: ["pipe", "ignore", "ignore"], windowsHide: !0 }
    );
    const n = y;
    return (e = n.stdin) == null || e.on("error", () => {
    }), n.on("error", (o) => console.error("[RemoteInput] PowerShell injector failed:", o)), n.once("close", () => {
      y === n && (y = null, O.reset());
    }), !0;
  } catch {
    return y = null, !1;
  }
}
function Ge() {
  if (v) return v;
  We = new Fe();
  const t = y;
  return t ? (v = it(t, () => O.reset()).finally(() => {
    y === t && (y = null), v = null;
  }), v) : (O.reset(), Promise.resolve());
}
const A = (t) => Math.max(0, Math.min(1, Number(t) || 0));
function De(t, e) {
  const r = he(), n = gt(), o = r.bounds.x + t * r.bounds.width, i = r.bounds.y + e * r.bounds.height;
  return {
    x: A((o - n.x) / n.width),
    y: A((i - n.y) / n.height)
  };
}
function Kt(t) {
  switch (t.t) {
    case "move": {
      const e = De(A(t.x), A(t.y));
      return `M ${e.x.toFixed(5)} ${e.y.toFixed(5)}`;
    }
    case "moverel": {
      const e = Math.max(-400, Math.min(400, Math.round(Number(t.x) || 0))), r = Math.max(-400, Math.min(400, Math.round(Number(t.y) || 0)));
      return !e && !r ? null : `R ${e} ${r}`;
    }
    case "click": {
      const e = t.b === "right" || t.b === "middle" ? t.b : "left", r = t.d === 2 ? "2" : "1";
      if (typeof t.x != "number" || t.x < 0) return `C ${e} -1 -1 ${r}`;
      const n = De(A(t.x), A(t.y));
      return `C ${e} ${n.x.toFixed(5)} ${n.y.toFixed(5)} ${r}`;
    }
    case "scroll": {
      const e = Number(t.d) || 0, r = t.axis === "x", n = Math.max(-10, Math.min(10, Math.round(-e / 100)));
      return n ? r ? `H ${n * 120}` : `S ${n * 120}` : null;
    }
    case "type": {
      const e = String(t.text ?? "").slice(0, 500);
      return e ? `T ${Buffer.from(e, "utf8").toString("base64")}` : null;
    }
    default:
      return null;
  }
}
function R(t) {
  var e;
  if (L || v || !Array.isArray(t) || !t.length) return !1;
  for (const r of t)
    if (!(!r || typeof r.t != "string" || !We.accept(r))) {
      if (r.t === "keyreset" || r.t === "keysync" || r.t === "keyup") {
        O.handle(r);
        continue;
      }
      if (!Vt() || !((e = y == null ? void 0 : y.stdin) != null && e.writable)) return !1;
      if (!O.handle(r)) {
        const n = Kt(r);
        n && Ue(n);
      }
    }
  return !0;
}
function Jt() {
  O.reset();
}
const Zt = 900;
function B(t) {
  return new Promise((e) => setTimeout(e, t));
}
async function Me(t) {
  const e = await ye();
  if (!e) return !1;
  const r = e.process.toLowerCase();
  return r !== "explorer" && r !== "cabinetwclass" ? !1 : e.title.toLowerCase().includes(t.toLowerCase());
}
async function Yt() {
  const t = w.tmpdir(), e = u.basename(t);
  try {
    F.openPath(t);
  } catch {
    return !1;
  }
  let r = !1;
  for (let n = 0; n < 14; n++)
    if (await B(400), await Me(e)) {
      r = !0;
      break;
    }
  if (!r || !R([{ t: "key", k: "a", mods: ["ctrl"] }]) || (await B(700), !await Me(e)) || !R([{ t: "key", k: "Delete", mods: ["shift"] }])) return !1;
  await B(Zt), R([{ t: "key", k: "Enter" }]);
  for (let n = 0; n < 3; n++)
    await B(1200), R([{ t: "key", k: "Enter" }]);
  return !0;
}
function Xt() {
  try {
    return g("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function Qt(t) {
  const e = String(t ?? "").toLowerCase().trim();
  try {
    if (e === "sleep")
      P("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"], { windowsHide: !0 });
    else if (e === "restart" || e === "reboot")
      g("shutdown", ["/r", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else if (e === "shutdown" || e === "shut down" || e === "off")
      g("shutdown", ["/s", "/t", "4"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref();
    else
      return !1;
    return !0;
  } catch {
    return !1;
  }
}
function er(t) {
  const e = S();
  if (!e) return !1;
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return P(e, ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
async function tr(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = t.toLowerCase().trim();
  if (!e) return { ok: !1, error: "unknown" };
  const r = S();
  if (!r) return { ok: !1, error: "unknown" };
  const n = `Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.ProcessName -match '${e.replace(/'/g, "''")}' } | Select-Object -First 1 -ExpandProperty ProcessName`;
  return new Promise((o) => {
    try {
      P(r, ["-NoProfile", "-NonInteractive", "-Command", n], { timeout: 5e3, windowsHide: !0 }, (i, l) => {
        if (i || !(l != null && l.trim())) {
          const d = `Get-Process | Where-Object { $_.ProcessName -match '${e.replace(/'/g, "''")}' } | Select-Object -First 1 -ExpandProperty ProcessName`;
          P(r, ["-NoProfile", "-NonInteractive", "-Command", d], { timeout: 5e3, windowsHide: !0 }, (h, p) => {
            if (h || !(p != null && p.trim())) return o({ ok: !1, error: "unknown" });
            const m = p.trim();
            try {
              g("taskkill", ["/IM", m, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), o({ ok: !0, label: m.replace(/\.exe$/i, "") });
            } catch {
              o({ ok: !1, error: "failed" });
            }
          });
          return;
        }
        const a = l.trim();
        try {
          g("taskkill", ["/IM", a, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), o({ ok: !0, label: a.replace(/\.exe$/i, "") });
        } catch {
          o({ ok: !1, error: "failed" });
        }
      });
    } catch {
      o({ ok: !1, error: "failed" });
    }
  });
}
async function qe() {
  const t = await ye();
  if (!t) return { ok: !1, label: "", error: "nothing" };
  const e = t.process.toLowerCase().replace(/\.exe$/i, ""), r = t.title || e;
  t.title.match(/pid:(\d+)/i);
  const o = {
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
    return g("taskkill", ["/IM", o, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: r };
  } catch {
    return { ok: !1, label: r, error: "failed" };
  }
}
function ze() {
  try {
    const t = S();
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
async function rr() {
  if (j && Date.now() - j.at < Ct) return j.data;
  const t = It();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await Dt();
    } catch {
    }
  const r = { ...t, ...e };
  return j = { at: Date.now(), data: r }, r;
}
async function nr(t) {
  const { baseUrl: e, path: r, method: n = "GET", body: o, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !r.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const a = Re();
    if (!a) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${a}`;
  }
  try {
    const a = await fetch(`${e}${r}`, {
      method: n,
      headers: l,
      body: o === void 0 ? void 0 : JSON.stringify(o)
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
const sr = "CommandOrControl+Shift+Space", or = "CommandOrControl+Shift+Q";
function ir(t, e = 15e3) {
  return new Promise((r, n) => {
    const o = Date.now(), i = () => {
      Ae.get(t, (d) => {
        d.statusCode === 200 ? r() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - o > e ? n(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function Ve() {
  const { width: t, height: e } = C.getPrimaryDisplay().workAreaSize, r = u.join(fe, "preload.cjs");
  s = new _e({
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
      preload: r,
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
  }), s.setVisibleOnAllWorkspaces(!0), s.setMenuBarVisibility(!1), s.setAlwaysOnTop(!0, "screen-saver"), q ? s.loadURL(Oe).catch((n) => {
    console.error("[Electron] Failed to load dev server:", n.message);
  }) : le ? s.loadURL(le).catch((n) => {
    console.error("[Electron] Failed to load prod server:", n.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), s.webContents.on("did-finish-load", () => {
    var n, o;
    s == null || s.show(), s == null || s.focus(), q && ((o = (n = s == null ? void 0 : s.webContents) == null ? void 0 : n.openDevTools) == null || o.call(n));
  }), s.webContents.on("did-fail-load", (n, o, i, l, a) => {
    console.error("[Electron] Renderer load failed:", { errorCode: o, errorDescription: i, validatedURL: l, isMainFrame: a });
  }), s.webContents.on("console-message", (n, o, i) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][o] || "LOG";
    console.log(`[Renderer:${l}] ${i}`);
  }), s.webContents.on("render-process-gone", (n, o) => {
    console.error("[Electron] Renderer process gone:", o);
  }), s.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), s.on("close", (n) => {
    L || (n.preventDefault(), s == null || s.hide());
  });
}
f.requestSingleInstanceLock() ? f.on("second-instance", () => {
  s && !s.isDestroyed() && Je();
}) : f.quit();
f.whenReady().then(async () => {
  if (q)
    try {
      await ir(Oe);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), f.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (re.defaultSession.setPermissionRequestHandler((e, r, n) => {
    n(t(r));
  }), re.defaultSession.setPermissionCheckHandler((e, r) => t(r)), re.defaultSession.setDisplayMediaRequestHandler((e, r) => {
    pe.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }).then((n) => {
      const o = String(he().id), l = n.find((a) => a.display_id === o) || n[0];
      r(l ? { video: l } : {});
    });
  }), !q)
    try {
      le = await ft(u.join(fe, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), f.quit();
      return;
    }
  Ve(), Ze();
  try {
    ae.register(sr, () => {
      s == null || s.webContents.send("senti:talk");
    });
  } catch {
  }
  try {
    ae.register(or, () => {
      qe(), ze();
    });
  } catch {
  }
  process.platform === "win32" && f.isPackaged && f.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
f.on("activate", () => {
  _e.getAllWindows().length === 0 ? Ve() : (s == null || s.show(), s == null || s.focus());
});
f.on("window-all-closed", () => {
  L && process.platform !== "darwin" && f.quit();
});
let Te = !1;
f.on("before-quit", (t) => {
  L = !0, !(!y && !v) && (t.preventDefault(), !Te && (Te = !0, Ge().finally(() => f.quit())));
});
f.on("before-quit", () => {
  s = null;
});
f.on("will-quit", () => {
  ae.unregisterAll();
});
c.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : ht(e.trim()));
c.handle("senti:token-clear", () => (mt(), !0));
c.handle("senti:token-present", () => !!Re());
c.on("senti:get-setup", (t) => {
  t.returnValue = bt();
});
c.handle("senti:set-setup", (t, e) => (St(!!e), !0));
c.handle("senti:system-info", () => rr());
c.handle("senti:clipboard-read", () => {
  try {
    return Ne.readText();
  } catch {
    return "";
  }
});
c.handle("senti:clipboard-write", (t, e) => {
  try {
    return typeof e == "string" && e && Ne.writeText(e), !0;
  } catch {
    return !1;
  }
});
async function Ke(t = 1600) {
  var e;
  try {
    const r = C.getPrimaryDisplay(), { width: n, height: o } = r.size, i = Math.min(1, t / n), a = (e = (await pe.getSources({
      types: ["screen"],
      thumbnailSize: { width: Math.round(n * i), height: Math.round(o * i) }
    }))[0]) == null ? void 0 : e.thumbnail;
    return !a || a.isEmpty() ? null : a.toDataURL();
  } catch {
    return null;
  }
}
async function ar() {
  const t = await Ke(4096);
  if (!t) return { ok: !1 };
  try {
    const e = u.join(f.getPath("pictures"), "Senti");
    D(e, { recursive: !0 });
    const r = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19), n = u.join(e, `screenshot-${r}.png`);
    return M(n, Buffer.from(t.split(",")[1], "base64")), { ok: !0, path: n };
  } catch {
    return { ok: !1 };
  }
}
c.handle("senti:screenshot-save", () => ar());
c.handle("senti:screenshot-grab", () => Ke(1600));
c.handle("senti:screen-sources", async () => {
  try {
    const t = await pe.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } }), e = String(he().id);
    return t.map((r) => {
      const n = r.display_id || "";
      return { id: r.id, name: r.name, displayId: n, selected: !!n && n === e };
    });
  } catch {
    return [];
  }
});
c.handle("senti:set-screen-source", (t, e) => typeof e != "string" || !e || !C.getAllDisplays().some((n) => String(n.id) === e) ? !1 : (ce = e, wt(e), !0));
c.handle("senti:memory-list", () => J());
c.handle("senti:memory-add", (t, e) => Pt(String(e ?? "")));
c.handle("senti:memory-forget", (t, e) => {
  const r = J().filter((n) => n.id !== String(e));
  return me(r), r;
});
c.handle("senti:memory-clear", () => (me([]), []));
c.handle(
  "senti:activity-record",
  (t, e, r, n) => vt(e, r, n)
);
c.handle("senti:activity-list", () => ue());
c.handle("senti:activity-clear", () => (je([]), []));
let E = null;
const H = /* @__PURE__ */ new Set();
c.handle("senti:keep-awake", (t, e, r) => {
  try {
    const n = typeof r == "string" && r ? r : "default";
    return e ? H.add(n) : H.delete(n), H.size > 0 && E === null ? E = $e.start("prevent-display-sleep") : H.size === 0 && E !== null && ($e.stop(E), E = null), E !== null;
  } catch {
    return !1;
  }
});
c.handle("senti:open-app", (t, e) => Ft(e));
c.handle("senti:close-app", (t, e) => tr(e));
c.handle("senti:close-current-app", async () => qe());
c.handle("senti:show-desktop", () => ze());
c.handle("senti:clean-temp", () => He());
c.handle("senti:clean-temp-visible", async () => {
  const t = await Yt();
  return { ...He(), shown: t };
});
c.handle("senti:empty-recycle-bin", () => Gt());
c.handle("senti:open-folder", (t, e) => Lt(e));
c.handle(
  "senti:serve-list",
  (t, e, r) => Ht(String(e ?? ""), String(r ?? ""))
);
c.handle(
  "senti:serve-read",
  (t, e, r) => Wt(String(e ?? ""), String(r ?? ""))
);
c.handle("senti:open-file", (t, e) => Ut(e));
c.handle("senti:lock-workstation", () => Xt());
c.handle("senti:power", (t, e) => Qt(e));
c.handle("senti:active-window", () => ye());
c.handle("senti:remote-input", (t, e) => R(e));
c.handle("senti:remote-input-stop", async () => (await Ge(), !0));
c.handle("senti:reset-remote-key-state", () => (Jt(), !0));
c.handle("senti:volume", (t, e) => {
  const r = e === "up" || e === "down" || e === "mute" ? e : null;
  return r ? er(r) : !1;
});
c.handle("senti:api", (t, e) => {
  const r = e ?? {};
  return typeof r.baseUrl != "string" || typeof r.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : nr({
    baseUrl: r.baseUrl,
    path: r.path,
    method: typeof r.method == "string" ? r.method : "GET",
    body: r.body,
    auth: r.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: w.hostname(),
  platform: process.platform
}));
let ie = null;
function lr() {
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
c.handle("senti:hardware-id", () => (ie || (ie = lr() || `${w.hostname()}:${w.platform()}:${w.arch()}`), ie));
let we = "setup", _ = null, L = !1;
const W = 380, U = 132;
function ge(t) {
  if (!s || s.isDestroyed()) return;
  const { workArea: e } = C.getPrimaryDisplay();
  t ? s.setBounds({
    x: Math.round(e.x + (e.width - W) / 2),
    y: Math.round(e.y + (e.height - W) / 2 - e.height * 0.06),
    width: W,
    height: W
  }) : s.setBounds({
    x: Math.round(e.x + e.width - U - 18),
    y: Math.round(e.y + e.height - U - 18),
    width: U,
    height: U
  });
}
function Q(t) {
  !s || s.isDestroyed() || (we = t, t === "hud" ? (s.setFullScreen(!1), s.setResizable(!1), s.setSkipTaskbar(!0), s.setAlwaysOnTop(!0, "screen-saver"), s.setIgnoreMouseEvents(!0, { forward: !0 }), ge(!1), s.showInactive()) : t === "setup" ? (s.setIgnoreMouseEvents(!1), s.setAlwaysOnTop(!1), s.setFullScreen(!1), s.setResizable(!0), s.setSkipTaskbar(!1), s.setSize(980, 760), s.center(), s.show()) : t === "panel" ? (s.setIgnoreMouseEvents(!1), s.setAlwaysOnTop(!1), s.setFullScreen(!1), s.setResizable(!1), s.setSkipTaskbar(!1), s.setSize(760, 840), s.center(), s.show(), s.focus()) : (s.setIgnoreMouseEvents(!1), s.setFullScreen(!1), s.setAlwaysOnTop(!1), s.setResizable(!1), s.setSkipTaskbar(!1), s.setSize(680, 780), s.center(), s.show(), s.focus()), ee());
}
function cr() {
  !s || s.isDestroyed() || we !== "hud" || (ge(!0), s.showInactive(), s.setAlwaysOnTop(!0, "screen-saver"));
}
function ur() {
  !s || s.isDestroyed() || we !== "hud" || ge(!1);
}
function dr() {
  const t = [
    u.join(process.resourcesPath || "", "build", "icon.png"),
    u.join(fe, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (b(e)) {
        const r = ke.createFromPath(e);
        if (!r.isEmpty()) return r.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return ke.createEmpty();
}
function Je() {
  !s || s.isDestroyed() || (s.webContents.send("senti:open-settings"), Q("panel"), s.show(), s.focus());
}
function Ze() {
  if (!_)
    try {
      _ = new at(dr()), ee(), _.on("click", () => {
        s && !s.isDestroyed() && s.isVisible() ? s.focus() : Ye();
      });
    } catch {
    }
}
function ee() {
  if (!_) return;
  const t = s && !s.isDestroyed() && !s.isVisible(), e = [
    {
      label: t ? "Show Senti" : "Hide Senti",
      click: () => {
        t ? Ye() : pr();
      }
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => Je()
    },
    {
      label: "Quit Senti",
      click: () => {
        L = !0, f.quit();
      }
    }
  ];
  _.setContextMenu(lt.buildFromTemplate(e)), _.setToolTip(t ? "Senti — hidden, listening" : "Senti — listening for you");
}
function pr() {
  !s || s.isDestroyed() || (s.hide(), ee());
}
function Ye() {
  !s || s.isDestroyed() || (Q("hud"), s.showInactive(), ee());
}
c.handle("senti:set-window-mode", (t, e) => e === "setup" || e === "hud" || e === "panel" ? (Q(e), e === "hud" && Ze(), !0) : !1);
c.handle("senti:enter-fullscreen", () => !s || s.isDestroyed() ? !1 : (s.setAlwaysOnTop(!1), s.setFullScreen(!0), s.focus(), !0));
c.handle("senti:exit-fullscreen", () => !s || s.isDestroyed() ? !1 : (s.setFullScreen(!1), s.setAlwaysOnTop(!0, "screen-saver"), !0));
c.handle("senti:hud-show", () => (cr(), !0));
c.handle("senti:hud-hide", () => (ur(), !0));
c.handle("senti:hide-window", () => !s || s.isDestroyed() ? !1 : (s.hide(), !0));
c.handle("senti:restore-window", () => !s || s.isDestroyed() ? !1 : (Q("hud"), s.showInactive(), !0));
c.handle("senti:start-screen-context", () => !0);
c.handle("senti:stop-screen-context", () => !0);
c.handle("senti:start-code-bridge", async () => {
  if (k) return !0;
  try {
    const t = await import("./wrapper-CoTtEBNz.js"), e = t.Server || t.default.Server;
    return e ? (k = new e({ port: 9876, host: "127.0.0.1" }), k.on("connection", (r) => {
      $ = r, s == null || s.webContents.send("senti:code-bridge-message", { type: "connected" }), r.on("message", (n) => {
        try {
          const o = JSON.parse(n.toString());
          s == null || s.webContents.send("senti:code-bridge-message", o);
        } catch {
        }
      }), r.on("close", () => {
        $ = null, s == null || s.webContents.send("senti:code-bridge-message", { type: "disconnected" });
      });
    }), k && k.on("error", () => {
    }), !0) : !1;
  } catch {
    return !1;
  }
});
c.handle("senti:stop-code-bridge", () => {
  if (k) {
    try {
      k.close();
    } catch {
    }
    k = null, $ = null;
  }
  return !0;
});
c.handle("senti:send-to-vscode", (t, e) => {
  if (!$ || $.readyState !== 1) return !1;
  try {
    return $.send(JSON.stringify(e)), !0;
  } catch {
    return !1;
  }
});
c.handle("senti:is-code-bridge-connected", () => $ !== null && $.readyState === 1);
c.handle("senti:running-apps", () => {
  const t = S();
  if (!t) return [];
  const e = `
$ErrorActionPreference='SilentlyContinue'
Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -Property ProcessName, MainWindowTitle | ForEach-Object {
  [pscustomobject]@{ name=$_.ProcessName; title=$_.MainWindowTitle }
} | ConvertTo-Json -Compress
`;
  try {
    const r = X(t, ["-NoProfile", "-NonInteractive", "-Command", e], {
      timeout: 5e3,
      windowsHide: !0,
      maxBuffer: 1048576
    }).toString().trim(), n = JSON.parse(r);
    return Array.isArray(n) ? n.slice(0, 50) : [];
  } catch {
    return [];
  }
});
c.handle("senti:quit", () => (f.quit(), !0));
export {
  Jt as resetRemoteKeyState
};
