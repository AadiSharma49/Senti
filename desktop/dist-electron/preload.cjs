"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("senti", {
  platform: () => electron.ipcRenderer.invoke("senti:get-platform"),
  deviceInfo: () => electron.ipcRenderer.invoke("senti:device-info"),
  lock: () => electron.ipcRenderer.invoke("senti:lock"),
  quit: () => electron.ipcRenderer.invoke("senti:quit"),
  setLockState: (locked) => electron.ipcRenderer.invoke("senti:set-lock-state", locked),
  // Backend access — the token is attached in main, never exposed here.
  api: (req) => electron.ipcRenderer.invoke("senti:api", req),
  tokenSet: (token) => electron.ipcRenderer.invoke("senti:token-set", token),
  tokenClear: () => electron.ipcRenderer.invoke("senti:token-clear"),
  tokenPresent: () => electron.ipcRenderer.invoke("senti:token-present")
});
