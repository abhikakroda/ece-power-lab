import { ipcRenderer, contextBridge } from "electron";
const electronAPI = {
  // ── IPC send ──────────────────────────────────────────────────────────────
  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  // ── IPC receive ───────────────────────────────────────────────────────────
  on: (channel, listener) => {
    const wrapped = (_, ...args) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  once: (channel, listener) => {
    ipcRenderer.once(channel, (_, ...args) => listener(...args));
  },
  off: (channel, listener) => ipcRenderer.removeAllListeners(channel),
  // ── File helpers (typed) ──────────────────────────────────────────────────
  saveScript: (content, defaultName) => ipcRenderer.send("save-script-content", { content, defaultName }),
  savePng: (dataUrl, defaultName) => ipcRenderer.send("save-png", { dataUrl, defaultName }),
  saveCsv: (csv, defaultName) => ipcRenderer.send("save-csv", { csv, defaultName }),
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
  // ── Environment flags ─────────────────────────────────────────────────────
  isElectron: true,
  platform: process.platform
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
contextBridge.exposeInMainWorld("ipcRenderer", {
  on: (...args) => ipcRenderer.on(...args),
  off: (...args) => ipcRenderer.off(...args),
  send: (...args) => ipcRenderer.send(...args),
  invoke: (...args) => ipcRenderer.invoke(...args)
});
//# sourceMappingURL=preload.js.map
