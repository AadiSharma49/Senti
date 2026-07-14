import { existsSync as b, mkdirSync as _, writeFileSync as T, unlinkSync as F, readFileSync as V } from "fs";
import D from "http";
import L from "os";
import O from "electron";
import d from "path";
import { fileURLToPath as q } from "url";
const { app: n, BrowserWindow: S, screen: A, ipcMain: c, globalShortcut: h, safeStorage: p } = O, U = q(import.meta.url), E = d.dirname(U), g = process.env.VITE_DEV_SERVER_URL, v = "http://localhost:5173";
let e = null;
const u = () => d.join(n.getPath("userData"), "device.token");
function P(t) {
  try {
    return _(d.dirname(u()), { recursive: !0 }), p.isEncryptionAvailable() ? (T(u(), p.encryptString(t)), !0) : !1;
  } catch {
    return !1;
  }
}
function R() {
  try {
    return !b(u()) || !p.isEncryptionAvailable() ? null : p.decryptString(V(u()));
  } catch {
    return null;
  }
}
function I() {
  try {
    b(u()) && F(u());
  } catch {
  }
}
async function $(t) {
  const { baseUrl: a, path: o, method: r = "GET", body: s, auth: f = !0 } = t;
  if (!/^https?:\/\//i.test(a) || !o.startsWith("/api/device/"))
    return { ok: !1, status: 400, data: { error: "Blocked request" } };
  const i = { "Content-Type": "application/json" };
  if (f) {
    const l = R();
    if (!l) return { ok: !1, status: 401, data: { error: "This device is not linked" } };
    i.Authorization = `Bearer ${l}`;
  }
  try {
    const l = await fetch(`${a}${o}`, {
      method: r,
      headers: i,
      body: s === void 0 ? void 0 : JSON.stringify(s)
    }), y = await l.json().catch(() => null);
    return { ok: l.ok, status: l.status, data: y };
  } catch (l) {
    return {
      ok: !1,
      status: 0,
      data: { error: l instanceof Error ? l.message : "Network error" }
    };
  }
}
let m = !0;
const C = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], x = "CommandOrControl+Alt+Shift+Q";
function j() {
  for (const t of C)
    try {
      h.register(t, () => {
      });
    } catch {
    }
}
function z() {
  for (const t of C)
    try {
      h.isRegistered(t) && h.unregister(t);
    } catch {
    }
}
function k(t) {
  m = t, t ? j() : z();
}
function B(t, a = 15e3) {
  return new Promise((o, r) => {
    const s = Date.now(), f = () => {
      D.get(t, (y) => {
        y.statusCode === 200 ? o() : i();
      }).on("error", i);
    }, i = () => {
      Date.now() - s > a ? r(new Error(`Vite dev server not reachable at ${t}`)) : setTimeout(f, 300);
    };
    f();
  });
}
function w() {
  const { width: t, height: a } = A.getPrimaryDisplay().workAreaSize, o = d.join(E, "preload.cjs");
  if (e = new S({
    width: t,
    height: a,
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
      preload: o,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), g)
    e.loadURL(v).catch((r) => {
      console.error("[Electron] Failed to load dev server:", r.message);
    });
  else {
    const r = d.join(E, "../dist/index.html");
    b(r) ? e.loadFile(r).catch((s) => {
      console.error("[Electron] Failed to load production file:", s.message);
    }) : console.error("[Electron] Production build not found at:", r);
  }
  e.webContents.on("did-finish-load", () => {
    var r, s;
    e == null || e.show(), e == null || e.focus(), g && ((s = (r = e == null ? void 0 : e.webContents) == null ? void 0 : r.openDevTools) == null || s.call(r));
  }), e.webContents.on("did-fail-load", (r, s, f, i, l) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: f, validatedURL: i, isMainFrame: l });
  }), e.webContents.on("console-message", (r, s, f) => {
    const i = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${i}] ${f}`);
  }), e.webContents.on("render-process-gone", (r, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (r) => {
    r.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("close", (r) => {
    m && (r.preventDefault(), e == null || e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function G() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
n.requestSingleInstanceLock() ? n.on("second-instance", () => {
  e && !e.isDestroyed() && (e.show(), e.focus());
}) : n.quit();
n.whenReady().then(async () => {
  if (g)
    try {
      await B(v);
    } catch (t) {
      console.error("[Electron] Vite dev server failed to start:", t), n.quit();
      return;
    }
  w(), G(), k(!0);
  try {
    h.register(x, () => {
      m = !1, n.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && n.isPackaged && n.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
n.on("activate", () => {
  S.getAllWindows().length === 0 ? w() : (e == null || e.show(), e == null || e.focus());
});
n.on("window-all-closed", () => {
  process.platform !== "darwin" && n.quit();
});
n.on("before-quit", () => {
  e = null;
});
n.on("will-quit", () => {
  h.unregisterAll();
});
c.handle("senti:token-set", (t, a) => typeof a != "string" || !a.trim() ? !1 : P(a.trim()));
c.handle("senti:token-clear", () => (I(), !0));
c.handle("senti:token-present", () => !!R());
c.handle("senti:api", (t, a) => {
  const o = a ?? {};
  return typeof o.baseUrl != "string" || typeof o.path != "string" ? { ok: !1, status: 400, data: { error: "Bad request" } } : $({
    baseUrl: o.baseUrl,
    path: o.path,
    method: typeof o.method == "string" ? o.method : "GET",
    body: o.body,
    auth: o.auth !== !1
  });
});
c.handle("senti:get-platform", () => process.platform);
c.handle("senti:device-info", () => ({
  hostname: L.hostname(),
  platform: process.platform
}));
c.handle("senti:set-lock-state", (t, a) => {
  k(!!a);
});
c.handle("senti:lock", () => {
  k(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
c.handle("senti:quit", () => m ? !1 : (n.quit(), !0));
