import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Consultation } from './entities/consultation.entity';
import { ConsultationAttachment } from './entities/consultation-attachment.entity';
import { Patient } from '../patient/entities/patient.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { ConsultationStatus } from '../common/enums';

@Injectable()
export class ConsultationService {
  constructor(
    @InjectRepository(Consultation) private repo: Repository<Consultation>,
    @InjectRepository(ConsultationAttachment) private attachRepo: Repository<ConsultationAttachment>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    private cabinetService: CabinetService,
  ) {}

  private async attachPatients<T extends { patientId: string }>(
    items: T[],
    cabinetId: string,
  ): Promise<(T & { patient: Patient | null })[]> {
    if (!items.length) return items as any;
    const ids = Array.from(new Set(items.map((i) => i.patientId).filter(Boolean)));
    const patients = ids.length
      ? await this.patientRepo.find({ where: { id: In(ids), cabinetId } })
      : [];
    const map = new Map(patients.map((p) => [p.id, p]));
    return items.map((i) => Object.assign(i as any, { patient: map.get(i.patientId) ?? null }));
  }

  async create(data: Partial<Consultation>): Promise<Consultation> {
    const cabinetId = this.cabinetService.getCabinetId();
    const consultation = this.repo.create({ ...data, cabinetId });
    return this.repo.save(consultation);
  }

  async findAll(
    cabinetId: string,
    page = 1,
    limit = 20,
    filters: { statut?: string; dateFrom?: string; dateTo?: string } = {},
  ) {
    const where: any = { cabinetId };
    if (filters.statut) where.statut = filters.statut;
    if (filters.dateFrom || filters.dateTo) {
      const { MoreThanOrEqual, LessThanOrEqual, Between } = require('typeorm');
      if (filters.dateFrom && filters.dateTo) {
        where.dateConsultation = Between(new Date(filters.dateFrom), new Date(filters.dateTo));
      } else if (filters.dateFrom) {
        where.dateConsultation = MoreThanOrEqual(new Date(filters.dateFrom!));
      } else if (filters.dateTo) {
        where.dateConsultation = LessThanOrEqual(new Date(filters.dateTo));
      }
    }
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { dateConsultation: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    // Spread to plain objects so ClassSerializerInterceptor doesn't strip attached fields
    const patientIds = Array.from(new Set(rows.map((r) => r.patientId).filter(Boolean)));
    const patients = patientIds.length
      ? await this.patientRepo.find({ where: { id: In(patientIds), cabinetId } })
      : [];
    const patientById = new Map(patients.map((p) => [p.id, p]));
    const data = rows.map((r) => ({ ...r, patient: patientById.get(r.patientId) ?? null }));
    return { data, total, page, limit };
  }

  private async findOneRaw(id: string, cabinetId: string): Promise<Consultation> {
    const c = await this.repo.findOne({ where: { id, cabinetId } });
    if (!c) throw new NotFoundException('Consultation introuvable.');
    return c;
  }

  async findOne(id: string, cabinetId: string): Promise<any> {
    const c = await this.findOneRaw(id, cabinetId);
    const patient = c.patientId
      ? await this.patientRepo.findOne({ where: { id: c.patientId, cabinetId } })
      : null;
    const attachments = await this.attachRepo.find({
      where: { consultationId: id, cabinetId },
    });
    // Return a plain object to bypass ClassSerializerInterceptor stripping extra props
    return { ...c, patient, attachments };
  }

  async update(id: string, cabinetId: string, data: Partial<Consultation>): Promise<Consultation> {
    const c = await this.findOneRaw(id, cabinetId);
    if (c.statut === ConsultationStatus.FINALIZED) {
      throw new BadRequestException('Une consultation finalisée ne peut pas être modifiée.');
    }
    Object.assign(c, data);
    return this.repo.save(c);
  }

  async start(id: string, cabinetId: string): Promise<Consultation> {
    const c = await this.findOneRaw(id, cabinetId);
    if (c.statut !== ConsultationStatus.EN_ATTENTE) {
      throw new BadRequestException('Seule une consultation EN_ATTENTE peut être démarrée.');
    }
    c.statut = ConsultationStatus.OPEN;
    return this.repo.save(c);
  }

  async finalize(id: string, cabinetId: string): Promise<Consultation> {
    const c = await this.findOneRaw(id, cabinetId);
    if (c.statut !== ConsultationStatus.OPEN) {
      throw new BadRequestException('Seule une consultation OPEN peut être finalisée.');
    }
    c.statut = ConsultationStatus.FINALIZED;
    return this.repo.save(c);
  }

  async addAttachment(
    consultationId: string,
    cabinetId: string,
    data: { fileName: string; filePath: string; fileSize: number; mimeType: string },
  ): Promise<ConsultationAttachment> {
    await this.findOneRaw(consultationId, cabinetId);
    const attachment = this.attachRepo.create({
      ...data,
      consultationId,
      cabinetId,
    });
    return this.attachRepo.save(attachment);
  }
}
