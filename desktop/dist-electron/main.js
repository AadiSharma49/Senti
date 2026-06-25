import { existsSync as b } from "fs";
import w from "http";
import g from "electron";
import c from "path";
import { fileURLToPath as v } from "url";
const { app: r, BrowserWindow: p, screen: _, ipcMain: f } = g, V = v(import.meta.url), d = c.dirname(V), h = process.env.VITE_DEV_SERVER_URL, m = "http://localhost:5173";
let e = null;
function y(s, a = 15e3) {
  return new Promise((i, o) => {
    const t = Date.now(), n = () => {
      w.get(s, (R) => {
        R.statusCode === 200 ? i() : l();
      }).on("error", l);
    }, l = () => {
      Date.now() - t > a ? o(new Error(`Vite dev server not reachable at ${s}`)) : setTimeout(n, 300);
    };
    n();
  });
}
function E() {
  const { width: s, height: a } = _.getPrimaryDisplay().workAreaSize, i = c.join(d, "preload.cjs");
  if (e = new p({
    width: s,
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
      preload: i,
      contextIsolation: !0,
      nodeIntegration: !1,
      sandbox: !1
    }
  }), e.setVisibleOnAllWorkspaces(!0), e.setMenuBarVisibility(!1), h)
    e.loadURL(m).catch((o) => {
      console.error("[Electron] Failed to load dev server:", o.message);
    });
  else {
    const o = c.join(d, "../dist/index.html");
    b(o) ? e.loadFile(o).catch((t) => {
      console.error("[Electron] Failed to load production file:", t.message);
    }) : console.error("[Electron] Production build not found at:", o);
  }
  e.webContents.on("did-finish-load", () => {
    e == null || e.show(), e == null || e.focus();
  }), e.webContents.on("did-fail-load", (o, t, n, l, u) => {
    console.error("[Electron] Renderer load failed:", { errorCode: t, errorDescription: n, validatedURL: l, isMainFrame: u });
  }), e.webContents.on("console-message", (o, t, n) => {
    const l = ["INFO", "WARN", "ERROR", "DEBUG"][t] || "LOG";
    console.log(`[Renderer:${l}] ${n}`);
  }), e.webContents.on("render-process-gone", (o, t) => {
    console.error("[Electron] Renderer process gone:", t);
  }), e.webContents.on("unresponsive", () => {
    console.error("[Electron] Renderer unresponsive");
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (o) => {
    o.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function F() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
r.whenReady().then(async () => {
  if (h)
    try {
      await y(m);
    } catch (s) {
      console.error("[Electron] Vite dev server failed to start:", s), r.quit();
      return;
    }
  E(), F(), process.platform === "win32" && r.setLoginItemSettings({ openAtLogin: !0 });
});
r.on("activate", () => {
  p.getAllWindows().length === 0 ? E() : (e == null || e.show(), e == null || e.focus());
});
r.on("window-all-closed", () => {
  process.platform !== "darwin" && r.quit();
});
r.on("before-quit", () => {
  e = null;
});
f.handle("senti:get-platform", () => process.platform);
f.handle("senti:lock", () => {
  e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
f.handle("senti:quit", () => {
  r.quit();
});
