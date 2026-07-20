import { existsSync as C, readFileSync as T, mkdirSync as O, writeFileSync as A, unlinkSync as z } from "fs";
import D from "http";
import B from "os";
import $ from "electron";
import f from "path";
import { fileURLToPath as H } from "url";
const { app: i, BrowserWindow: x, screen: p, ipcMain: c, globalShortcut: m, safeStorage: v, session: _ } = $, M = H(import.meta.url), F = f.dirname(M), w = process.env.VITE_DEV_SERVER_URL, L = "http://localhost:5173";
let e = null, R = "", S = [];
const N = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;height:100%;background:#070a0e;overflow:hidden;
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;cursor:none}
  .w{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
  .orb{width:74px;height:74px;border-radius:50%;border:2px solid rgba(0,212,255,.55);
    box-shadow:0 0 34px rgba(0,212,255,.28) inset,0 0 44px rgba(0,212,255,.16);
    animation:p 2.6s ease-in-out infinite}
  @keyframes p{0%,100%{transform:scale(.94);opacity:.6}50%{transform:scale(1.04);opacity:1}}
  .t{color:#7e93a6;font-size:12px;letter-spacing:.34em;text-transform:uppercase}
</style></head><body><div class="w"><div class="orb"></div>
<div class="t">Locked by Senti</div></div></body></html>`);
function U() {
  for (const t of S)
    try {
      t.isDestroyed() || (t.setClosable(!0), t.destroy());
    } catch {
    }
  S = [];
}
function G() {
  U();
  const t = p.getPrimaryDisplay().id;
  for (const r of p.getAllDisplays())
    if (r.id !== t)
      try {
        const s = new x({
          x: r.bounds.x,
          y: r.bounds.y,
          width: r.bounds.width,
          height: r.bounds.height,
          frame: !1,
          resizable: !1,
          movable: !1,
          minimizable: !1,
          maximizable: !1,
          closable: !1,
          // Never take keyboard focus — the PIN box on the primary lock keeps it.
          focusable: !1,
          skipTaskbar: !0,
          alwaysOnTop: !0,
          // NOT fullscreen: on Windows `fullscreen:true` goes fullscreen on the
          // PRIMARY display (behind the lock), not the target monitor. Exact
          // bounds cover the whole second screen, taskbar included.
          enableLargerThanScreen: !0,
          backgroundColor: "#070a0e",
          show: !1,
          webPreferences: { contextIsolation: !0, nodeIntegration: !1 }
        });
        s.setAlwaysOnTop(!0, "screen-saver"), s.setVisibleOnAllWorkspaces(!0), s.setBounds(r.bounds), s.loadURL(N), s.once("ready-to-show", () => {
          s.setBounds(r.bounds), s.showInactive(), s.moveTop();
        }), S.push(s);
      } catch {
      }
}
function b() {
  if (!y) {
    U();
    return;
  }
  const t = Math.max(0, p.getAllDisplays().length - 1);
  S.filter((s) => !s.isDestroyed()).length === t && t > 0 || G();
}
const J = {
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
}, K = 47615;
function Q(t) {
  return new Promise((r, s) => {
    const o = D.createServer((l, n) => {
      try {
        let d = decodeURIComponent((l.url || "/").split("?")[0]);
        (d === "/" || d === "") && (d = "/index.html");
        const P = f.normalize(d).replace(/^([/\\])+/, ""), g = f.join(t, P);
        if (!g.startsWith(t) || !C(g)) {
          n.writeHead(404), n.end("Not found");
          return;
        }
        const q = T(g);
        n.writeHead(200, {
          "Content-Type": J[f.extname(g).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), n.end(q);
      } catch {
        n.writeHead(500), n.end("Error");
      }
    });
    let a = K, u = 0;
    o.on("error", (l) => {
      l.code === "EADDRINUSE" && u < 12 ? (u++, a++, setTimeout(() => o.listen(a, "127.0.0.1"), 40)) : s(l);
    }), o.on("listening", () => r(`http://127.0.0.1:${a}`)), o.listen(a, "127.0.0.1");
  });
}
const h = () => f.join(i.getPath("userData"), "device.token");
function Y(t) {
  try {
    return O(f.dirname(h()), { recursive: !0 }), v.isEncryptionAvailable() ? (A(h(), v.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function j() {
  try {
    return !C(h()) || !v.isEncryptionAvailable() ? null : v.decryptString(T(h()));
  } catch {
    return null;
  }
}
function X() {
  try {
    C(h()) && z(h());
  } catch {
  }
}
const k = () => f.join(i.getPath("userData"), "setup.json");
function Z() {
  var t;
  try {
    return C(k()) ? ((t = JSON.parse(T(k(), "utf8"))) == null ? void 0 : t.setupCompleted) === !0 : !1;
  } catch {
    return !1;
  }
}
function W(t) {
  try {
    O(f.dirname(k()), { recursive: !0 }), A(k(), JSON.stringify({ setupCompleted: !!t }));
  } catch {
  }
}
async function ee(t) {
  const { baseUrl: r, path: s, method: o = "GET", body: a, auth: u = !0 } = t;
  if (!/^https?:\/\//i.test(r) || !s.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (u) {
    const n = j();
    if (!n) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${n}`;
  }
  try {
    const n = await fetch(`${r}${s}`, {
      method: o,
      headers: l,
      body: a === void 0 ? void 0 : JSON.stringify(a)
    }), d = await n.json().catch(() => null);
    return { ok: n.ok, status: n.status, data: d };
  } catch (n) {
    return {
      ok: !1,
      status: 0,
      data: { error: n instanceof Error ? n.message : "Network error" }
    };
  }
}
let y = !0;
const I = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], te = "CommandOrControl+Alt+Shift+Q";
function re() {
  for (const t of I)
    try {
      m.register(t, () => {
      });
    } catch {
    }
}
function se() {
  for (const t of I)
    try {
      m.isRegistered(t) && m.unregister(t);
    } catch {
    }
}
function E(t) {
  y = t, t ? re() : se(), b();
}
function oe(t, r = 15e3) {
  return new Promise((s, o) => {
    const a = Date.now(), u = () => {
      D.get(t, (d) => {
        d.statusCode === 200 ? s() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - a > r ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(u, 300);
    };
    u();
  });
}
function V() {
  const { width: t, height: r } = p.getPrimaryDisplay().workAreaSize, s = f.join(F, "preload.cjs");
  e = new x({
    width: t,
    height: r,
    fullscreen: !0,
    frame: !1,
    transparent: !1,
    resizable: !1,
    maximizable: !1,
    minimizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    thickFrame: !1,
    show: !1,
    webPreferences: {
      preload: s,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), e.setAlwaysOnTop(!0, "screen-saver"), w ? e.loadURL(L).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : R ? e.loadURL(R).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), e.webContents.on("did-finish-load", () => {
    var o, a;
    e == null || e.show(), e == null || e.focus(), w && ((a = (o = e == null ? void 0 : e.webContents) == null ? void 0 : o.openDevTools) == null || a.call(o));
  }), e.webContents.on("did-fail-load", (o, a, u, l, n) => {
    console.error("[Electron] Renderer load failed:", { errorCode: a, errorDescription: u, validatedURL: l, isMainFrame: n });
  }), e.webContents.on("console-message", (o, a, u) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][a] || "LOG";
    console.log(`[Renderer:${l}] ${u}`);
  }), e.webContents.on("render-process-gone", (o, a) => {
    console.error("[Electron] Renderer process gone:", a);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (o) => {
    o.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("close", (o) => {
    y && (o.preventDefault(), e == null || e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function ne() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
i.requestSingleInstanceLock() ? i.on("second-instance", () => {
  e && !e.isDestroyed() && (e.show(), e.focus());
}) : i.quit();
i.whenReady().then(async () => {
  if (w)
    try {
      await oe(L);
    } catch (r) {
      console.error("[Electron] Vite dev server failed to start:", r), i.quit();
      return;
    }
  const t = (r) => r === "media" || r === "microphone" || r === "audioCapture";
  if (_.defaultSession.setPermissionRequestHandler((r, s, o) => {
    o(t(s));
  }), _.defaultSession.setPermissionCheckHandler((r, s) => t(s)), !w)
    try {
      R = await Q(f.join(F, "../dist"));
    } catch (r) {
      console.error("[Electron] Failed to start static server:", r), i.quit();
      return;
    }
  V(), ne(), p.on("display-added", () => b()), p.on("display-removed", () => b()), p.on("display-metrics-changed", () => b()), E(!0);
  try {
    m.register(te, () => {
      y = !1, i.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && i.isPackaged && i.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
i.on("activate", () => {
  x.getAllWindows().length === 0 ? V() : (e == null || e.show(), e == null || e.focus());
});
i.on("window-all-closed", () => {
  process.platform !== "darwin" && i.quit();
});
i.on("before-quit", () => {
  e = null;
});
i.on("will-quit", () => {
  m.unregisterAll();
});
c.handle("senti:token-set", (t, r) => typeof r != "string" || !r.trim() ? !1 : Y(r.trim()));
c.handle("senti:token-clear", () => (X(), !0));
c.handle("senti:token-present", () => !!j());
c.on("senti:get-setup", (t) => {
  t.returnValue = Z();
});
c.handle("senti:set-setup", (t, r) => (W(!!r), !0));
c.handle("senti:api", (t, r) => {
  const s = r ?? {};
  return typeof s.baseUrl != "string" || typeof s.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : ee({
    baseUrl: s.baseUrl,
    path: s.path,
    method: typeof s.method == "string" ? s.method : "GET",
    body: s.body,
    auth: s.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: B.hostname(),
  platform: process.platform
}));
c.handle("senti:set-lock-state", (t, r) => {
  E(!!r);
});
function ae(t) {
  !e || e.isDestroyed() || (t ? (E(!1), e.setAlwaysOnTop(!1), e.setFullScreen(!1), e.setResizable(!0), e.setSkipTaskbar(!1), e.setSize(980, 760), e.center()) : (e.setResizable(!1), e.setSkipTaskbar(!0), e.setAlwaysOnTop(!0, "screen-saver"), e.setFullScreen(!0), e.focus()));
}
c.handle("senti:set-setup-mode", (t, r) => (ae(!!r), !0));
c.handle("senti:lock", () => {
  E(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
c.handle("senti:quit", () => y ? !1 : (i.quit(), !0));
