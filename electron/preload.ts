import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload bridge — exposes a safe, typed API to the Angular renderer.
 * Angular accesses these via `window.electronAPI`.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Platform detection ───────────────────────────────────────────────────
  isDesktop: true,
  platform: process.platform, // 'win32' | 'darwin' | 'linux'

  // ── Window controls ──────────────────────────────────────────────────────
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    ipcRenderer.send('window-maximize-changed');
    ipcRenderer.on('maximized-change', (_event, maximized: boolean) => callback(maximized));
  },

  // ── Printing ─────────────────────────────────────────────────────────────
  print: () => ipcRenderer.invoke('print'),
  printSilent: (printerName: string) => ipcRenderer.invoke('print-silent', printerName),
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // ── File system ──────────────────────────────────────────────────────────
  saveFile: (data: ArrayBuffer, defaultName: string) =>
    ipcRenderer.invoke('save-file', data, defaultName),
  openFile: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('open-file', filters),

  // ── Notifications ────────────────────────────────────────────────────────
  notify: (title: string, body: string) => ipcRenderer.send('notify', title, body),
  setBadgeCount: (count: number) => ipcRenderer.send('badge-count', count),

  // ── TV display ───────────────────────────────────────────────────────────
  openTvDisplay: () => ipcRenderer.invoke('open-tv-display'),
  closeTvDisplay: () => ipcRenderer.invoke('close-tv-display'),

  // ── Network ──────────────────────────────────────────────────────────────
  getLanIp: () => ipcRenderer.invoke('get-lan-ip'),

  // ── License ──────────────────────────────────────────────────────────────
  getLicense: () => ipcRenderer.invoke('license-get'),
  activateLicense: (key: string, referralCode?: string) => ipcRenderer.invoke('license-activate', key, referralCode),
  getLicenseStatus: () => ipcRenderer.invoke('license-status'),

  // ── Store (persistent settings) ──────────────────────────────────────────
  storeGet: (key: string) => ipcRenderer.invoke('store-get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store-set', key, value),

  // ── Auto-updater ─────────────────────────────────────────────────────────
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateAvailable: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info));
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info));
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error));
  },

  // ── App info ─────────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('get-version'),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
});
