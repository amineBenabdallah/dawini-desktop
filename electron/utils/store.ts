import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple JSON config store — replaces electron-store.
 * Stores data in %AppData%/dawini-desktop/config.json
 */
export class JsonStore<T extends Record<string, unknown>> {
  private data: T;
  private filePath: string;

  constructor(private defaults: T, fileName = 'config.json') {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, fileName);
    this.data = { ...defaults };
    this.load();
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key] ?? this.defaults[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
    this.save();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = { ...this.defaults, ...parsed };
      }
    } catch {
      this.data = { ...this.defaults };
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[Store] Failed to save:', err);
    }
  }
}
