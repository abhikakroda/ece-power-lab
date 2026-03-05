import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  Menu,
  nativeTheme,
  session,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

// ─── ESM-compatible __dirname (works whether bundled as CJS or ESM) ──────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Paths ───────────────────────────────────────────────────────────────────
const DIST = path.join(__dirname, "../dist");
const PUBLIC = path.join(__dirname, "../public");
const ICON = process.platform === "win32"
  ? path.join(PUBLIC, "favicon.ico")
  : path.join(PUBLIC, "favicon.ico");

let mainWindow: BrowserWindow | null = null;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

// ─── Create Window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    title: "ECE Intelligence Lab",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    icon: ICON,
    show: false,
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      devTools: !app.isPackaged,
      spellcheck: false,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 14 } : undefined,
    frame: process.platform !== "darwin",
  });

  // Load app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, "index.html"));
  }

  // Show when ready - prevents blank flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Intercept navigation - open external URLs in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Send initial theme
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.send(
      "theme-change",
      nativeTheme.shouldUseDarkColors ? "dark" : "light"
    );
  });

  // Dev tools via F12
  if (!app.isPackaged) {
    mainWindow.webContents.on("before-input-event", (_, input) => {
      if (input.type === "keyDown" && input.key === "F12") {
        mainWindow?.webContents.openDevTools({ mode: "detach" });
      }
    });
  }

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─── Application Menu ─────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === "darwin";
  type Sep = { type: "separator" };
  const sep: Sep = { type: "separator" };

  const navLab = (label: string, section: string, accel?: string): Electron.MenuItemConstructorOptions => ({
    label,
    accelerator: accel,
    click: () => mainWindow?.webContents.send("navigate", section),
  });

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" as const },
            sep,
            { role: "services" as const },
            sep,
            { role: "hide" as const },
            { role: "hideOthers" as const },
            { role: "unhide" as const },
            sep,
            { role: "quit" as const },
          ],
        }]
      : []),
    {
      label: "File",
      submenu: [
        { label: "Open Script…",         accelerator: "CmdOrCtrl+O",       click: openScriptDialog },
        { label: "Save Script…",          accelerator: "CmdOrCtrl+S",       click: requestSaveScript },
        sep,
        { label: "Export Plot as PNG…",   accelerator: "CmdOrCtrl+E",       click: () => mainWindow?.webContents.send("export-plot") },
        { label: "Export Data as CSV…",   accelerator: "CmdOrCtrl+Shift+E", click: () => mainWindow?.webContents.send("export-csv") },
        sep,
        isMac ? { role: "close" as const } : { role: "quit" as const },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        sep,
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Dark / Light Theme",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => {
            nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? "light" : "dark";
            mainWindow?.webContents.send(
              "theme-change",
              nativeTheme.shouldUseDarkColors ? "dark" : "light"
            );
          },
        },
        sep,
        { role: "reload"       as const },
        { role: "forceReload"  as const },
        sep,
        { role: "resetZoom"   as const },
        { role: "zoomIn"      as const },
        { role: "zoomOut"     as const },
        sep,
        { role: "togglefullscreen" as const },
      ],
    },
    {
      label: "Lab",
      submenu: [
        navLab("Dashboard",        "home",        "CmdOrCtrl+1"),
        navLab("SPICE Simulator",  "spice",       "CmdOrCtrl+2"),
        navLab("Scilab Env",       "scilab",      "CmdOrCtrl+3"),
        navLab("MATLAB Env",       "matlab",      "CmdOrCtrl+4"),
        navLab("Signal Lab",       "signal",      "CmdOrCtrl+5"),
        navLab("Control Systems",  "control",     "CmdOrCtrl+6"),
        navLab("Digital Lab",      "digital",     "CmdOrCtrl+7"),
        navLab("Antenna Lab",      "antenna",     "CmdOrCtrl+8"),
        navLab("Formula Engine",   "formula",     "CmdOrCtrl+9"),
        sep,
        navLab("Circuit Solver",   "circuit"),
        navLab("Filter Design",    "filter"),
        navLab("DSP Lab",          "dsp"),
        navLab("EMFT & Waves",     "emft"),
        navLab("VLSI Lab",         "vlsi"),
        navLab("Microprocessor",   "microprocessor"),
        navLab("Networking",       "networking"),
        navLab("Comm Systems",     "comm"),
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "zoom"     as const },
        ...(isMac
          ? [sep, { role: "front" as const }]
          : [{ role: "close" as const }]),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About ECE Intelligence Lab",
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: "About ECE Intelligence Lab",
              message: "ECE Intelligence Lab",
              detail: [
                `Version: ${app.getVersion()}`,
                `Electron: ${process.versions.electron}`,
                `Chrome: ${process.versions.chrome}`,
                `Node.js: ${process.versions.node}`,
                `OS: ${os.type()} ${os.release()} (${os.arch()})`,
                `CPUs: ${os.cpus().length}  RAM: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB`,
                "",
                "A comprehensive electronics & engineering simulation",
                "platform with 25+ interactive lab environments.",
              ].join("\n"),
            });
          },
        },
        ...(!app.isPackaged
          ? [
              sep,
              {
                label: "Open Dev Tools",
                accelerator: "F12",
                click: () => mainWindow?.webContents.openDevTools({ mode: "detach" }),
              },
            ]
          : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── File helpers ─────────────────────────────────────────────────────────────
async function openScriptDialog() {
  if (!mainWindow) return;
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Open Script",
    filters: [
      { name: "Scripts", extensions: ["sce", "sci", "m", "txt"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });
  if (canceled || !filePaths.length) return;
  try {
    const content = fs.readFileSync(filePaths[0], "utf-8");
    mainWindow.webContents.send("script-loaded", { content, filePath: filePaths[0] });
  } catch (err: any) {
    dialog.showErrorBox("Read Error", err.message);
  }
}

function requestSaveScript() {
  mainWindow?.webContents.send("request-save-script");
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.on("save-script-content", async (_, { content, defaultName }) => {
  if (!mainWindow) return;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save Script",
    defaultPath: defaultName || "script.sce",
    filters: [
      { name: "Scilab Script", extensions: ["sce", "sci"] },
      { name: "MATLAB Script", extensions: ["m"] },
      { name: "Text", extensions: ["txt"] },
    ],
  });
  if (canceled || !filePath) return;
  try {
    fs.writeFileSync(filePath, content, "utf-8");
    mainWindow.webContents.send("save-script-success", filePath);
  } catch (err: any) {
    dialog.showErrorBox("Write Error", err.message);
  }
});

ipcMain.on("save-png", async (_, { dataUrl, defaultName }) => {
  if (!mainWindow) return;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Export Plot as PNG",
    defaultPath: defaultName || "plot.png",
    filters: [{ name: "PNG Image", extensions: ["png"] }],
  });
  if (canceled || !filePath) return;
  try {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
    mainWindow.webContents.send("save-png-success", filePath);
  } catch (err: any) {
    dialog.showErrorBox("Export Error", err.message);
  }
});

ipcMain.on("save-csv", async (_, { csv, defaultName }) => {
  if (!mainWindow) return;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Export Data as CSV",
    defaultPath: defaultName || "data.csv",
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (canceled || !filePath) return;
  try {
    fs.writeFileSync(filePath, csv, "utf-8");
    mainWindow.webContents.send("save-csv-success", filePath);
  } catch (err: any) {
    dialog.showErrorBox("Export Error", err.message);
  }
});

ipcMain.handle("get-system-info", () => ({
  platform: process.platform,
  arch: process.arch,
  osType: os.type(),
  osRelease: os.release(),
  cpus: os.cpus().length,
  totalMemGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  appVersion: app.getVersion(),
}));

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Security: restrict permissions
  session.defaultSession.setPermissionRequestHandler((_, perm, cb) => {
    cb(["clipboard-read", "clipboard-write", "fullscreen"].includes(perm));
  });

  // Performance: disable unused features
  app.commandLine.appendSwitch("disable-renderer-backgrounding");
  app.commandLine.appendSwitch("force_high_performance_gpu");

  buildMenu();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Prevent second instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
