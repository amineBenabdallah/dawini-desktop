import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificat } from './entities/certificat.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { CertificatStatus } from '../common/enums';

@Injectable()
export class CertificatService {
  constructor(
    @InjectRepository(Certificat) private repo: Repository<Certificat>,
    private cabinetService: CabinetService,
  ) {}

  async create(data: Partial<Certificat>): Promise<Certificat> {
    const cabinetId = this.cabinetService.getCabinetId();
    const numero = await this.generateNumber(cabinetId);
    const cert = this.repo.create({ ...data, cabinetId, numero, dateEmission: new Date() });
    return this.repo.save(cert);
  }

  async findAll(cabinetId: string) {
    return this.repo.find({ where: { cabinetId }, order: { dateEmission: 'DESC' } });
  }

  async findOne(id: string, cabinetId: string): Promise<Certificat> {
    const c = await this.repo.findOne({ where: { id, cabinetId } });
    if (!c) throw new NotFoundException('Certificat introuvable.');
    return c;
  }

  async update(id: string, cabinetId: string, data: Partial<Certificat>): Promise<Certificat> {
    const c = await this.findOne(id, cabinetId);
    Object.assign(c, data);
    return this.repo.save(c);
  }

  async cancel(id: string, cabinetId: string): Promise<void> {
    const c = await this.findOne(id, cabinetId);
    c.statut = CertificatStatus.ANNULEE;
    await this.repo.save(c);
  }

  private async generateNumber(cabinetId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CERT-${year}-`;
    const last = await this.repo.createQueryBuilder('c')
      .where('c.cabinetId = :cabinetId', { cabinetId })
      .andWhere('c.numero LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.numero', 'DESC').getOne();
    let seq = 1;
    if (last) seq = parseInt(last.numero.replace(prefix, ''), 10) + 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
