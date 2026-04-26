import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerLicenseHandlers } from './license';
import { runSetup, getProgress } from '../ollama-setup';

/**
 * Register all IPC handlers for the renderer process.
 * Called once in app.on('ready').
 */
export function registerIpcHandlers(): void {
  registerPrintHandlers();
  registerFileHandlers();
  registerAppInfoHandlers();
  registerLicenseHandlers();
  registerAmiraSetupHandlers();
}

// ── Amira (Ollama) setup ─────────────────────────────────────────────────────
function registerAmiraSetupHandlers(): void {
  ipcMain.handle('amira-setup-status', () => getProgress());
  ipcMain.handle('amira-setup-run', () => {
    const win = BrowserWindow.getAllWindows()[0] || null;
    runSetup(win);
    return true;
  });
}

// ── Print ────────────────────────────────────────────────────────────────────
function registerPrintHandlers(): void {
  ipcMain.handle('print', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;

    return new Promise<boolean>((resolve) => {
      win.webContents.print({}, (success) => resolve(success));
    });
  });

  ipcMain.handle('print-silent', async (_event, printerName: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;

    return new Promise<boolean>((resolve) => {
      win.webContents.print({ silent: true, deviceName: printerName }, (success) => resolve(success));
    });
  });

  ipcMain.handle('get-printers', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return [];
    return win.webContents.getPrintersAsync();
  });
}

// ── File system ──────────────────────────────────────────────────────────────
function registerFileHandlers(): void {
  ipcMain.handle('save-file', async (_event, data: ArrayBuffer, defaultName: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Tous les fichiers', extensions: ['*'] },
      ],
    });

    if (canceled || !filePath) return null;

    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  });

  ipcMain.handle('open-file', async (_event, filters?: { name: string; extensions: string[] }[]) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;

    const defaultFilters = filters || [
      { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ];

    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: defaultFilters,
    });

    if (canceled || filePaths.length === 0) return null;

    const filePath = filePaths[0];
    const buffer = fs.readFileSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      data: buffer.buffer,
      size: buffer.length,
    };
  });
}

// ── App info ─────────────────────────────────────────────────────────────────
function registerAppInfoHandlers(): void {
  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('get-data-path', () => app.getPath('userData'));
}
