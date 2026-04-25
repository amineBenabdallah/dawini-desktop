import { RulesService } from './rules.service';

describe('RulesService', () => {
  let service: RulesService;

  beforeEach(() => {
    service = new RulesService();
    service.onModuleInit();
  });

  describe('lookupCim10', () => {
    it('should find code by prefix', () => {
      const result = service.lookupCim10('J06');
      expect(result).toContain('J06');
      expect(result).toContain('respiratoires');
    });

    it('should find code by label keyword', () => {
      const result = service.lookupCim10('diabète');
      expect(result).toContain('E11');
    });

    it('should return empty string for unknown code', () => {
      expect(service.lookupCim10('ZZZZZ')).toBe('');
    });
  });

  describe('lookupLabNormal', () => {
    it('should find glycémie normal range', () => {
      const result = service.lookupLabNormal('glycémie');
      expect(result).toContain('0.7');
      expect(result).toContain('1.1');
      expect(result).toContain('g/L');
    });

    it('should return empty for unknown test', () => {
      expect(service.lookupLabNormal('nonexistent')).toBe('');
    });
  });

  describe('lookupTriage', () => {
    it('should flag douleur thoracique as urgent', () => {
      const result = service.lookupTriage('douleur thoracique');
      expect(result).toContain('URGENTE');
      expect(result).toContain('priorité');
    });

    it('should return empty for non-urgent motif', () => {
      expect(service.lookupTriage('contrôle annuel')).toBe('');
    });
  });

  describe('lookupTarif', () => {
    it('should find consultation tarif', () => {
      const result = service.lookupTarif('consultation');
      expect(result).toContain('250');
      expect(result).toContain('DZD');
    });
  });

  describe('lookupDrug', () => {
    it('should find paracétamol', () => {
      const result = service.lookupDrug('paracétamol');
      expect(result).toContain('Antalgique');
      expect(result).toContain('4g/j');
    });

    it('should find amoxicilline', () => {
      const result = service.lookupDrug('amoxicilline');
      expect(result).toContain('Antibiotique');
    });
  });

  describe('searchLaws', () => {
    it('should find certificat in code déontologie', () => {
      const result = service.searchLaws('certificat');
      expect(result).toContain('certificat');
    });

    it('should find secret médical', () => {
      const result = service.searchLaws('secret');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('searchAll', () => {
    it('should search across all datasets', () => {
      const result = service.searchAll('diabète');
      expect(result).toContain('E11');
    });

    it('should scope search by screen', () => {
      const triage = service.searchAll('douleur thoracique', 'queue');
      expect(triage).toContain('URGENTE');
    });

    it('should return empty for no matches', () => {
      expect(service.searchAll('xyznonexistent')).toBe('');
    });
  });
});
