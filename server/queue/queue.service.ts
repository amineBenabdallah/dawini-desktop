import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QueueToken } from './entities/queue-token.entity';
import { RendezVous } from '../rendez-vous/entities/rendez-vous.entity';
import { Patient } from '../patient/entities/patient.entity';
import { QueueSseService } from './queue.sse.service';
import { CabinetService } from '../common/services/cabinet.service';
import {
  QueueTokenStatus,
  QueueTokenType,
  AppointmentStatus,
  DeviceHint,
} from '../common/enums';

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(QueueToken) private tokenRepo: Repository<QueueToken>,
    @InjectRepository(RendezVous) private rdvRepo: Repository<RendezVous>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    private sse: QueueSseService,
    private events: EventEmitter2,
    private cabinetService: CabinetService,
  ) {}

  /** Public: patient joins queue (walk-in) */
  async join(data: {
    patientName: string;
    patientId?: string;
    deviceHint?: DeviceHint;
  }): Promise<QueueToken> {
    const cabinetId = this.cabinetService.getCabinetId();
    const token = this.tokenRepo.create({
      cabinetId,
      patientName: data.patientName,
      patientId: data.patientId || null,
      type: QueueTokenType.WALK_IN,
      status: QueueTokenStatus.WAITING,
      arrivedAt: new Date(),
      deviceHint: data.deviceHint || DeviceHint.UNKNOWN,
    });
    const saved = await this.tokenRepo.save(token);

    const position = await this.getPosition(saved.id, cabinetId);
    this.sse.emit({ cabinetId, tokenId: saved.id, position, status: saved.status });

    return saved;
  }

  /** Staff: check in an appointment patient */
  async checkin(rdvId: string, cabinetId: string): Promise<QueueToken> {
    const rdv = await this.rdvRepo.findOne({ where: { id: rdvId, cabinetId } });
    if (!rdv) throw new NotFoundException('Rendez-vous introuvable.');

    // Check if already checked in
    const existing = await this.tokenRepo.findOne({ where: { rdvId, cabinetId } });
    if (existing) throw new BadRequestException('Ce rendez-vous est déjà enregistré.');

    // Get patient name
    let patientName = 'Patient';
    if (rdv.patientId) {
      const patient = await this.patientRepo.findOne({ where: { id: rdv.patientId } });
      if (patient) patientName = `${patient.lastName} ${patient.firstName}`;
    }

    const token = this.tokenRepo.create({
      cabinetId,
      patientName,
      patientId: rdv.patientId,
      type: QueueTokenType.APPOINTMENT,
      rdvId: rdv.id,
      appointmentTime: rdv.dateHeure,
      arrivedAt: new Date(),
      status: QueueTokenStatus.WAITING,
    });

    rdv.statut = AppointmentStatus.WAITING;
    await this.rdvRepo.save(rdv);

    return this.tokenRepo.save(token);
  }

  /** Staff: call next patient (priority: overdue appointments first) */
  async callNext(cabinetId: string): Promise<QueueToken | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const waiting = await this.tokenRepo
      .createQueryBuilder('t')
      .where('t.cabinetId = :cabinetId', { cabinetId })
      .andWhere('t.status = :status', { status: QueueTokenStatus.WAITING })
      .andWhere('t.arrivedAt >= :today', { today: today.toISOString() })
      .orderBy('t.appointmentTime', 'ASC', 'NULLS LAST')
      .addOrderBy('t.arrivedAt', 'ASC')
      .getOne();

    if (!waiting) return null;

    waiting.status = QueueTokenStatus.CALLED;
    const saved = await this.tokenRepo.save(waiting);

    // Broadcast position updates to all waiting patients
    await this.broadcastPositions(cabinetId);

    return saved;
  }

  /** Staff: mark patient as done */
  async markDone(tokenId: string, cabinetId: string): Promise<QueueToken> {
    const token = await this.tokenRepo.findOne({ where: { id: tokenId, cabinetId } });
    if (!token) throw new NotFoundException('Token introuvable.');
    token.status = QueueTokenStatus.DONE;
    const saved = await this.tokenRepo.save(token);

    this.sse.emit({ cabinetId, tokenId: saved.id, position: 0, status: saved.status });
    this.events.emit('queue.token.done', { token: saved });

    return saved;
  }

  /** Staff: mark patient as absent */
  async markAbsent(tokenId: string, cabinetId: string): Promise<QueueToken> {
    const token = await this.tokenRepo.findOne({ where: { id: tokenId, cabinetId } });
    if (!token) throw new NotFoundException('Token introuvable.');
    token.status = QueueTokenStatus.ABSENT;
    const saved = await this.tokenRepo.save(token);

    this.sse.emit({ cabinetId, tokenId: saved.id, position: 0, status: saved.status });
    await this.broadcastPositions(cabinetId);

    return saved;
  }

  /** Staff: manual call by name */
  async manualCall(tokenId: string, cabinetId: string): Promise<QueueToken> {
    const token = await this.tokenRepo.findOne({ where: { id: tokenId, cabinetId } });
    if (!token) throw new NotFoundException('Token introuvable.');
    token.status = QueueTokenStatus.CALLED_MANUAL;
    token.isManual = true;
    return this.tokenRepo.save(token);
  }

  /** Public: get position for a specific token */
  async getStatus(tokenId: string): Promise<{ position: number; status: string }> {
    const token = await this.tokenRepo.findOne({ where: { id: tokenId } });
    if (!token) throw new NotFoundException('Token introuvable.');

    const position = await this.getPosition(tokenId, token.cabinetId);
    return { position, status: token.status };
  }

  /** Staff: secretary two-lane view */
  async secretaryView(cabinetId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tokens = await this.tokenRepo.find({
      where: {
        cabinetId,
        status: In([QueueTokenStatus.WAITING, QueueTokenStatus.CALLED, QueueTokenStatus.CALLED_MANUAL]),
      },
      order: { arrivedAt: 'ASC' },
    });

    return {
      appointmentLane: tokens.filter((t) => t.type === QueueTokenType.APPOINTMENT),
      walkInLane: tokens.filter((t) => t.type === QueueTokenType.WALK_IN),
    };
  }

  /** Staff: today's planned appointments not yet checked in */
  async pendingCheckin(cabinetId: string) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    return this.rdvRepo
      .createQueryBuilder('r')
      .where('r.cabinetId = :cabinetId', { cabinetId })
      .andWhere('r.dateHeure >= :start', { start: start.toISOString() })
      .andWhere('r.dateHeure < :end', { end: end.toISOString() })
      .andWhere('r.statut = :statut', { statut: AppointmentStatus.PLANNED })
      .orderBy('r.dateHeure', 'ASC')
      .getMany();
  }

  private async getPosition(tokenId: string, cabinetId: string): Promise<number> {
    const token = await this.tokenRepo.findOne({ where: { id: tokenId } });
    if (!token || token.status !== QueueTokenStatus.WAITING) return 0;

    const ahead = await this.tokenRepo
      .createQueryBuilder('t')
      .where('t.cabinetId = :cabinetId', { cabinetId })
      .andWhere('t.status = :status', { status: QueueTokenStatus.WAITING })
      .andWhere('t.arrivedAt < :arrivedAt', { arrivedAt: token.arrivedAt.toISOString() })
      .getCount();

    return ahead + 1;
  }

  private async broadcastPositions(cabinetId: string): Promise<void> {
    const waiting = await this.tokenRepo.find({
      where: { cabinetId, status: QueueTokenStatus.WAITING },
      order: { appointmentTime: 'ASC', arrivedAt: 'ASC' },
    });

    const updates = waiting.map((t, i) => ({
      tokenId: t.id,
      position: i + 1,
      status: t.status,
    }));

    this.sse.broadcast(cabinetId, updates);
  }
}
