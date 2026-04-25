import { getLanIp, getQueueUrl } from './network';

describe('Network Utils', () => {
  describe('getLanIp', () => {
    it('should return a string', () => {
      const ip = getLanIp();
      expect(typeof ip).toBe('string');
    });

    it('should return a valid IPv4 address', () => {
      const ip = getLanIp();
      // Either a real LAN IP or fallback to localhost
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      expect(ipv4Regex.test(ip)).toBe(true);
    });
  });

  describe('getQueueUrl', () => {
    it('should build correct URL with default port', () => {
      const url = getQueueUrl('test-cabinet-id');
      expect(url).toContain(':3333/salle/test-cabinet-id');
      expect(url).toStartWith('http://');
    });

    it('should use custom port', () => {
      const url = getQueueUrl('abc', 4000);
      expect(url).toContain(':4000/salle/abc');
    });
  });
});

// Custom matcher
expect.extend({
  toStartWith(received: string, prefix: string) {
    const pass = received.startsWith(prefix);
    return {
      pass,
      message: () => `expected "${received}" to start with "${prefix}"`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toStartWith(prefix: string): R;
    }
  }
}
