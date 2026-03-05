import { contextBridge, ipcRenderer } from "electron";

// Typed API exposed to renderer
const electronAPI = {
  // ── IPC send ──────────────────────────────────────────────────────────────
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data),
  invoke: (channel: string, data?: unknown) => ipcRenderer.invoke(channel, data),

  // ── IPC receive ───────────────────────────────────────────────────────────
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrapped = (_: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    // Return cleanup fn
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
  once: (channel: string, listener: (...args: unknown[]) => void) => {
    ipcRenderer.once(channel, (_, ...args) => listener(...args));
  },
  off: (channel: string, listener: (...args: unknown[]) => void) =>
    ipcRenderer.removeAllListeners(channel),

  // ── File helpers (typed) ──────────────────────────────────────────────────
  saveScript: (content: string, defaultName?: string) =>
    ipcRenderer.send("save-script-content", { content, defaultName }),

  savePng: (dataUrl: string, defaultName?: string) =>
    ipcRenderer.send("save-png", { dataUrl, defaultName }),

  saveCsv: (csv: string, defaultName?: string) =>
    ipcRenderer.send("save-csv", { csv, defaultName }),

  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // ── Environment flags ─────────────────────────────────────────────────────
  isElectron: true,
  platform: process.platform,
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Legacy compat
contextBridge.exposeInMainWorld("ipcRenderer", {
  on:     (...args: Parameters<typeof ipcRenderer.on>) => ipcRenderer.on(...args),
  off:    (...args: Parameters<typeof ipcRenderer.off>) => ipcRenderer.off(...args),
  send:   (...args: Parameters<typeof ipcRenderer.send>) => ipcRenderer.send(...args),
  invoke: (...args: Parameters<typeof ipcRenderer.invoke>) => ipcRenderer.invoke(...args),
});

export type ElectronAPI = typeof electronAPI;
