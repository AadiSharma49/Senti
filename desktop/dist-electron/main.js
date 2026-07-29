import { existsSync as w, readFileSync as P, mkdirSync as L, writeFileSync as G, unlinkSync as Q, readdirSync as Z, rmdirSync as ce, statSync as ue } from "fs";
import { spawn as M, execFileSync as de, execFile as ee } from "child_process";
import te from "http";
import m from "os";
import pe from "electron";
import f from "path";
import { fileURLToPath as fe } from "url";
const { app: u, BrowserWindow: re, screen: ne, ipcMain: l, globalShortcut: C, safeStorage: T, session: q, shell: R, Tray: he, Menu: me, nativeImage: V, powerSaveBlocker: W, desktopCapturer: ge } = pe, ye = fe(import.meta.url), N = f.dirname(ye), _ = process.env.VITE_DEV_SERVER_URL, oe = "http://localhost:5173";
let r = null, j = "";
const be = {
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
}, ke = 47615;
function we(t) {
  return new Promise((e, n) => {
    const o = te.createServer((c, a) => {
      try {
        let d = decodeURIComponent((c.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const h = f.normalize(d).replace(/^([/\\])+/, ""), p = f.join(t, h);
        if (!p.startsWith(t) || !w(p)) {
          a.writeHead(404), a.end("Not found");
          return;
        }
        const g = P(p);
        a.writeHead(200, {
          "Content-Type": be[f.extname(p).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), a.end(g);
      } catch {
        a.writeHead(500), a.end("Error");
      }
    });
    let s = ke, i = 0;
    o.on("error", (c) => {
      c.code === "EADDRINUSE" && i < 12 ? (i++, s++, setTimeout(() => o.listen(s, "127.0.0.1"), 40)) : n(c);
    }), o.on("listening", () => e(`http://127.0.0.1:${s}`)), o.listen(s, "127.0.0.1");
  });
}
const k = () => f.join(u.getPath("userData"), "device.token");
function Se(t) {
  try {
    return L(f.dirname(k()), { recursive: !0 }), T.isEncryptionAvailable() ? (G(k(), T.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function se() {
  try {
    return !w(k()) || !T.isEncryptionAvailable() ? null : T.decryptString(P(k()));
  } catch {
    return null;
  }
}
function Ce() {
  try {
    w(k()) && Q(k());
  } catch {
  }
}
const F = () => f.join(u.getPath("userData"), "setup.json");
function xe() {
  var t;
  try {
    return w(F()) ? ((t = JSON.parse(P(F(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function ve(t) {
  try {
    L(f.dirname(F()), { recursive: !0 }), G(F(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
const ae = 200, D = () => f.join(u.getPath("userData"), "memories.json");
function $() {
  try {
    if (!w(D())) return [];
    const t = JSON.parse(P(D(), "utf8"));
    return Array.isArray(t) ? t.filter((e) => e && typeof e.text == "string") : [];
  } catch {
    return [];
  }
}
function H(t) {
  try {
    L(f.dirname(D()), { recursive: !0 }), G(D(), JSON.stringify(t.slice(-ae)));
  } catch {
  }
}
function Ee(t) {
  const e = String(t || "").trim().slice(0, 300);
  if (!e) return $();
  const n = $(), o = e.toLowerCase().replace(/\s+/g, " ");
  if (n.some((i) => i.text.toLowerCase().replace(/\s+/g, " ") === o)) return n;
  n.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: e, createdAt: Date.now() });
  const s = n.slice(-ae);
  return H(s), s;
}
let x = null;
const Te = 2e4;
function _e() {
  var o, s;
  const t = m.totalmem() / 1073741824, e = m.freemem() / 1024 ** 3, n = t - e;
  return {
    os: `${m.type()} ${m.release()}`,
    cpu: ((s = (o = m.cpus()[0]) == null ? void 0 : o.model) == null ? void 0 : s.trim()) ?? "unknown",
    cores: m.cpus().length,
    ramTotalGB: +t.toFixed(1),
    ramUsedGB: +n.toFixed(1),
    ramUsedPct: Math.round(n / t * 100),
    uptimeHours: +(m.uptime() / 3600).toFixed(1)
  };
}
function Fe() {
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
    ee(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", t],
      { timeout: 6e3, windowsHide: !0, maxBuffer: 1024 * 512 },
      (n, o) => {
        if (n || !o) return e({});
        try {
          const s = JSON.parse(o), i = (s.disks || []).map((c) => ({
            drive: c.drive,
            totalGB: c.totalGB,
            freeGB: c.freeGB,
            usedPct: c.totalGB ? Math.round((c.totalGB - c.freeGB) / c.totalGB * 100) : 0
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
const J = {
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
function De(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|launch|start)\s+/, "");
  return e ? J[e] ? J[e] : /^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(e) ? { kind: "url", target: `https://${e}`, label: e } : null : null;
}
function $e(t) {
  const e = De(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.kind === "url" ? R.openExternal(e.target) : M("cmd", ["/c", "start", "", e.target], {
      detached: !0,
      stdio: "ignore",
      windowsHide: !0
    }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
function Ae(t) {
  if (typeof t != "string") return null;
  const e = t.toLowerCase().trim().replace(/^(open|show|go to|reveal)\s+/, "").replace(/^(my|the)\s+/, "").replace(/\s+(folder|directory)$/, "").trim(), n = {
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
      return { path: u.getPath(s.key), label: s.label };
    } catch {
      return null;
    }
  return null;
}
function Pe(t) {
  const e = Ae(t);
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return e.shell ? M("explorer.exe", [e.shell], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref() : e.path && R.openPath(e.path), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const Y = 8e3, K = 40;
function Me(t) {
  const e = String(t ?? "").toLowerCase().trim();
  if (!e) return { ok: !1, error: "empty" };
  const n = ["desktop", "documents", "downloads", "pictures", "videos", "music"].map((a) => {
    try {
      return u.getPath(a);
    } catch {
      return null;
    }
  }).filter((a) => !!a), o = Date.now(), s = /^(node_modules|\.git|\$recycle|appdata|windows|program files)/i, i = [], c = (a, d) => {
    if (d > 4 || Date.now() - o > Y || i.length >= K) return;
    let h;
    try {
      h = Z(a, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const p of h) {
      if (Date.now() - o > Y || i.length >= K) return;
      if (p.name.startsWith(".") || s.test(p.name)) continue;
      const g = f.join(a, p.name);
      try {
        if (p.isSymbolicLink()) continue;
        p.isDirectory() ? c(g, d + 1) : p.isFile() && p.name.toLowerCase().includes(e) && i.push({ name: p.name, path: g });
      } catch {
      }
    }
  };
  for (const a of n) c(a, 0);
  if (i.length === 0) return { ok: !1, error: "not-found", count: 0 };
  i.sort((a, d) => {
    const h = a.name.toLowerCase(), p = d.name.toLowerCase(), g = h === e || h.replace(/\.[^.]+$/, "") === e, le = p === e || p.replace(/\.[^.]+$/, "") === e;
    return g !== le ? g ? -1 : 1 : a.name.length - d.name.length;
  });
  try {
    return R.openPath(i[0].path), { ok: !0, label: i[0].name, count: i.length };
  } catch {
    return { ok: !1, error: "launch-failed" };
  }
}
const X = 2e4;
function Re() {
  const t = [m.tmpdir(), f.join(process.env.SystemRoot || "C:\\Windows", "Temp")], e = Date.now();
  let n = 0, o = 0;
  const s = (i, c) => {
    if (c > 6 || Date.now() - e > X || !/temp/i.test(i)) return;
    let a;
    try {
      a = Z(i, { withFileTypes: !0 });
    } catch {
      return;
    }
    for (const d of a) {
      if (Date.now() - e > X) return;
      const h = f.join(i, d.name);
      try {
        if (d.isSymbolicLink()) continue;
        if (d.isDirectory()) {
          s(h, c + 1);
          try {
            ce(h);
          } catch {
          }
        } else if (d.isFile()) {
          const p = ue(h).size;
          Q(h), n += p, o++;
        }
      } catch {
      }
    }
  };
  for (const i of t) s(i, 0);
  return { freedMB: Math.round(n / 1024 / 1024), files: o };
}
function Be() {
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
    const n = (de("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", t], {
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
function Oe() {
  try {
    return M("rundll32.exe", ["user32.dll,LockWorkStation"], { detached: !0, stdio: "ignore" }).unref(), !0;
  } catch {
    return !1;
  }
}
function je(t) {
  const o = `$w = New-Object -ComObject WScript.Shell; 1..${t === "mute" ? 1 : 5} | ForEach-Object { $w.SendKeys([char]${t === "up" ? 175 : t === "down" ? 174 : 173}) }`;
  try {
    return ee("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", o], {
      timeout: 4e3,
      windowsHide: !0
    }), !0;
  } catch {
    return !1;
  }
}
const Ie = {
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
function Le(t) {
  if (typeof t != "string") return { ok: !1, error: "unknown" };
  const e = Ie[t.toLowerCase().trim()];
  if (!e) return { ok: !1, error: "unknown" };
  try {
    return M("taskkill", ["/IM", e.proc, "/F"], { detached: !0, stdio: "ignore", windowsHide: !0 }).unref(), { ok: !0, label: e.label };
  } catch {
    return { ok: !1, error: "failed" };
  }
}
async function Ge() {
  if (x && Date.now() - x.at < Te) return x.data;
  const t = _e();
  let e = {};
  if (process.platform === "win32")
    try {
      e = await Fe();
    } catch {
    }
  const n = { ...t, ...e };
  return x = { at: Date.now(), data: n }, n;
}
async function Ne(t) {
  const { baseUrl: e, path: n, method: o = "GET", body: s, auth: i = !0 } = t;
  if (!/^https?:\/\//i.test(e) || !n.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const c = { "Content-Type": "application/json" };
  if (i) {
    const a = se();
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
let A = !0;
const He = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Ue = "CommandOrControl+Alt+Shift+Q", ze = "CommandOrControl+Shift+Space";
function qe() {
  for (const t of He)
    try {
      C.isRegistered(t) && C.unregister(t);
    } catch {
    }
}
function b(t) {
  A = t, qe();
}
function Ve(t, e = 15e3) {
  return new Promise((n, o) => {
    const s = Date.now(), i = () => {
      te.get(t, (d) => {
        d.statusCode === 200 ? n() : c();
      }).on("error", c);
    }, c = () => {
      Date.now() - s > e ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function ie() {
  const { width: t, height: e } = ne.getPrimaryDisplay().workAreaSize, n = f.join(N, "preload.cjs");
  r = new re({
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
      backgroundThrottling: !1
    }
  }), r.setVisibleOnAllWorkspaces(!0), r.setMenuBarVisibility(!1), r.setAlwaysOnTop(!0, "screen-saver"), _ ? r.loadURL(oe).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : j ? r.loadURL(j).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), r.webContents.on("did-finish-load", () => {
    var o, s;
    r == null || r.show(), r == null || r.focus(), _ && ((s = (o = r == null ? void 0 : r.webContents) == null ? void 0 : o.openDevTools) == null || s.call(o));
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
    B || (o.preventDefault(), r == null || r.hide());
  });
}
u.requestSingleInstanceLock() ? u.on("second-instance", () => {
  r && !r.isDestroyed() && I();
}) : u.quit();
u.whenReady().then(async () => {
  if (_)
    try {
      await Ve(oe);
    } catch (e) {
      console.error("[Electron] Vite dev server failed to start:", e), u.quit();
      return;
    }
  const t = (e) => e === "media" || e === "microphone" || e === "audioCapture";
  if (q.defaultSession.setPermissionRequestHandler((e, n, o) => {
    o(t(n));
  }), q.defaultSession.setPermissionCheckHandler((e, n) => t(n)), !_)
    try {
      j = await we(f.join(N, "../dist"));
    } catch (e) {
      console.error("[Electron] Failed to start static server:", e), u.quit();
      return;
    }
  ie(), b(!0);
  try {
    C.register(Ue, () => {
      A = !1, u.exit(0);
    });
  } catch {
  }
  try {
    C.register(ze, () => {
      A || r == null || r.webContents.send("senti:talk");
    });
  } catch {
  }
  process.platform === "win32" && u.isPackaged && u.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
u.on("activate", () => {
  re.getAllWindows().length === 0 ? ie() : (r == null || r.show(), r == null || r.focus());
});
u.on("window-all-closed", () => {
  B && process.platform !== "darwin" && u.quit();
});
u.on("before-quit", () => {
  B = !0;
});
u.on("before-quit", () => {
  r = null;
});
u.on("will-quit", () => {
  C.unregisterAll();
});
l.handle("senti:token-set", (t, e) => typeof e != "string" || !e.trim() ? !1 : Se(e.trim()));
l.handle("senti:token-clear", () => (Ce(), !0));
l.handle("senti:token-present", () => !!se());
l.on("senti:get-setup", (t) => {
  t.returnValue = xe();
});
l.handle("senti:set-setup", (t, e) => (ve(!!e), !0));
l.handle("senti:system-info", () => Ge());
l.handle("senti:screen-sources", async () => {
  try {
    return (await ge.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })).map((e) => ({ id: e.id, name: e.name }));
  } catch {
    return [];
  }
});
l.handle("senti:memory-list", () => $());
l.handle("senti:memory-add", (t, e) => Ee(String(e ?? "")));
l.handle("senti:memory-forget", (t, e) => {
  const n = $().filter((o) => o.id !== String(e));
  return H(n), n;
});
l.handle("senti:memory-clear", () => (H([]), []));
let y = null;
l.handle("senti:keep-awake", (t, e) => {
  try {
    return e && y === null ? y = W.start("prevent-display-sleep") : !e && y !== null && (W.stop(y), y = null), y !== null;
  } catch {
    return !1;
  }
});
l.handle("senti:open-app", (t, e) => $e(e));
l.handle("senti:close-app", (t, e) => Le(e));
l.handle("senti:clean-temp", () => Re());
l.handle("senti:empty-recycle-bin", () => Be());
l.handle("senti:open-folder", (t, e) => Pe(e));
l.handle("senti:open-file", (t, e) => Me(e));
l.handle("senti:web-search", (t, e) => {
  const n = String(e ?? "").trim().slice(0, 200);
  return n ? (R.openExternal(`https://www.google.com/search?q=${encodeURIComponent(n)}`), { ok: !0 }) : { ok: !1 };
});
l.handle("senti:lock-workstation", () => Oe());
l.handle("senti:volume", (t, e) => {
  const n = e === "up" || e === "down" || e === "mute" ? e : null;
  return n ? je(n) : !1;
});
l.handle("senti:api", (t, e) => {
  const n = e ?? {};
  return typeof n.baseUrl != "string" || typeof n.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : Ne({
    baseUrl: n.baseUrl,
    path: n.path,
    method: typeof n.method == "string" ? n.method : "GET",
    body: n.body,
    auth: n.auth !== !1
  });
});
l.handle("senti:get-platform", () => process.platform);
l.handle("senti:device-info", () => ({
  hostname: m.hostname(),
  platform: process.platform
}));
l.handle("senti:set-lock-state", (t, e) => {
  b(!!e);
});
let U = "signin", S = null, B = !1;
const v = 380, E = 132;
function z(t) {
  if (!r || r.isDestroyed()) return;
  const { workArea: e } = ne.getPrimaryDisplay();
  t ? r.setBounds({
    x: Math.round(e.x + (e.width - v) / 2),
    y: Math.round(e.y + (e.height - v) / 2 - e.height * 0.06),
    width: v,
    height: v
  }) : r.setBounds({
    x: Math.round(e.x + e.width - E - 18),
    y: Math.round(e.y + e.height - E - 18),
    width: E,
    height: E
  });
}
function O(t) {
  !r || r.isDestroyed() || (U = t, t === "hud" ? (b(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!0), r.setAlwaysOnTop(!0, "screen-saver"), r.setIgnoreMouseEvents(!0, { forward: !0 }), z(!1), r.showInactive()) : t === "setup" ? (b(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!0), r.setSkipTaskbar(!1), r.setSize(980, 760), r.center(), r.show()) : t === "panel" ? (b(!1), r.setIgnoreMouseEvents(!1), r.setAlwaysOnTop(!1), r.setFullScreen(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(760, 840), r.center(), r.show(), r.focus()) : (b(!0), r.setIgnoreMouseEvents(!1), r.setFullScreen(!1), r.setAlwaysOnTop(!1), r.setResizable(!1), r.setSkipTaskbar(!1), r.setSize(680, 780), r.center(), r.show(), r.focus()));
}
function We() {
  !r || r.isDestroyed() || U !== "hud" || (z(!0), r.showInactive(), r.setAlwaysOnTop(!0, "screen-saver"));
}
function Je() {
  !r || r.isDestroyed() || U !== "hud" || z(!1);
}
function Ye() {
  const t = [
    f.join(process.resourcesPath || "", "build", "icon.png"),
    f.join(N, "..", "build", "icon.png")
  ];
  for (const e of t)
    try {
      if (w(e)) {
        const n = V.createFromPath(e);
        if (!n.isEmpty()) return n.resize({ width: 16, height: 16 });
      }
    } catch {
    }
  return V.createEmpty();
}
function I() {
  !r || r.isDestroyed() || (r.webContents.send("senti:open-settings"), O("panel"), r.show(), r.focus());
}
function Ke() {
  if (!S)
    try {
      S = new he(Ye()), S.setToolTip("Senti — listening for you"), S.setContextMenu(
        me.buildFromTemplate([
          { label: "Open Senti (Settings)", click: () => I() },
          { type: "separator" },
          {
            label: "Quit Senti",
            click: () => {
              B = !0, u.quit();
            }
          }
        ])
      ), S.on("click", () => I());
    } catch {
    }
}
function Xe(t) {
  O(t ? "setup" : "signin");
}
l.handle("senti:set-setup-mode", (t, e) => (Xe(!!e), !0));
l.handle("senti:set-window-mode", (t, e) => e === "signin" || e === "setup" || e === "hud" || e === "panel" ? (O(e), e === "hud" && Ke(), !0) : !1);
l.handle("senti:hud-show", () => (We(), !0));
l.handle("senti:hud-hide", () => (Je(), !0));
l.handle("senti:lock", () => {
  O("signin");
});
l.handle("senti:quit", () => A ? !1 : (u.quit(), !0));
