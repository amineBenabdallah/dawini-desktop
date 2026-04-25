import * as crypto from 'crypto';

// Replicate the license validation logic for testing
const HMAC_SECRET = 'test-secret';

function generateLicenseKey(cabinetHash: string, expiry: string): string {
  const payload = cabinetHash + expiry;
  const sig = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
  return payload + sig;
}

function validateKey(key: string): { valid: boolean; expiresAt: string | null } {
  const cleaned = key.replace(/[-\s]/g, '').toUpperCase();
  if (cleaned.length < 20) return { valid: false, expiresAt: null };

  const payload = cleaned.slice(0, cleaned.length - 8);
  const providedSig = cleaned.slice(-8);

  const expectedSig = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  if (providedSig !== expectedSig) return { valid: false, expiresAt: null };

  const expiryPart = payload.slice(8, 16);
  if (expiryPart === 'LIFETIME') return { valid: true, expiresAt: null };

  const year = expiryPart.slice(0, 4);
  const month = expiryPart.slice(4, 6);
  const day = expiryPart.slice(6, 8);
  return { valid: true, expiresAt: `${year}-${month}-${day}` };
}

describe('License Key Validation', () => {
  it('should validate a correctly signed key', () => {
    const key = generateLicenseKey('ABCD1234', '20271231');
    const result = validateKey(key);
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBe('2027-12-31');
  });

  it('should reject a tampered key', () => {
    const key = generateLicenseKey('ABCD1234', '20271231');
    const tampered = key.slice(0, -1) + 'X';
    expect(validateKey(tampered).valid).toBe(false);
  });

  it('should accept a lifetime key', () => {
    const key = generateLicenseKey('ABCD1234', 'LIFETIME');
    const result = validateKey(key);
    expect(result.valid).toBe(true);
    expect(result.expiresAt).toBeNull();
  });

  it('should reject keys that are too short', () => {
    expect(validateKey('SHORT').valid).toBe(false);
  });

  it('should handle formatted keys with dashes', () => {
    const raw = generateLicenseKey('ABCD1234', '20271231');
    const formatted = raw.match(/.{1,5}/g)!.join('-');
    expect(validateKey(formatted).valid).toBe(true);
  });
});

describe('License Key Generation', () => {
  it('should produce deterministic output for same input', () => {
    const key1 = generateLicenseKey('ABCD1234', '20271231');
    const key2 = generateLicenseKey('ABCD1234', '20271231');
    expect(key1).toBe(key2);
  });

  it('should produce different output for different cabinet hash', () => {
    const key1 = generateLicenseKey('ABCD1234', '20271231');
    const key2 = generateLicenseKey('EFGH5678', '20271231');
    expect(key1).not.toBe(key2);
  });

  it('should produce different output for different expiry', () => {
    const key1 = generateLicenseKey('ABCD1234', '20271231');
    const key2 = generateLicenseKey('ABCD1234', '20280101');
    expect(key1).not.toBe(key2);
  });
});
