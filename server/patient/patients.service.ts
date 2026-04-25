import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { CabinetService } from '../common/services/cabinet.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private repo: Repository<Patient>,
    private cabinetService: CabinetService,
  ) {}

  async create(data: Partial<Patient>): Promise<Patient> {
    const cabinetId = this.cabinetService.getCabinetId();
    const patientNumber = await this.generateNumber(cabinetId);

    const patient = this.repo.create({
      ...data,
      cabinetId,
      patientNumber,
    });

    return this.repo.save(patient);
  }

  async findAll(cabinetId: string, search?: string, page = 1, limit = 20) {
    const where: any = { cabinetId, isActive: true };

    if (search) {
      // SQLite doesn't have ILIKE — use LIKE with manual case handling
      return this.repo
        .createQueryBuilder('p')
        .where('p.cabinetId = :cabinetId', { cabinetId })
        .andWhere('p.isActive = :active', { active: true })
        .andWhere(
          '(LOWER(p.firstName) LIKE :search OR LOWER(p.lastName) LIKE :search OR p.phone LIKE :search OR p.patientNumber LIKE :search)',
          { search: `%${search.toLowerCase()}%` },
        )
        .orderBy('p.lastName', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
    }

    return this.repo.findAndCount({
      where,
      order: { lastName: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(id: string, cabinetId: string): Promise<Patient> {
    const patient = await this.repo.findOne({ where: { id, cabinetId } });
    if (!patient) throw new NotFoundException('Patient introuvable.');
    return patient;
  }

  async update(id: string, cabinetId: string, data: Partial<Patient>): Promise<Patient> {
    const patient = await this.findOne(id, cabinetId);
    Object.assign(patient, data);
    return this.repo.save(patient);
  }

  async softDelete(id: string, cabinetId: string): Promise<void> {
    const patient = await this.findOne(id, cabinetId);
    patient.isActive = false;
    await this.repo.save(patient);
  }

  private async generateNumber(cabinetId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PAT-${year}-`;

    const last = await this.repo
      .createQueryBuilder('p')
      .where('p.cabinetId = :cabinetId', { cabinetId })
      .andWhere('p.patientNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.patientNumber', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const lastNum = parseInt(last.patientNumber.replace(prefix, ''), 10);
      seq = lastNum + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
