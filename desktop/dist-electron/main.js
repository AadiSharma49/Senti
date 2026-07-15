import { existsSync as S, mkdirSync as T, writeFileSync as F, unlinkSync as V, readFileSync as q } from "fs";
import D from "http";
import L from "os";
import O from "electron";
import d from "path";
import { fileURLToPath as A } from "url";
const { app: a, BrowserWindow: v, screen: U, ipcMain: c, globalShortcut: h, safeStorage: p, session: k } = O, P = A(import.meta.url), E = d.dirname(P), g = process.env.VITE_DEV_SERVER_URL, R = "http://localhost:5173";
let e = null;
const f = () => d.join(a.getPath("userData"), "device.token");
function I(r) {
  try {
    return T(d.dirname(f()), { recursive: !0 }), p.isEncryptionAvailable() ? (F(f(), p.encryptString(r)), !0) : !1;
  } catch {
    return !1;
  }
}
function C() {
  try {
    return !S(f()) || !p.isEncryptionAvailable() ? null : p.decryptString(q(f()));
  } catch {
    return null;
  }
}
function $() {
  try {
    S(f()) && V(f());
  } catch {
  }
}
async function x(r) {
  const { baseUrl: o, path: s, method: t = "GET", body: n, auth: u = !0 } = r;
  if (!/^https?:\/\//i.test(o) || !s.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const l = { "Content-Type": "application/json" };
  if (u) {
    const i = C();
    if (!i) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    l.Authorization = `Bearer ${i}`;
  }
  try {
    const i = await fetch(`${o}${s}`, {
      method: t,
      headers: l,
      body: n === void 0 ? void 0 : JSON.stringify(n)
    }), y = await i.json().catch(() => null);
    return { ok: i.ok, status: i.status, data: y };
  } catch (i) {
    return {
      ok: !1,
      status: 0,
      data: { error: i instanceof Error ? i.message : "Network error" }
    };
  }
}
let m = !0;
const w = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], j = "CommandOrControl+Alt+Shift+Q";
function z() {
  for (const r of w)
    try {
      h.register(r, () => {
      });
    } catch {
    }
}
function B() {
  for (const r of w)
    try {
      h.isRegistered(r) && h.unregister(r);
    } catch {
    }
}
function b(r) {
  m = r, r ? z() : B();
}
function G(r, o = 15e3) {
  return new Promise((s, t) => {
    const n = Date.now(), u = () => {
      D.get(r, (y) => {
        y.statusCode === 200 ? s() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - n > o ? t(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(u, 300);
    };
    u();
  });
}
function _() {
  const { width: r, height: o } = U.getPrimaryDisplay().workAreaSize, s = d.join(E, "preload.cjs");
  if (e = new v({
    width: r,
    height: o,
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
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), g)
    e.loadURL(R).catch((t) => {
      console.error("[Electron] Failed to load dev server:", t.message);
    });
  else {
    const t = d.join(E, "../dist/index.html");
    S(t) ? e.loadFile(t).catch((n) => {
      console.error("[Electron] Failed to load production file:", n.message);
    }) : console.error("[Electron] Production build not found at:", t);
  }
  e.webContents.on("did-finish-load", () => {
    var t, n;
    e == null || e.show(), e == null || e.focus(), g && ((n = (t = e == null ? void 0 : e.webContents) == null ? void 0 : t.openDevTools) == null || n.call(t));
  }), e.webContents.on("did-fail-load", (t, n, u, l, i) => {
    console.error("[Electron] Renderer load failed:", { errorCode: n, errorDescription: u, validatedURL: l, isMainFrame: i });
  }), e.webContents.on("console-message", (t, n, u) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][n] || "LOG";
    console.log(`[Renderer:${l}] ${u}`);
  }), e.webContents.on("render-process-gone", (t, n) => {
    console.error("[Electron] Renderer process gone:", n);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (t) => {
    t.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("close", (t) => {
    m && (t.preventDefault(), e == null || e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function H() {
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
      await G(R);
    } catch (o) {
      console.error("[Electron] Vite dev server failed to start:", o), a.quit();
      return;
    }
  const r = (o) => o === "media" || o === "microphone" || o === "audioCapture";
  k.defaultSession.setPermissionRequestHandler((o, s, t) => {
    t(r(s));
  }), k.defaultSession.setPermissionCheckHandler((o, s) => r(s)), _(), H(), b(!0);
  try {
    h.register(j, () => {
      m = !1, a.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && a.isPackaged && a.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
a.on("activate", () => {
  v.getAllWindows().length === 0 ? _() : (e == null || e.show(), e == null || e.focus());
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
c.handle("senti:token-set", (r, o) => typeof o != "string" || !o.trim() ? !1 : I(o.trim()));
c.handle("senti:token-clear", () => ($(), !0));
c.handle("senti:token-present", () => !!C());
c.handle("senti:api", (r, o) => {
  const s = o ?? {};
  return typeof s.baseUrl != "string" || typeof s.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : x({
    baseUrl: s.baseUrl,
    path: s.path,
    method: typeof s.method == "string" ? s.method : "GET",
    body: s.body,
    auth: s.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: L.hostname(),
  platform: process.platform
}));
c.handle("senti:set-lock-state", (r, o) => {
  b(!!o);
});
c.handle("senti:lock", () => {
  b(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
c.handle("senti:quit", () => m ? !1 : (a.quit(), !0));
