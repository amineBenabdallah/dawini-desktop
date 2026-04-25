import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

/**
 * Single-cabinet service — replaces TenantMiddleware.
 *
 * The cabinetId is generated ONCE during setup and persisted.
 * It NEVER changes after that. All entities reference this same ID.
 */
@Injectable()
export class CabinetService {
  private configPath: string;
  private config: Record<string, unknown> = {};

  constructor() {
    const dataDir = process.env.DB_PATH
      ? path.dirname(process.env.DB_PATH)
      : process.cwd();
    this.configPath = path.join(dataDir, 'cabinet-config.json');
    this.load();
  }

  /**
   * Get the cabinet ID. Returns existing ID or creates one if first time.
   * Once created, the same ID is used forever.
   */
  getCabinetId(): string {
    const id = this.config['cabinetId'] as string | undefined;
    if (id) return id;

    // First time — generate and persist permanently
    const newId = uuid();
    this.config['cabinetId'] = newId;
    this.save();
    return newId;
  }

  /**
   * Set the cabinet ID explicitly (called during setup to match user record).
   */
  setCabinetId(id: string): void {
    this.config['cabinetId'] = id;
    this.save();
  }

  getCabinetName(): string {
    return (this.config['cabinetName'] as string) || 'Mon Cabinet';
  }

  setCabinetName(name: string): void {
    this.config['cabinetName'] = name;
    this.save();
  }

  isSetupComplete(): boolean {
    return !!this.config['setupComplete'];
  }

  markSetupComplete(): void {
    this.config['setupComplete'] = true;
    this.save();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch {
      this.config = {};
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (err) {
      console.error('[CabinetService] Failed to save config:', err);
    }
  }
}
