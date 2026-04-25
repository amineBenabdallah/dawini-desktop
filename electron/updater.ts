import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, ipcMain, dialog } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Check on startup and every 4 hours
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);

  // ── Events → renderer ───────────────────────────────────────────────────
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow?.webContents.send('update-available', {
      version: info.version,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    mainWindow?.webContents.send('update-downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update-error', err.message);
  });

  // ── IPC handlers ────────────────────────────────────────────────────────
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result?.updateInfo?.version ?? null;
    } catch {
      return null;
    }
  });

  ipcMain.on('install-update', () => {
    autoUpdater.downloadUpdate().then(() => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Mise à jour prête',
        message: 'La mise à jour sera installée au prochain redémarrage.',
        buttons: ['Redémarrer maintenant', 'Plus tard'],
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    });
  });
}
