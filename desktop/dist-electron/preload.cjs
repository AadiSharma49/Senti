"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("senti", {
  platform: () => electron.ipcRenderer.invoke("senti:get-platform"),
  lock: () => electron.ipcRenderer.invoke("senti:lock"),
  quit: () => electron.ipcRenderer.invoke("senti:quit")
});
