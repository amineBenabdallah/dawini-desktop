import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  dialog,
  shell,
  screen,
} from 'electron';
import * as path from 'path';
import { JsonStore } from './utils/store';
import { createTray, destroyTray, updateTrayBadge } from './tray';
import { initAutoUpdater } from './updater';
import { registerIpcHandlers } from './ipc/index';
import { startServer, stopServer } from './server-bridge';
import { getLanIp } from './utils/network';

// Force the userData directory to be consistent regardless of how the app is
// launched (packaged binary vs `npx electron`). Without this, running in dev
// uses %APPDATA%/Electron/ while the packaged build uses %APPDATA%/dawini-desktop/
// → they see different SQLite databases and silently fork user data.
app.setName('dawini-desktop');
app.setPath('userData', path.join(app.getPath('appData'), 'dawini-desktop'));

// ── Persistent config store ──────────────────────────────────────────────────
const store = new JsonStore({
  windowBounds: { x: -1, y: -1, width: 1280, height: 800 } as { x: number; y: number; width: number; height: number },
  isMaximized: false,
  minimizeToTray: true,
  audioEnabled: true,
  audioVolume: 0.5,
});

let mainWindow: BrowserWindow | null = null;
let tvWindow: BrowserWindow | null = null;
let isQuitting = false;

// ── Single instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── Create main window ───────────────────────────────────────────────────────
function createMainWindow(): BrowserWindow {
  const saved = store.get('windowBounds');
  const display = screen.getPrimaryDisplay().workAreaSize;

  const x = saved.x >= 0 ? saved.x : Math.round((display.width - saved.width) / 2);
  const y = saved.y >= 0 ? saved.y : Math.round((display.height - saved.height) / 2);

  const win = new BrowserWindow({
    x,
    y,
    width: saved.width,
    height: saved.height,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f8f9fa',
    show: false, // show after ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (store.get('isMaximized')) {
    win.maximize();
  }

  // Load Angular from embedded NestJS server (avoids file:// CORS issues)
  const port = process.env.PORT || 3333;
  win.loadURL(`http://localhost:${port}`);

  // Graceful show — no white flash
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    win.webContents.openDevTools({ mode: 'detach' });
  });

  // Persist window bounds
  const saveBounds = () => {
    if (!win.isMaximized() && !win.isMinimized()) {
      store.set('windowBounds', win.getBounds());
    }
    store.set('isMaximized', win.isMaximized());
  };

  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // Close → minimize to tray or quit
  win.on('close', (e) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      e.preventDefault();
      win.hide();
    }
  });

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// ── Create TV display window ─────────────────────────────────────────────────
function createTvWindow(): BrowserWindow {
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find((d) => d.bounds.x !== 0 || d.bounds.y !== 0);
  const targetDisplay = externalDisplay || screen.getPrimaryDisplay();

  const win = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    fullscreen: true,
    frame: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const port = process.env.PORT || 3333;
  win.loadURL(`http://localhost:${port}/display/queue`);

  return win;
}

// ── IPC: Window controls ─────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());

ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

ipcMain.on('window-maximize-changed', (event) => {
  mainWindow?.on('maximize', () => event.sender.send('maximized-change', true));
  mainWindow?.on('unmaximize', () => event.sender.send('maximized-change', false));
});

// ── IPC: TV display window ───────────────────────────────────────────────────
ipcMain.handle('open-tv-display', () => {
  if (tvWindow && !tvWindow.isDestroyed()) {
    tvWindow.focus();
    return true;
  }
  tvWindow = createTvWindow();
  tvWindow.on('closed', () => { tvWindow = null; });
  return true;
});

ipcMain.handle('close-tv-display', () => {
  if (tvWindow && !tvWindow.isDestroyed()) {
    tvWindow.close();
    tvWindow = null;
  }
  return true;
});

// ── IPC: Badge count (tray) ──────────────────────────────────────────────────
ipcMain.on('badge-count', (_event, count: number) => {
  updateTrayBadge(count);
});

// ── IPC: LAN IP for QR code ──────────────────────────────────────────────────
ipcMain.handle('get-lan-ip', () => getLanIp());

// ── IPC: Store access ────────────────────────────────────────────────────────
ipcMain.handle('store-get', (_event, key: string) => store.get(key as any));
ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
  store.set(key as any, value as any);
});

// ── IPC: Native notification ─────────────────────────────────────────────────
ipcMain.on('notify', (_event, title: string, body: string) => {
  const { Notification } = require('electron');
  new Notification({ title, body, icon: path.join(__dirname, '..', 'resources', 'icons', 'icon.png') }).show();
});

// ── App lifecycle ────────────────────────────────────────────────────────────
app.on('ready', async () => {
  // Start embedded NestJS server
  try {
    await startServer();
  } catch (err) {
    dialog.showErrorBox(
      'Erreur de démarrage',
      `Le serveur interne n'a pas pu démarrer.\n\n${(err as Error).message}`,
    );
    app.quit();
    return;
  }

  mainWindow = createMainWindow();

  createTray(mainWindow, () => {
    isQuitting = true;
    app.quit();
  });

  registerIpcHandlers();
  initAutoUpdater(mainWindow);
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// ── Unhandled errors — show dialog, don't crash silently ─────────────────────
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Erreur inattendue', `${error.message}\n\n${error.stack}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

export { mainWindow, store };
