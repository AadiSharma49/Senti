import { existsSync as C } from "fs";
import _ from "http";
import w from "os";
import y from "electron";
import d from "path";
import { fileURLToPath as V } from "url";
const { app: r, BrowserWindow: E, screen: L, ipcMain: a, globalShortcut: i } = y, D = V(import.meta.url), g = d.dirname(D), p = process.env.VITE_DEV_SERVER_URL, R = "http://localhost:5173";
let e = null, f = !0;
const S = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], F = "CommandOrControl+Alt+Shift+Q";
function O() {
  for (const o of S)
    try {
      i.register(o, () => {
      });
    } catch {
    }
}
function k() {
  for (const o of S)
    try {
      i.isRegistered(o) && i.unregister(o);
    } catch {
    }
}
function h(o) {
  f = o, o ? O() : k();
}
function T(o, c = 15e3) {
  return new Promise((u, t) => {
    const s = Date.now(), n = () => {
      _.get(o, (v) => {
        v.statusCode === 200 ? u() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - s > c ? t(new Error(`Vite dev server not reachable at ${o}`)) : setTimeout(n, 300);
    };
    n();
  });
}
function b() {
  const { width: o, height: c } = L.getPrimaryDisplay().workAreaSize, u = d.join(g, "preload.cjs");
  if (e = new E({
    width: o,
    height: c,
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
      preload: u,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), p)
    e.loadURL(R).catch((t) => {
      console.error("[Electron] Failed to load dev server:", t.message);
    });
  else {
    const t = d.join(g, "../dist/index.html");
    C(t) ? e.loadFile(t).catch((s) => {
      console.error("[Electron] Failed to load production file:", s.message);
    }) : console.error("[Electron] Production build not found at:", t);
  }
  e.webContents.on("did-finish-load", () => {
    var t, s;
    e == null || e.show(), e == null || e.focus(), p && ((s = (t = e == null ? void 0 : e.webContents) == null ? void 0 : t.openDevTools) == null || s.call(t));
  }), e.webContents.on("did-fail-load", (t, s, n, l, m) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: n, validatedURL: l, isMainFrame: m });
  }), e.webContents.on("console-message", (t, s, n) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][s] || "LOG";
    console.log(`[Renderer:${l}] ${n}`);
  }), e.webContents.on("render-process-gone", (t, s) => {
    console.error("[Electron] Renderer process gone:", s);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (t) => {
    t.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("close", (t) => {
    f && (t.preventDefault(), e == null || e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function q() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
r.requestSingleInstanceLock() ? r.on("second-instance", () => {
  e && !e.isDestroyed() && (e.show(), e.focus());
}) : r.quit();
r.whenReady().then(async () => {
  if (p)
    try {
      await T(R);
    } catch (o) {
      console.error("[Electron] Vite dev server failed to start:", o), r.quit();
      return;
    }
  b(), q(), h(!0);
  try {
    i.register(F, () => {
      f = !1, r.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && r.isPackaged && r.setLoginItemSettings({ openAtLogin: !0, args: [] });
});
r.on("activate", () => {
  E.getAllWindows().length === 0 ? b() : (e == null || e.show(), e == null || e.focus());
});
r.on("window-all-closed", () => {
  process.platform !== "darwin" && r.quit();
});
r.on("before-quit", () => {
  e = null;
});
r.on("will-quit", () => {
  i.unregisterAll();
});
a.handle("senti:get-platform", () => process.platform);
a.handle("senti:device-info", () => ({
  hostname: w.hostname(),
  platform: process.platform
}));
a.handle("senti:set-lock-state", (o, c) => {
  h(!!c);
});
a.handle("senti:lock", () => {
  h(!0), e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
a.handle("senti:quit", () => f ? !1 : (r.quit(), !0));
