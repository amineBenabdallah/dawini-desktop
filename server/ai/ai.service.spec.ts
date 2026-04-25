import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiService, AmiraNotAvailableError, AmiraValidationError } from './ai.service';
import { LlmService } from './llm.service';
import { RagService } from './rag.service';
import { RulesService } from './rules.service';
import { ContextService } from './context.service';
import { Patient } from '../patient/entities/patient.entity';
import { Consultation } from '../consultation/entities/consultation.entity';
import { Ordonnance } from '../ordonnance/entities/ordonnance.entity';
import { LigneOrdonnance } from '../ordonnance/entities/ligne-ordonnance.entity';
import { Certificat } from '../certificat/entities/certificat.entity';
import { RendezVous } from '../rendez-vous/entities/rendez-vous.entity';
import { CabinetService } from '../common/services/cabinet.service';

describe('AiService', () => {
  let service: AiService;
  let llm: any;
  let rag: any;
  let rules: any;

  const mockRepo = { findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn().mockReturnValue({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn().mockResolvedValue(0), getMany: jest.fn().mockResolvedValue([]) }) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: LlmService, useValue: { isReady: false, generate: jest.fn(), stream: jest.fn(), status: { loaded: false } } },
        { provide: RagService, useValue: { search: jest.fn().mockResolvedValue([]) } },
        { provide: RulesService, useValue: { searchAll: jest.fn().mockReturnValue(''), lookupLabNormal: jest.fn().mockReturnValue('') } },
        { provide: ContextService, useValue: { getChatContext: jest.fn().mockResolvedValue(''), getConsultationContext: jest.fn().mockResolvedValue('') } },
      ],
    }).compile();

    service = module.get(AiService);
    llm = module.get(LlmService);
    rag = module.get(RagService);
    rules = module.get(RulesService);
  });

  describe('query', () => {
    it('should throw AmiraNotAvailableError when LLM not loaded', async () => {
      await expect(service.query({ screen: 'chat', question: 'test' }))
        .rejects.toThrow(AmiraNotAvailableError);
    });

    it('should return response when LLM is loaded', async () => {
      llm.isReady = true;
      llm.generate.mockResolvedValue('Test response');

      const result = await service.query({ screen: 'chat', question: 'test' });
      expect(result.text).toBe('Test response');
    });

    it('should search RAG and Rules before calling LLM', async () => {
      llm.isReady = true;
      llm.generate.mockResolvedValue('Response');

      await service.query({ screen: 'consultation', question: 'HTA' });

      expect(rag.search).toHaveBeenCalledWith('HTA', 5);
      expect(rules.searchAll).toHaveBeenCalledWith('HTA', 'consultation');
    });
  });

  describe('validation', () => {
    it('should reject empty question', async () => {
      await expect(service.query({ screen: 'chat', question: '' }))
        .rejects.toThrow(AmiraValidationError);
    });

    it('should reject invalid screen', async () => {
      await expect(service.query({ screen: 'invalid', question: 'test' }))
        .rejects.toThrow(AmiraValidationError);
    });

    it('should reject too-long question', async () => {
      const longQuestion = 'x'.repeat(2001);
      await expect(service.query({ screen: 'chat', question: longQuestion }))
        .rejects.toThrow(AmiraValidationError);
    });
  });

  describe('checkVitals', () => {
    it('should detect HTA grade 2', async () => {
      const result = await service.checkVitals({ ta: '160/100' });
      expect(result).toContain('HTA grade 2');
    });

    it('should detect hypotension', async () => {
      const result = await service.checkVitals({ ta: '80/50' });
      expect(result).toContain('Hypotension');
    });

    it('should detect fever', async () => {
      const result = await service.checkVitals({ temp: 39 });
      expect(result).toContain('Fièvre');
    });

    it('should return null for normal vitals', async () => {
      const result = await service.checkVitals({ ta: '120/80', temp: 37 });
      expect(result).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return LLM status', () => {
      const status = service.getStatus();
      expect(status).toHaveProperty('loaded', false);
    });
  });
});
