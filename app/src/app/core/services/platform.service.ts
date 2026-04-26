import { Injectable } from '@angular/core';

/**
 * Desktop platform bridge — provides typed access to Electron APIs.
 * In a browser context (dev), all methods gracefully fallback.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly isDesktop = !!(window as any).electronAPI?.isDesktop;
  private api = (window as any).electronAPI;

  // ── Window controls ──────────────────────────────────────────────────
  minimize(): void {
    if (this.isDesktop) this.api.minimize();
  }

  maximize(): void {
    if (this.isDesktop) this.api.maximize();
  }

  close(): void {
    if (this.isDesktop) this.api.close();
  }

  async isMaximized(): Promise<boolean> {
    return this.isDesktop ? this.api.isMaximized() : false;
  }

  onMaximizedChange(callback: (maximized: boolean) => void): void {
    if (this.isDesktop) this.api.onMaximizedChange(callback);
  }

  // ── Printing ─────────────────────────────────────────────────────────
  print(): void {
    if (this.isDesktop) {
      this.api.print();
    } else {
      window.print();
    }
  }

  async printSilent(printerName: string): Promise<boolean> {
    return this.isDesktop ? this.api.printSilent(printerName) : false;
  }

  async getPrinters(): Promise<{ name: string; isDefault: boolean }[]> {
    return this.isDesktop ? this.api.getPrinters() : [];
  }

  // ── File system ──────────────────────────────────────────────────────
  async saveFile(data: ArrayBuffer, defaultName: string): Promise<string | null> {
    if (this.isDesktop) {
      return this.api.saveFile(data, defaultName);
    }
    // Browser fallback: download blob
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return null;
  }

  // ── Notifications ────────────────────────────────────────────────────
  notify(title: string, body: string): void {
    if (this.isDesktop) {
      this.api.notify(title, body);
    }
  }

  setBadgeCount(count: number): void {
    if (this.isDesktop) this.api.setBadgeCount(count);
  }

  // ── TV display ───────────────────────────────────────────────────────
  async openTvDisplay(): Promise<boolean> {
    return this.isDesktop ? this.api.openTvDisplay() : false;
  }

  async closeTvDisplay(): Promise<boolean> {
    return this.isDesktop ? this.api.closeTvDisplay() : false;
  }

  // ── Network ──────────────────────────────────────────────────────────
  async getLanIp(): Promise<string> {
    return this.isDesktop ? this.api.getLanIp() : 'localhost';
  }

  // ── License ──────────────────────────────────────────────────────────
  async getLicenseStatus(): Promise<{ state: string; daysLeft: number }> {
    return this.isDesktop ? this.api.getLicenseStatus() : { state: 'active', daysLeft: Infinity };
  }

  async activateLicense(key: string, referralCode?: string): Promise<{ success: boolean; error?: string }> {
    return this.isDesktop ? this.api.activateLicense(key, referralCode) : { success: true };
  }

  // ── Auto-updater ─────────────────────────────────────────────────────
  onUpdateAvailable(callback: (info: { version: string }) => void): void {
    if (this.isDesktop) this.api.onUpdateAvailable(callback);
  }

  onUpdateDownloaded(callback: (info: { version: string }) => void): void {
    if (this.isDesktop) this.api.onUpdateDownloaded(callback);
  }

  installUpdate(): void {
    if (this.isDesktop) this.api.installUpdate();
  }

  // ── App info ─────────────────────────────────────────────────────────
  async getVersion(): Promise<string> {
    return this.isDesktop ? this.api.getVersion() : '1.0.0-dev';
  }

  // ── Amira (Ollama) setup ─────────────────────────────────────────────
  async amiraSetupStatus(): Promise<{ phase: string; percent: number; message: string; error?: string }> {
    return this.isDesktop ? this.api.amiraSetupStatus() : { phase: 'idle', percent: 0, message: '' };
  }

  amiraSetupRun(): void {
    if (this.isDesktop) this.api.amiraSetupRun();
  }

  onAmiraSetupProgress(callback: (progress: { phase: string; percent: number; message: string; error?: string }) => void): void {
    if (this.isDesktop) this.api.onAmiraSetupProgress(callback);
  }

  // ── Audio feedback ───────────────────────────────────────────────────
  playClick(): void {
    if (!this.isDesktop) return;
    const audio = new Audio('assets/sounds/soft-click.mp3');
    audio.volume = 0.12;
    audio.play().catch(() => {});
  }

  playChime(): void {
    const audio = new Audio('assets/sounds/chime.mp3');
    audio.volume = 0.4;
    audio.play().catch(() => {});
  }

  /** French TTS announcement for queue */
  announcePatient(number: number): void {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Numéro ${number}, veuillez vous présenter`,
      );
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }
}
