#!/usr/bin/env node
/**
 * Dawini Desktop — License Key Generator
 *
 * Usage:
 *   node scripts/generate-license.js                    → lifetime key
 *   node scripts/generate-license.js 2027-12-31         → expires on date
 *   node scripts/generate-license.js 2027-12-31 PARTNER → with partner ID
 *
 * Key format: DAWINI-XXXXX-XXXXX-XXXXX-XXXXX
 * Payload: [8 chars partner/cabinet hash] + [8 chars expiry YYYYMMDD or LIFETIME] + [8 chars HMAC signature]
 */

const crypto = require('crypto');

const HMAC_SECRET = process.env.LICENSE_HMAC_SECRET || 'dawini-desktop-default-secret-change-in-production';

function generateKey(expiry, partnerId) {
  // First 8 chars: partner/cabinet hash (or random if no partner)
  const partnerHash = partnerId
    ? crypto.createHash('md5').update(partnerId).digest('hex').slice(0, 8).toUpperCase()
    : crypto.randomBytes(4).toString('hex').toUpperCase();

  // Next 8 chars: expiry date or LIFETIME
  let expiryPart;
  if (!expiry || expiry === 'LIFETIME') {
    expiryPart = 'LIFETIME';
  } else {
    const d = new Date(expiry);
    if (isNaN(d.getTime())) {
      console.error('Invalid date format. Use YYYY-MM-DD');
      process.exit(1);
    }
    const y = d.getFullYear().toString();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    expiryPart = `${y}${m}${day}`;
  }

  const payload = partnerHash + expiryPart;

  // Last 8 chars: HMAC signature
  const sig = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  const raw = payload + sig;

  // Format as DAWINI-XXXXX-XXXXX-XXXXX-XXXXX
  const chunks = raw.match(/.{1,5}/g) || [];
  const formatted = chunks.join('-');

  return { raw, formatted, expiry: expiryPart, partner: partnerHash };
}

// ── CLI ──
const expiry = process.argv[2] || 'LIFETIME';
const partnerId = process.argv[3] || null;

const key = generateKey(expiry, partnerId);

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║        DAWINI DESKTOP — LICENSE KEY          ║');
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  Key:     ${key.formatted.padEnd(34)}║`);
console.log(`║  Expiry:  ${(key.expiry === 'LIFETIME' ? 'Lifetime (no expiry)' : key.expiry).padEnd(34)}║`);
console.log(`║  Partner: ${(partnerId || 'None').padEnd(34)}║`);
console.log('╚══════════════════════════════════════════════╝');
console.log('');
console.log('Give this key to the doctor. They enter it in:');
console.log('  Settings > Licence > "Activer une clé de licence"');
console.log('');
