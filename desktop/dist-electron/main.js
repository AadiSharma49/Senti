import { existsSync as R, readFileSync as T, mkdirSync as V, writeFileSync as q, unlinkSync as P } from "fs";
import _ from "http";
import z from "os";
import $ from "electron";
import d from "path";
import { fileURLToPath as B } from "url";
const { app: i, BrowserWindow: C, screen: p, ipcMain: f, globalShortcut: m, safeStorage: v, session: x } = $, H = B(import.meta.url), A = d.dirname(H), w = process.env.VITE_DEV_SERVER_URL, O = "http://localhost:5173";
let e = null, k = "", E = [];
const M = "data:text/html;charset=utf-8," + encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8">
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
function D() {
  for (const t of E)
    try {
      t.isDestroyed() || (t.setClosable(!0), t.destroy());
    } catch {
    }
  E = [];
}
function N() {
  D();
  const t = p.getPrimaryDisplay().id;
  for (const s of p.getAllDisplays())
    if (s.id !== t)
      try {
        const r = new C({
          x: s.bounds.x,
          y: s.bounds.y,
          width: s.bounds.width,
          height: s.bounds.height,
          frame: !1,
          resizable: !1,
          movable: !1,
          minimizable: !1,
          maximizable: !1,
          closable: !1,
          skipTaskbar: !0,
          alwaysOnTop: !0,
          fullscreen: !0,
          show: !1,
          webPreferences: { contextIsolation: !0, nodeIntegration: !1 }
        });
        r.setAlwaysOnTop(!0, "screen-saver"), r.setVisibleOnAllWorkspaces(!0), r.loadURL(M), r.once("ready-to-show", () => r.show()), E.push(r);
      } catch {
      }
}
function b() {
  y ? N() : D();
}
const G = {
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
}, J = 47615;
function K(t) {
  return new Promise((s, r) => {
    const o = _.createServer((l, n) => {
      try {
        let u = decodeURIComponent((l.url || "/").split("?")[0]);
        (u === "/" || u === "") && (u = "/index.html");
        const I = d.normalize(u).replace(/^([/\\])+/, ""), g = d.join(t, I);
        if (!g.startsWith(t) || !R(g)) {
          n.writeHead(404), n.end("Not found");
          return;
        }
        const j = T(g);
        n.writeHead(200, {
          "Content-Type": G[d.extname(g).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), n.end(j);
      } catch {
        n.writeHead(500), n.end("Error");
      }
    });
    let a = J, c = 0;
    o.on("error", (l) => {
      l.code === "EADDRINUSE" && c < 12 ? (c++, a++, setTimeout(() => o.listen(a, "127.0.0.1"), 40)) : r(l);
    }), o.on("listening", () => s(`http://127.0.0.1:${a}`)), o.listen(a, "127.0.0.1");
  });
}
const h = () => d.join(i.getPath("userData"), "device.token");
function Q(t) {
  try {
    return V(d.dirname(h()), { recursive: !0 }), v.isEncryptionAvailable() ? (q(h(), v.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function U() {
  try {
    return !R(h()) || !v.isEncryptionAvailable() ? null : v.decryptString(T(h()));
  } catch {
    return null;
  }
}
function Y() {
  try {
    R(h()) && P(h());
  } catch {
  }
}
async function X(t) {
  const { baseUrl: s, path: r, method: o = "GET", body: a, auth: c = !0 } = t;
  if (!/^https?:\/\//i.test(s) || !r.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (c) {
    const n = U();
    if (!n) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${n}`;
  }
  try {
    const n = await fetch(`${s}${r}`, {
      method: o,
      headers: l,
      body: a === void 0 ? void 0 : JSON.stringify(a)
    }), u = await n.json().catch(() => null);
    return { ok: n.ok, status: n.status, data: u };
  } catch (n) {
    return {
      ok: !1,
      status: 0,
      data: { error: n instanceof Error ? n.message : "Network error" }
    };
  }
}
let y = !0;
const L = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], Z = "CommandOrControl+Alt+Shift+Q";
function W() {
  for (const t of L)
    try {
      m.register(t, () => {
      });
    } catch {
    }
}
function ee() {
  for (const t of L)
    try {
      m.isRegistered(t) && m.unregister(t);
    } catch {
    }
}
function S(t) {
  y = t, t ? W() : ee(), b();
}
function te(t, s = 15e3) {
  return new Promise((r, o) => {
    const a = Date.now(), c = () => {
      _.get(t, (u) => {
        u.statusCode === 200 ? r() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - a > s ? o(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(c, 300);
    };
    c();
  });
}
function F() {
  const { width: t, height: s } = p.getPrimaryDisplay().workAreaSize, r = d.join(A, "preload.cjs");
  e = new C({
    width: t,
    height: s,
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
      preload: r,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), e.setAlwaysOnTop(!0, "screen-saver"), w ? e.loadURL(O).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : k ? e.loadURL(k).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), e.webContents.on("did-finish-load", () => {
    var o, a;
    e == null || e.show(), e == null || e.focus(), w && ((a = (o = e == null ? void 0 : e.webContents) == null ? void 0 : o.openDevTools) == null || a.call(o));
  }), e.webContents.on("did-fail-load", (o, a, c, l, n) => {
    console.error("[Electron] Renderer load failed:", { errorCode: a, errorDescription: c, validatedURL: l, isMainFrame: n });
  }), e.webContents.on("console-message", (o, a, c) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][a] || "LOG";
    console.log(`[Renderer:${l}] ${c}`);
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
function se() {
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
      await te(O);
    } catch (s) {
      console.error("[Electron] Vite dev server failed to start:", s), i.quit();
      return;
    }
  const t = (s) => s === "media" || s === "microphone" || s === "audioCapture";
  if (x.defaultSession.setPermissionRequestHandler((s, r, o) => {
    o(t(r));
  }), x.defaultSession.setPermissionCheckHandler((s, r) => t(r)), !w)
    try {
      k = await K(d.join(A, "../dist"));
    } catch (s) {
      console.error("[Electron] Failed to start static server:", s), i.quit();
      return;
    }
  F(), se(), p.on("display-added", () => b()), p.on("display-removed", () => b()), p.on("display-metrics-changed", () => b()), S(!0);
  try {
    m.register(Z, () => {
      y = !1, i.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && i.isPackaged && i.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
i.on("activate", () => {
  C.getAllWindows().length === 0 ? F() : (e == null || e.show(), e == null || e.focus());
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
f.handle("senti:token-set", (t, s) => typeof s != "string" || !s.trim() ? !1 : Q(s.trim()));
f.handle("senti:token-clear", () => (Y(), !0));
f.handle("senti:token-present", () => !!U());
f.handle("senti:api", (t, s) => {
  const r = s ?? {};
  return typeof r.baseUrl != "string" || typeof r.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : X({
    baseUrl: r.baseUrl,
    path: r.path,
    method: typeof r.method == "string" ? r.method : "GET",
    body: r.body,
    auth: r.auth !== !1
  });
});
f.handle("senti:get-platform", () => process.platform);
f.handle("senti:device-info", () => ({
  hostname: z.hostname(),
  platform: process.platform
}));
f.handle("senti:set-lock-state", (t, s) => {
  S(!!s);
});
function re(t) {
  !e || e.isDestroyed() || (t ? (S(!1), e.setAlwaysOnTop(!1), e.setFullScreen(!1), e.setResizable(!0), e.setSkipTaskbar(!1), e.setSize(980, 760), e.center()) : (e.setResizable(!1), e.setSkipTaskbar(!0), e.setAlwaysOnTop(!0, "screen-saver"), e.setFullScreen(!0), e.focus()));
}
f.handle("senti:set-setup-mode", (t, s) => (re(!!s), !0));
f.handle("senti:lock", () => {
  S(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
f.handle("senti:quit", () => y ? !1 : (i.quit(), !0));
