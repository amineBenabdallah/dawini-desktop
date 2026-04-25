import { ipcMain } from 'electron';
import * as http from 'http';
import * as https from 'https';
import { JsonStore } from '../utils/store';

/**
 * License system — one master key + optional referral code.
 *
 * Flow:
 * 1. Doctor enters license key + referral code → POST to LeadsGen → PENDING
 * 2. Admin validates in LeadsGen → ACTIVE (12 months)
 * 3. On app start if PENDING → check server → if ACTIVE, store locally
 * 4. Once ACTIVE → offline forever until expiry
 * 5. REVOKED → app locked
 */

interface LicenseData {
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  expiresAt: string | null;
  cabinetName: string | null;
  checkedAt: string;
}

export interface LicenseStatus {
  state: 'trial' | 'pending' | 'active' | 'expired' | 'revoked';
  daysLeft: number;
  expiresAt: string | null;
  cabinetName: string | null;
  message: string;
}

const LEADSGEN_URL = process.env.LEADSGEN_URL || 'http://localhost:3000';
const TRIAL_DAYS = 14;

const store = new JsonStore({
  license: null as LicenseData | null,
  trialStartDate: null as string | null,
}, 'license.json');

export function registerLicenseHandlers(): void {
  ipcMain.handle('license-get', (): LicenseData | null => {
    return store.get('license');
  });

  ipcMain.handle('license-activate', async (_event, licenseKey: string, referralCode?: string): Promise<{ success: boolean; error?: string; status?: string }> => {
    return activateLicense(licenseKey, referralCode);
  });

  ipcMain.handle('license-status', async (): Promise<LicenseStatus> => {
    return getLicenseStatus();
  });
}

async function activateLicense(licenseKey: string, referralCode?: string): Promise<{ success: boolean; error?: string; status?: string }> {
  if (!licenseKey?.trim()) {
    return { success: false, error: 'Veuillez entrer la clé de licence.' };
  }

  const fs = require('fs');
  const path = require('path');
  const configPath = path.join(path.dirname(process.env.DB_PATH || '.'), 'cabinet-config.json');
  let cabinetName = 'Cabinet';
  let cabinetId = '';
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    cabinetName = config.cabinetName || 'Cabinet';
    cabinetId = config.cabinetId || '';
  } catch {}

  if (!cabinetId) {
    return { success: false, error: 'Cabinet non configuré. Complétez la configuration du cabinet d\'abord.' };
  }

  try {
    const result = await httpPost(`${LEADSGEN_URL}/api/desktop-license/activate`, {
      licenseKey: licenseKey.trim(),
      referralCode: referralCode?.trim() || undefined,
      cabinetName,
      cabinetId,
    });

    if (result.status === 'PENDING' || result.status === 'ACTIVE') {
      store.set('license', {
        status: result.status,
        expiresAt: result.expiresAt || null,
        cabinetName,
        checkedAt: new Date().toISOString(),
      });
      return { success: true, status: result.status };
    }

    return { success: false, error: result.message || 'Erreur inconnue.' };
  } catch (err: any) {
    return {
      success: false,
      error: err.message?.includes('ECONNREFUSED')
        ? 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'
        : (err.message || 'Erreur de connexion.'),
    };
  }
}

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const license = store.get('license');
  const trialStart = store.get('trialStartDate');

  if (license) {
    // If PENDING → check server
    if (license.status === 'PENDING') {
      try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(path.dirname(process.env.DB_PATH || '.'), 'cabinet-config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const result = await httpGet(`${LEADSGEN_URL}/api/desktop-license/check?cabinetId=${encodeURIComponent(config.cabinetId)}`);
        if (result.status === 'ACTIVE') {
          license.status = 'ACTIVE';
          license.expiresAt = result.expiresAt || null;
          license.checkedAt = new Date().toISOString();
          store.set('license', license);
        } else if (result.status === 'REVOKED') {
          license.status = 'REVOKED';
          store.set('license', license);
        }
      } catch { /* offline — keep current state */ }
    }

    switch (license.status) {
      case 'ACTIVE': {
        if (!license.expiresAt) return { state: 'active', daysLeft: Infinity, expiresAt: null, cabinetName: license.cabinetName, message: 'Licence active.' };
        const daysLeft = Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / 86400000);
        if (daysLeft <= 0) return { state: 'expired', daysLeft: 0, expiresAt: license.expiresAt, cabinetName: license.cabinetName, message: 'Licence expirée.' };
        return { state: 'active', daysLeft, expiresAt: license.expiresAt, cabinetName: license.cabinetName, message: `Licence active — ${daysLeft} jours.` };
      }
      case 'PENDING':
        return { state: 'pending', daysLeft: getTrialDaysLeft(), expiresAt: null, cabinetName: license.cabinetName, message: 'En attente de validation.' };
      case 'REVOKED':
        return { state: 'revoked', daysLeft: 0, expiresAt: null, cabinetName: license.cabinetName, message: 'Licence désactivée.' };
    }
  }

  // No license — trial
  if (!trialStart) {
    store.set('trialStartDate', new Date().toISOString());
    return { state: 'trial', daysLeft: TRIAL_DAYS, expiresAt: null, cabinetName: null, message: `Essai gratuit — ${TRIAL_DAYS} jours.` };
  }

  const daysLeft = getTrialDaysLeft();
  return daysLeft > 0
    ? { state: 'trial', daysLeft, expiresAt: null, cabinetName: null, message: `Essai — ${daysLeft} jours restants.` }
    : { state: 'expired', daysLeft: 0, expiresAt: null, cabinetName: null, message: 'Essai terminé.' };
}

function getTrialDaysLeft(): number {
  const trialStart = store.get('trialStartDate');
  if (!trialStart) return TRIAL_DAYS;
  return Math.max(0, TRIAL_DAYS - Math.ceil((Date.now() - new Date(trialStart).getTime()) / 86400000));
}

function httpPost(url: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let d = ''; res.on('data', (c) => d += c); res.on('end', () => { try { const j = JSON.parse(d); res.statusCode && res.statusCode >= 400 ? reject(new Error(j.message || `HTTP ${res.statusCode}`)) : resolve(j); } catch { reject(new Error('Réponse invalide.')); } });
    });
    req.on('error', reject); req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout.')); }); req.write(data); req.end();
  });
}

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(url, (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => { try { const j = JSON.parse(d); res.statusCode && res.statusCode >= 400 ? reject(new Error(j.message || `HTTP ${res.statusCode}`)) : resolve(j); } catch { reject(new Error('Réponse invalide.')); } }); });
    req.on('error', reject); req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout.')); });
  });
}
