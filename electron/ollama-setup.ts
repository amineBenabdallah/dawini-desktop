import { app, BrowserWindow } from 'electron';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const REQUIRED_MODEL = 'mistral';
const OLLAMA_INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe';

export type SetupPhase =
  | 'idle'
  | 'checking'
  | 'downloading-ollama'
  | 'installing-ollama'
  | 'starting-ollama'
  | 'pulling-model'
  | 'ready'
  | 'error';

export interface SetupProgress {
  phase: SetupPhase;
  percent: number;
  message: string;
  error?: string;
}

let currentProgress: SetupProgress = { phase: 'idle', percent: 0, message: '' };
let setupInProgress = false;

function emit(win: BrowserWindow | null, progress: SetupProgress): void {
  currentProgress = progress;
  if (win && !win.isDestroyed()) {
    win.webContents.send('amira-setup-progress', progress);
  }
}

export function getProgress(): SetupProgress {
  return currentProgress;
}

async function ollamaRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

async function modelInstalled(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const found = (parsed.models || []).some((m: any) =>
            m.name === name || m.name.startsWith(`${name}:`)
          );
          resolve(found);
        } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

function downloadFile(url: string, dest: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl: string, redirectsLeft: number) => {
      const lib = currentUrl.startsWith('http://') ? require('http') : https;
      const req = lib.get(currentUrl, {
        headers: {
          'User-Agent': 'Dawini-Desktop/1.0 (+https://github.com/amineBenabdallah/dawini-desktop)',
          'Accept': '*/*',
        },
      }, (res: any) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
          const next = res.headers.location;
          if (!next) return reject(new Error('Redirect with no Location header'));
          res.resume();
          // Resolve relative redirects against current URL
          const resolved = next.startsWith('http') ? next : new URL(next, currentUrl).toString();
          return doRequest(resolved, redirectsLeft - 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} fetching ${currentUrl}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const file = fs.createWriteStream(dest);
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (total > 0) onProgress(Math.round((received / total) * 100));
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', (err: Error) => { fs.unlink(dest, () => reject(err)); });
      });
      req.on('error', reject);
      req.setTimeout(120_000, () => { req.destroy(new Error('Download stalled (120s no data)')); });
    };
    doRequest(url, 8);
  });
}

function runInstaller(installerPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ollama uses Inno Setup — /VERYSILENT installs without UI.
    const child = spawn(installerPath, ['/VERYSILENT', '/NORESTART'], {
      windowsHide: true,
      detached: false,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Installer exited with code ${code}`));
    });
  });
}

async function waitForOllama(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await ollamaRunning()) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Ollama did not start within timeout');
}

async function pullModel(
  name: string,
  onProgress: (pct: number, status: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ name, stream: true });
    const req = http.request({
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/pull',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`pull HTTP ${res.statusCode}`));
      let buffer = '';
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.error) return reject(new Error(evt.error));
            const total = evt.total || 0;
            const completed = evt.completed || 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            onProgress(pct, evt.status || '');
          } catch {}
        }
      });
      res.on('end', () => resolve());
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(0);
    req.write(body);
    req.end();
  });
}

export async function runSetup(win: BrowserWindow | null): Promise<void> {
  if (setupInProgress) return;
  setupInProgress = true;

  try {
    emit(win, { phase: 'checking', percent: 0, message: 'Vérification d\'Amira...' });

    const isRunning = await ollamaRunning();

    if (!isRunning) {
      emit(win, { phase: 'downloading-ollama', percent: 0, message: 'Téléchargement d\'Ollama...' });
      const installerPath = path.join(app.getPath('temp'), 'OllamaSetup.exe');
      await downloadFile(OLLAMA_INSTALLER_URL, installerPath, (pct) => {
        emit(win, { phase: 'downloading-ollama', percent: pct, message: `Téléchargement d'Ollama... ${pct}%` });
      });

      emit(win, { phase: 'installing-ollama', percent: 0, message: 'Installation d\'Ollama...' });
      await runInstaller(installerPath);
      try { fs.unlinkSync(installerPath); } catch {}

      emit(win, { phase: 'starting-ollama', percent: 0, message: 'Démarrage d\'Ollama...' });
      await waitForOllama(60_000);
    }

    const hasModel = await modelInstalled(REQUIRED_MODEL);
    if (!hasModel) {
      emit(win, { phase: 'pulling-model', percent: 0, message: 'Téléchargement du modèle Amira (~4 Go)...' });
      await pullModel(REQUIRED_MODEL, (pct, status) => {
        emit(win, { phase: 'pulling-model', percent: pct, message: `${status} ${pct}%` });
      });
    }

    emit(win, { phase: 'ready', percent: 100, message: 'Amira prête.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit(win, { phase: 'error', percent: 0, message: 'Configuration échouée', error: message });
  } finally {
    setupInProgress = false;
  }
}
