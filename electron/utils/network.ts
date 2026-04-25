import * as os from 'os';

/**
 * Detect the machine's LAN IPv4 address.
 * Used to generate QR codes that patients can scan on cabinet WiFi.
 */
export function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Build the full queue URL for QR code generation.
 */
export function getQueueUrl(cabinetId: string, port = 3333): string {
  const ip = getLanIp();
  return `http://${ip}:${port}/salle/${cabinetId}`;
}
