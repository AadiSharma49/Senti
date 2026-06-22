import { existsSync as w } from "fs";
import V from "http";
import R from "electron";
import c from "path";
import { fileURLToPath as _ } from "url";
const { app: o, BrowserWindow: p, screen: g, ipcMain: f } = R, v = _(import.meta.url), d = c.dirname(v), h = process.env.VITE_DEV_SERVER_URL, m = "http://localhost:5173";
let e = null;
function y(r, a = 15e3) {
  return new Promise((i, t) => {
    const s = Date.now(), l = () => {
      V.get(r, (b) => {
        b.statusCode === 200 ? i() : n();
      }).on("error", n);
    }, n = () => {
      Date.now() - s > a ? t(new Error(`Vite dev server not reachable at ${r}`)) : setTimeout(l, 300);
    };
    l();
  });
}
function E() {
  const { width: r, height: a } = g.getPrimaryDisplay().workAreaSize, i = c.join(d, "preload.cjs");
  if (e = new p({
    width: r,
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
    e.loadURL(m).catch((t) => {
      console.error("[Electron] Failed to load dev server:", t.message);
    });
  else {
    const t = c.join(d, "../dist/index.html");
    w(t) ? e.loadFile(t).catch((s) => {
      console.error("[Electron] Failed to load production file:", s.message);
    }) : console.error("[Electron] Production build not found at:", t);
  }
  e.webContents.on("did-finish-load", () => {
    e == null || e.show(), e == null || e.focus();
  }), e.webContents.on("did-fail-load", (t, s, l, n, u) => {
    console.error("[Electron] Renderer load failed:", { errorCode: s, errorDescription: l, validatedURL: n, isMainFrame: u });
  }), e.on("blur", () => {
    e && !e.isDestroyed() && e.focus();
  }), e.on("minimize", (t) => {
    t.preventDefault(), e && (e.restore(), e.focus());
  }), e.on("leave-full-screen", () => {
    e && e.setFullScreen(!0);
  });
}
function F() {
  setInterval(() => {
    e && !e.isDestroyed() && (!e.isFocused() && e.isVisible() && e.focus(), e.isFullScreen() || e.setFullScreen(!0));
  }, 500);
}
o.whenReady().then(async () => {
  if (h)
    try {
      await y(m);
    } catch (r) {
      console.error("[Electron] Vite dev server failed to start:", r), o.quit();
      return;
    }
  E(), F(), process.platform === "win32" && o.setLoginItemSettings({ openAtLogin: !0 });
});
o.on("activate", () => {
  p.getAllWindows().length === 0 ? E() : (e == null || e.show(), e == null || e.focus());
});
o.on("window-all-closed", () => {
  process.platform !== "darwin" && o.quit();
});
o.on("before-quit", () => {
  e = null;
});
f.handle("senti:get-platform", () => process.platform);
f.handle("senti:lock", () => {
  e == null || e.show(), e == null || e.focus(), e == null || e.setFullScreen(!0);
});
f.handle("senti:quit", () => {
  o.quit();
});
