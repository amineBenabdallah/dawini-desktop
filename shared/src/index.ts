// Shared enums and types — Electron + Angular + NestJS (desktop edition)

export enum Role {
  ADMIN = 'ADMIN',
  DOCTEUR = 'DOCTEUR',
  SECRETAIRE = 'SECRETAIRE',
  EMPLOYE = 'EMPLOYE',
}

export enum Gender {
  M = 'M',
  F = 'F',
}

export enum AppointmentStatus {
  PLANNED = 'PLANNED',
  CONFIRMED = 'CONFIRMED',
  WAITING = 'WAITING',
  DONE = 'DONE',
  ABSENT = 'ABSENT',
  CANCELLED = 'CANCELLED',
}

export enum ConsultationStatus {
  EN_ATTENTE = 'EN_ATTENTE',
  OPEN = 'OPEN',
  FINALIZED = 'FINALIZED',
}

export enum CertificatStatus {
  ACTIVE = 'ACTIVE',
  ANNULEE = 'ANNULEE',
}

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  ESPECES = 'ESPECES',
  CHEQUE = 'CHEQUE',
  VIREMENT = 'VIREMENT',
  EDAHABIA = 'EDAHABIA',
  BARIDIMOB = 'BARIDIMOB',
  CIB = 'CIB',
  NONE = 'NONE',
}

export enum CertificatType {
  REPOS = 'REPOS',
  APTITUDE = 'APTITUDE',
  INAPTITUDE = 'INAPTITUDE',
  SCOLAIRE = 'SCOLAIRE',
}

export enum LicenseState {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export enum QueueTokenStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  CALLED_MANUAL = 'CALLED_MANUAL',
  DONE = 'DONE',
  ABSENT = 'ABSENT',
}

export enum QueueTokenType {
  APPOINTMENT = 'APPOINTMENT',
  WALK_IN = 'WALK_IN',
}

// ── Electron API type for Angular ────────────────────────────────────────────
export interface ElectronAPI {
  isDesktop: boolean;
  platform: string;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (callback: (maximized: boolean) => void) => void;
  print: () => Promise<boolean>;
  printSilent: (printerName: string) => Promise<boolean>;
  getPrinters: () => Promise<{ name: string; isDefault: boolean }[]>;
  saveFile: (data: ArrayBuffer, defaultName: string) => Promise<string | null>;
  openFile: (filters?: { name: string; extensions: string[] }[]) => Promise<{ path: string; name: string; data: ArrayBuffer; size: number } | null>;
  notify: (title: string, body: string) => void;
  setBadgeCount: (count: number) => void;
  openTvDisplay: () => Promise<boolean>;
  closeTvDisplay: () => Promise<boolean>;
  getLanIp: () => Promise<string>;
  getLicense: () => Promise<unknown>;
  activateLicense: (key: string) => Promise<{ success: boolean; error?: string }>;
  getLicenseStatus: () => Promise<{ state: string; daysLeft: number; expiresAt: string | null; cabinetName: string | null }>;
  storeGet: (key: string) => Promise<unknown>;
  storeSet: (key: string, value: unknown) => Promise<void>;
  checkForUpdates: () => Promise<string | null>;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: { version: string }) => void) => void;
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  getVersion: () => Promise<string>;
  getDataPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
