var _a, _b, _c, _d, _e, _f;
import { contextBridge, ipcRenderer } from "electron";
console.log("[PRELOAD] loaded");
console.log("[PRELOAD LOADED]");
console.log("[PRELOAD] ipc registered");
const voiceApi = {
  start: () => ipcRenderer.invoke("voice:start"),
  stop: () => ipcRenderer.invoke("voice:stop"),
  transcribe: (payload) => ipcRenderer.invoke("voice:transcribe", payload)
};
console.log("[PRELOAD] voice ipc registered");
contextBridge.exposeInMainWorld("senti", {
  platform: () => ipcRenderer.invoke("senti:get-platform"),
  lock: () => ipcRenderer.invoke("senti:lock"),
  quit: () => ipcRenderer.invoke("senti:quit"),
  onBackendStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("backend:status", listener);
    return () => ipcRenderer.removeListener("backend:status", listener);
  },
  onBackendAlert: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("backend:alert", listener);
    return () => ipcRenderer.removeListener("backend:alert", listener);
  },
  sendToBackend: (channel, data) => {
    ipcRenderer.send("backend:send", { channel, data });
  },
  voice: voiceApi,
  voiceStart: voiceApi.start,
  voiceStop: voiceApi.stop,
  voiceTranscribe: voiceApi.transcribe,
  // Returns a promise that resolves to the temporary MP3 file path for the greeting
  playGreeting: (period) => ipcRenderer.invoke("senti:play-greeting", period),
  // Simple health‑check wrapper for the backend process
  healthCheck: () => ipcRenderer.invoke("senti:backend-health")
});
console.log("[Preload] window.senti exposed", typeof window.senti, typeof ((_b = (_a = window.senti) == null ? void 0 : _a.voice) == null ? void 0 : _b.start), typeof ((_d = (_c = window.senti) == null ? void 0 : _c.voice) == null ? void 0 : _d.stop), typeof ((_f = (_e = window.senti) == null ? void 0 : _e.voice) == null ? void 0 : _f.transcribe));
