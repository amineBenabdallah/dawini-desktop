import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContextService } from './context.service';
import { Patient } from '../patient/entities/patient.entity';
import { Consultation } from '../consultation/entities/consultation.entity';
import { Ordonnance } from '../ordonnance/entities/ordonnance.entity';
import { LigneOrdonnance } from '../ordonnance/entities/ligne-ordonnance.entity';
import { Certificat } from '../certificat/entities/certificat.entity';
import { RendezVous } from '../rendez-vous/entities/rendez-vous.entity';
import { CabinetService } from '../common/services/cabinet.service';

describe('ContextService', () => {
  let service: ContextService;
  let patientRepo: any;
  let consultRepo: any;
  let ordRepo: any;

  const mockRepo = () => ({
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextService,
        { provide: getRepositoryToken(Patient), useValue: mockRepo() },
        { provide: getRepositoryToken(Consultation), useValue: mockRepo() },
        { provide: getRepositoryToken(Ordonnance), useValue: mockRepo() },
        { provide: getRepositoryToken(LigneOrdonnance), useValue: mockRepo() },
        { provide: getRepositoryToken(Certificat), useValue: mockRepo() },
        { provide: getRepositoryToken(RendezVous), useValue: mockRepo() },
        { provide: CabinetService, useValue: { getCabinetId: () => 'cab-1' } },
      ],
    }).compile();

    service = module.get(ContextService);
    patientRepo = module.get(getRepositoryToken(Patient));
    consultRepo = module.get(getRepositoryToken(Consultation));
    ordRepo = module.get(getRepositoryToken(Ordonnance));
  });

  describe('getTriageContext', () => {
    it('should return only motif — no patient data', () => {
      const result = service.getTriageContext('douleur thoracique');
      expect(result).toBe('Motif de consultation: douleur thoracique');
    });

    it('should return empty for no motif', () => {
      expect(service.getTriageContext()).toBe('');
    });
  });

  describe('getConsultationContext', () => {
    it('should include patient info when provided', async () => {
      patientRepo.findOne.mockResolvedValue({
        id: 'p1', firstName: 'Ahmed', lastName: 'B', dateOfBirth: '1974-01-15', gender: 'M',
      });
      const result = await service.getConsultationContext('p1');
      expect(result).toContain('Ahmed');
      expect(result).toContain('52 ans');
    });

    it('should return empty when no patientId', async () => {
      const result = await service.getConsultationContext();
      expect(result).toBe('');
    });
  });

  describe('getFacturationContext', () => {
    it('should exclude medical data', async () => {
      consultRepo.findOne.mockResolvedValue({
        id: 'c1', motif: 'Contrôle', diagnostic: 'HTA grade 2', traitement: 'Amlodipine',
      });
      const result = await service.getFacturationContext('c1');
      expect(result).toContain('Contrôle');
      expect(result).not.toContain('HTA grade 2');
      expect(result).not.toContain('Amlodipine');
    });
  });

  describe('getChatContext', () => {
    it('should delegate to correct method based on screen', async () => {
      const spy = jest.spyOn(service, 'getTriageContext' as any);
      await service.getChatContext('queue');
      expect(spy).toHaveBeenCalled();
    });
  });
});
