import { existsSync as C } from "fs";
import _ from "http";
import w from "os";
import y from "electron";
import p from "path";
import { fileURLToPath as V } from "url";
const { app: s, BrowserWindow: R, screen: F, ipcMain: a, globalShortcut: i } = y, L = V(import.meta.url), E = p.dirname(L), d = process.env.VITE_DEV_SERVER_URL, g = "http://localhost:5173";
let e = null, f = !0;
const b = [
  "Alt+Tab",
  "Alt+F4",
  "Alt+Escape",
  "CommandOrControl+W",
  "CommandOrControl+Shift+W",
  "CommandOrControl+Shift+Escape",
  // Task Manager (best-effort; OS may still win)
  "Super"
  // Win key (best-effort)
], O = "CommandOrControl+Alt+Shift+Q";
function D() {
  for (const o of b)
    try {
      i.register(o, () => {
      });
    } catch {
    }
}
function T() {
  for (const o of b)
    try {
      i.isRegistered(o) && i.unregister(o);
    } catch {
    }
}
function h(o) {
  f = o, o ? D() : T();
}
function k(o, c = 15e3) {
  return new Promise((u, t) => {
    const r = Date.now(), n = () => {
      _.get(o, (v) => {
        v.statusCode === 200 ? u() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - r > c ? t(new Error(`Vite dev server not reachable at ${o}`)) : setTimeout(n, 300);
    };
    n();
  });
}
function S() {
  const { width: o, height: c } = F.getPrimaryDisplay().workAreaSize, u = p.join(E, "preload.cjs");
  if (e = new R({
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
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), d)
    e.loadURL(g).catch((t) => {
      console.error("[Electron] Failed to load dev server:", t.message);
    });
  else {
    const t = p.join(E, "../dist/index.html");
    C(t) ? e.loadFile(t).catch((r) => {
      console.error("[Electron] Failed to load production file:", r.message);
    }) : console.error("[Electron] Production build not found at:", t);
  }
  e.webContents.on("did-finish-load", () => {
    var t, r;
    e == null || e.show(), e == null || e.focus(), d && ((r = (t = e == null ? void 0 : e.webContents) == null ? void 0 : t.openDevTools) == null || r.call(t));
  }), e.webContents.on("did-fail-load", (t, r, n, l, m) => {
    console.error("[Electron] Renderer load failed:", { errorCode: r, errorDescription: n, validatedURL: l, isMainFrame: m });
  }), e.webContents.on("console-message", (t, r, n) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][r] || "LOG";
    console.log(`[Renderer:${l}] ${n}`);
  }), e.webContents.on("render-process-gone", (t, r) => {
    console.error("[Electron] Renderer process gone:", r);
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
function A() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
s.whenReady().then(async () => {
  if (d)
    try {
      await k(g);
    } catch (o) {
      console.error("[Electron] Vite dev server failed to start:", o), s.quit();
      return;
    }
  S(), A(), h(!0);
  try {
    i.register(O, () => {
      f = !1, s.exit(0);
    });
  } catch {
  }
  process.platform === "win32" && s.setLoginItemSettings({ openAtLogin: !0 });
});
s.on("activate", () => {
  R.getAllWindows().length === 0 ? S() : (e == null || e.show(), e == null || e.focus());
});
s.on("window-all-closed", () => {
  process.platform !== "darwin" && s.quit();
});
s.on("before-quit", () => {
  e = null;
});
s.on("will-quit", () => {
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
a.handle("senti:quit", () => f ? !1 : (s.quit(), !0));
