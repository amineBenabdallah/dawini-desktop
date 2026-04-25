import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { CabinetService } from '../common/services/cabinet.service';

describe('PatientsService', () => {
  let service: PatientsService;
  let repo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: getRepositoryToken(Patient),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn((d: any) => ({ ...d, id: 'pat-1' })),
            save: jest.fn((d: any) => Promise.resolve(d)),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            }),
          },
        },
        {
          provide: CabinetService,
          useValue: { getCabinetId: jest.fn().mockReturnValue('cab-1') },
        },
      ],
    }).compile();

    service = module.get(PatientsService);
    repo = module.get(getRepositoryToken(Patient));
  });

  describe('create', () => {
    it('should create a patient with auto-generated number', async () => {
      const result = await service.create({
        firstName: 'Ahmed',
        lastName: 'Benali',
        dateOfBirth: '1990-01-15',
        gender: 'M' as any,
        phone: '0555123456',
      });

      expect(result.patientNumber).toMatch(/^PAT-\d{4}-0001$/);
      expect(result.cabinetId).toBe('cab-1');
    });
  });

  describe('findOne', () => {
    it('should return patient if found', async () => {
      const patient = { id: 'pat-1', cabinetId: 'cab-1', firstName: 'Ahmed' };
      repo.findOne.mockResolvedValue(patient);

      const result = await service.findOne('pat-1', 'cab-1');
      expect(result.firstName).toBe('Ahmed');
    });

    it('should throw NotFoundException if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('invalid', 'cab-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should set isActive to false', async () => {
      const patient = { id: 'pat-1', cabinetId: 'cab-1', isActive: true };
      repo.findOne.mockResolvedValue(patient);

      await service.softDelete('pat-1', 'cab-1');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });
});
