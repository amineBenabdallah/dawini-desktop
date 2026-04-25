import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';

let tray: Tray | null = null;
let badgeCount = 0;

export function createTray(mainWindow: BrowserWindow, onQuit: () => void): void {
  const iconPath = path.join(__dirname, '..', 'resources', 'icons', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Dawini — Cabinet Médical');

  const contextMenu = buildMenu(mainWindow, onQuit);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });
}

function buildMenu(mainWindow: BrowserWindow, onQuit: () => void): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Ouvrir Dawini',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: `File d'attente: ${badgeCount} patient(s)`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: onQuit,
    },
  ]);
}

export function updateTrayBadge(count: number): void {
  badgeCount = count;
  if (tray) {
    tray.setToolTip(`Dawini — ${count} patient(s) en attente`);
  }
  // On macOS, set dock badge
  if (process.platform === 'darwin') {
    app.dock?.setBadge(count > 0 ? String(count) : '');
  }
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
