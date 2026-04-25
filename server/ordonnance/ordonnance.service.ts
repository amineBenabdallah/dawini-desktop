import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Ordonnance } from './entities/ordonnance.entity';
import { LigneOrdonnance } from './entities/ligne-ordonnance.entity';
import { Consultation } from '../consultation/entities/consultation.entity';
import { Patient } from '../patient/entities/patient.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { OrdonnanceStatus } from '../common/enums';

@Injectable()
export class OrdonnanceService {
  constructor(
    @InjectRepository(Ordonnance) private repo: Repository<Ordonnance>,
    @InjectRepository(LigneOrdonnance) private ligneRepo: Repository<LigneOrdonnance>,
    @InjectRepository(Consultation) private consultationRepo: Repository<Consultation>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    private cabinetService: CabinetService,
  ) {}

  async create(
    data: Partial<Ordonnance>,
    lignes: Partial<LigneOrdonnance>[],
  ): Promise<Ordonnance> {
    const cabinetId = this.cabinetService.getCabinetId();

    // Resolve patientId and docteurId from the linked consultation
    if (data.consultationId && (!data.patientId || !data.docteurId)) {
      const consultation = await this.consultationRepo.findOne({
        where: { id: data.consultationId, cabinetId },
      });
      if (!consultation) throw new BadRequestException('Consultation introuvable.');
      data.patientId = data.patientId || consultation.patientId;
      data.docteurId = data.docteurId || consultation.docteurId;
    }

    const numero = await this.generateNumber(cabinetId);

    const ord = this.repo.create({
      ...data,
      cabinetId,
      numero,
      dateEmission: new Date(),
    });
    const saved = await this.repo.save(ord);

    if (lignes?.length) {
      const ligneEntities = lignes.map((l) =>
        this.ligneRepo.create({ ...l, ordonnanceId: saved.id, cabinetId }),
      );
      await this.ligneRepo.save(ligneEntities);
    }

    return saved;
  }

  async findAll(cabinetId: string, page = 1, limit = 100) {
    const [rows, total] = await this.repo.findAndCount({
      where: { cabinetId },
      order: { dateEmission: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    if (!rows.length) return { data: [], total: 0, page, limit };
    const ordIds = rows.map((o) => o.id);
    const patientIds = Array.from(new Set(rows.map((o) => o.patientId).filter(Boolean)));
    const [allLignes, patients] = await Promise.all([
      this.ligneRepo.find({ where: { ordonnanceId: In(ordIds), cabinetId } }),
      patientIds.length
        ? this.patientRepo.find({ where: { id: In(patientIds), cabinetId } })
        : Promise.resolve([]),
    ]);
    const lignesByOrd = new Map<string, LigneOrdonnance[]>();
    for (const l of allLignes) {
      const list = lignesByOrd.get(l.ordonnanceId) ?? [];
      list.push(l);
      lignesByOrd.set(l.ordonnanceId, list);
    }
    const patientById = new Map(patients.map((p) => [p.id, p]));
    const data = rows.map((o) => ({
      ...o,
      lignes: lignesByOrd.get(o.id) ?? [],
      patient: patientById.get(o.patientId) ?? null,
    }));
    return { data, total, page, limit };
  }

  async findOne(id: string, cabinetId: string) {
    const ord = await this.repo.findOne({ where: { id, cabinetId } });
    if (!ord) throw new NotFoundException('Ordonnance introuvable.');

    const [lignes, patient] = await Promise.all([
      this.ligneRepo.find({ where: { ordonnanceId: id, cabinetId } }),
      ord.patientId
        ? this.patientRepo.findOne({ where: { id: ord.patientId, cabinetId } })
        : Promise.resolve(null),
    ]);
    return { ...ord, lignes: lignes ?? [], patient: patient ?? null };
  }

  async update(id: string, cabinetId: string, data: Partial<Ordonnance>): Promise<Ordonnance> {
    const ord = await this.repo.findOne({ where: { id, cabinetId } });
    if (!ord) throw new NotFoundException('Ordonnance introuvable.');
    Object.assign(ord, data);
    return this.repo.save(ord);
  }

  async cancel(id: string, cabinetId: string): Promise<void> {
    const ord = await this.repo.findOne({ where: { id, cabinetId } });
    if (!ord) throw new NotFoundException('Ordonnance introuvable.');
    ord.statut = OrdonnanceStatus.ANNULEE;
    await this.repo.save(ord);
  }

  private async generateNumber(cabinetId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;

    const last = await this.repo
      .createQueryBuilder('o')
      .where('o.cabinetId = :cabinetId', { cabinetId })
      .andWhere('o.numero LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.numero', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const lastNum = parseInt(last.numero.replace(prefix, ''), 10);
      seq = lastNum + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
