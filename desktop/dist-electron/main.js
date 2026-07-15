import { existsSync as S, readFileSync as w, mkdirSync as L, writeFileSync as U, unlinkSync as q } from "fs";
import k from "http";
import V from "os";
import D from "electron";
import d from "path";
import { fileURLToPath as O } from "url";
const { app: a, BrowserWindow: R, screen: A, ipcMain: f, globalShortcut: h, safeStorage: m, session: E } = D, P = O(import.meta.url), C = d.dirname(P), g = process.env.VITE_DEV_SERVER_URL, _ = "http://localhost:5173";
let e = null, v = "";
const I = {
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
};
function $(r) {
  return new Promise((t, s) => {
    const o = k.createServer((n, i) => {
      try {
        let l = decodeURIComponent((n.url || "/").split("?")[0]);
        (l === "/" || l === "") && (l = "/index.html");
        const c = d.normalize(l).replace(/^([/\\])+/, ""), u = d.join(r, c);
        if (!u.startsWith(r) || !S(u)) {
          i.writeHead(404), i.end("Not found");
          return;
        }
        const F = w(u);
        i.writeHead(200, {
          "Content-Type": I[d.extname(u).toLowerCase()] || "application/octet-stream",
          "Cache-Control": "no-store"
        }), i.end(F);
      } catch {
        i.writeHead(500), i.end("Error");
      }
    });
    o.on("error", s), o.listen(0, "127.0.0.1", () => {
      const n = o.address();
      n && typeof n == "object" ? t(`http://127.0.0.1:${n.port}`) : s(new Error("static server failed to bind"));
    });
  });
}
const p = () => d.join(a.getPath("userData"), "device.token");
function z(r) {
  try {
    return L(d.dirname(p()), { recursive: !0 }), m.isEncryptionAvailable() ? (U(p(), m.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function T() {
  try {
    return !S(p()) || !m.isEncryptionAvailable() ? null : m.decryptString(w(p()));
  } catch {
    return null;
  }
}
function B() {
  try {
    S(p()) && q(p());
  } catch {
  }
}
async function H(r) {
  const { baseUrl: t, path: s, method: o = "GET", body: n, auth: i = !0 } = r;
  if (!/^https?:\/\//i.test(t) || !s.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (i) {
    const c = T();
    if (!c) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${c}`;
  }
  try {
    const c = await fetch(`${t}${s}`, {
      method: o,
      headers: l,
      body: n === void 0 ? void 0 : JSON.stringify(n)
    }), u = await c.json().catch(() => null);
    return { ok: c.ok, status: c.status, data: u };
  } catch (c) {
    return {
      ok: !1,
      status: 0,
      data: { error: c instanceof Error ? c.message : "Network error" }
    };
  }
}
let y = !0;
const x = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], M = "CommandOrControl+Alt+Shift+Q";
function N() {
  for (const r of x)
    try {
      h.register(r, () => {
      });
    } catch {
    }
}
function G() {
  for (const r of x)
    try {
      h.isRegistered(r) && h.unregister(r);
    } catch {
    }
}
function b(r) {
  y = r, r ? N() : G();
}
function J(r, t = 15e3) {
  return new Promise((s, o) => {
    const n = Date.now(), i = () => {
      k.get(r, (u) => {
        u.statusCode === 200 ? s() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - n > t ? o(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(i, 300);
    };
    i();
  });
}
function j() {
  const { width: r, height: t } = A.getPrimaryDisplay().workAreaSize, s = d.join(C, "preload.cjs");
  e = new R({
    width: r,
    height: t,
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
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), g ? e.loadURL(_).catch((o) => {
    console.error("[Electron] Failed to load dev server:", o.message);
  }) : v ? e.loadURL(v).catch((o) => {
    console.error("[Electron] Failed to load prod server:", o.message);
  }) : console.error("[Electron] Static server not started; cannot load UI."), e.webContents.on("did-finish-load", () => {
    var o, n;
    e == null || e.show(), e == null || e.focus(), g && ((n = (o = e == null ? void 0 : e.webContents) == null ? void 0 : o.openDevTools) == null || n.call(o));
  }), e.webContents.on("did-fail-load", (o, n, i, l, c) => {
    console.error("[Electron] Renderer load failed:", { errorCode: n, errorDescription: i, validatedURL: l, isMainFrame: c });
  }), e.webContents.on("console-message", (o, n, i) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][n] || "LOG";
    console.log(`[Renderer:${l}] ${i}`);
  }), e.webContents.on("render-process-gone", (o, n) => {
    console.error("[Electron] Renderer process gone:", n);
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
function K() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
a.requestSingleInstanceLock() ? a.on("second-instance", () => {
  e && !e.isDestroyed() && (e.show(), e.focus());
}) : a.quit();
a.whenReady().then(async () => {
  if (g)
    try {
      await J(_);
    } catch (t) {
      console.error("[Electron] Vite dev server failed to start:", t), a.quit();
      return;
    }
  const r = (t) => t === "media" || t === "microphone" || t === "audioCapture";
  if (E.defaultSession.setPermissionRequestHandler((t, s, o) => {
    o(r(s));
  }), E.defaultSession.setPermissionCheckHandler((t, s) => r(s)), !g)
    try {
      v = await $(d.join(C, "../dist"));
    } catch (t) {
      console.error("[Electron] Failed to start static server:", t), a.quit();
      return;
    }
  j(), K(), b(!0);
  try {
    h.register(M, () => {
      y = !1, a.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && a.isPackaged && a.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
a.on("activate", () => {
  R.getAllWindows().length === 0 ? j() : (e == null || e.show(), e == null || e.focus());
});
a.on("window-all-closed", () => {
  process.platform !== "darwin" && a.quit();
});
a.on("before-quit", () => {
  e = null;
});
a.on("will-quit", () => {
  h.unregisterAll();
});
f.handle("senti:token-set", (r, t) => typeof t != "string" || !t.trim() ? !1 : z(t.trim()));
f.handle("senti:token-clear", () => (B(), !0));
f.handle("senti:token-present", () => !!T());
f.handle("senti:api", (r, t) => {
  const s = t ?? {};
  return typeof s.baseUrl != "string" || typeof s.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : H({
    baseUrl: s.baseUrl,
    path: s.path,
    method: typeof s.method == "string" ? s.method : "GET",
    body: s.body,
    auth: s.auth !== !1
  });
});
f.handle("senti:get-platform", () => process.platform);
f.handle("senti:device-info", () => ({
  hostname: V.hostname(),
  platform: process.platform
}));
f.handle("senti:set-lock-state", (r, t) => {
  b(!!t);
});
f.handle("senti:lock", () => {
  b(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
f.handle("senti:quit", () => y ? !1 : (a.quit(), !0));
