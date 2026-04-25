import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { RendezVous } from './entities/rendez-vous.entity';
import { CabinetService } from '../common/services/cabinet.service';
import { AppointmentStatus } from '../common/enums';

@Injectable()
export class RendezVousService {
  constructor(
    @InjectRepository(RendezVous) private repo: Repository<RendezVous>,
    private cabinetService: CabinetService,
  ) {}

  async create(data: Partial<RendezVous>): Promise<RendezVous> {
    const cabinetId = this.cabinetService.getCabinetId();

    // Check for conflicts
    if (data.dateHeure && data.dureeMinutes && data.docteurId) {
      await this.checkConflict(cabinetId, data.docteurId, new Date(data.dateHeure), data.dureeMinutes);
    }

    const rdv = this.repo.create({ ...data, cabinetId });
    return this.repo.save(rdv);
  }

  async findAll(cabinetId: string, dateFrom?: string, dateTo?: string, date?: string): Promise<[RendezVous[], number]> {
    // SQLite stores dates as strings — use query builder for reliable date comparison
    const qb = this.repo.createQueryBuilder('r')
      .where('r.cabinetId = :cabinetId', { cabinetId });

    if (dateFrom && dateTo) {
      qb.andWhere('r.dateHeure >= :from', { from: `${dateFrom} 00:00:00` })
        .andWhere('r.dateHeure <= :to', { to: `${dateTo} 23:59:59` });
    } else if (date) {
      qb.andWhere('r.dateHeure >= :from', { from: `${date} 00:00:00` })
        .andWhere('r.dateHeure <= :to', { to: `${date} 23:59:59` });
    }

    qb.orderBy('r.dateHeure', 'ASC');

    const [data, total] = await qb.getManyAndCount();
    return [data, total];
  }

  async findOne(id: string, cabinetId: string): Promise<RendezVous> {
    const rdv = await this.repo.findOne({ where: { id, cabinetId } });
    if (!rdv) throw new NotFoundException('Rendez-vous introuvable.');
    return rdv;
  }

  async update(id: string, cabinetId: string, data: Partial<RendezVous>): Promise<RendezVous> {
    const rdv = await this.findOne(id, cabinetId);
    Object.assign(rdv, data);
    return this.repo.save(rdv);
  }

  async cancel(id: string, cabinetId: string): Promise<void> {
    const rdv = await this.findOne(id, cabinetId);
    rdv.statut = AppointmentStatus.CANCELLED;
    await this.repo.save(rdv);
  }

  async agenda(cabinetId: string, date: string) {
    return this.repo.createQueryBuilder('r')
      .where('r.cabinetId = :cabinetId', { cabinetId })
      .andWhere('r.dateHeure >= :from', { from: `${date} 00:00:00` })
      .andWhere('r.dateHeure <= :to', { to: `${date} 23:59:59` })
      .orderBy('r.dateHeure', 'ASC')
      .getMany();
  }

  private async checkConflict(
    cabinetId: string,
    docteurId: string,
    dateHeure: Date,
    dureeMinutes: number,
  ): Promise<void> {
    const endTime = new Date(dateHeure.getTime() + dureeMinutes * 60000);

    const conflicts = await this.repo
      .createQueryBuilder('r')
      .where('r.cabinetId = :cabinetId', { cabinetId })
      .andWhere('r.docteurId = :docteurId', { docteurId })
      .andWhere('r.statut NOT IN (:...excluded)', {
        excluded: [AppointmentStatus.CANCELLED, AppointmentStatus.ABSENT],
      })
      .andWhere(
        '(r.dateHeure < :endTime AND datetime(r.dateHeure, \'+\' || r.dureeMinutes || \' minutes\') > :startTime)',
        { startTime: dateHeure.toISOString(), endTime: endTime.toISOString() },
      )
      .getCount();

    if (conflicts > 0) {
      throw new ConflictException('Ce créneau est déjà occupé.');
    }
  }
}
