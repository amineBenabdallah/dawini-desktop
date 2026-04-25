import { Entity, Column, Index } from 'typeorm';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';
import { AppointmentStatus } from '../../common/enums';

@Entity('rendez_vous')
export class RendezVous extends CabinetScopedEntity {
  @Index()
  @Column({ type: 'varchar' })
  patientId: string;

  @Index()
  @Column({ type: 'varchar' })
  docteurId: string;

  @Index()
  @Column({ type: 'datetime' })
  dateHeure: Date;

  @Column({ type: 'integer', default: 30 })
  dureeMinutes: number;

  @Column({ length: 500 })
  motif: string;

  @Column({ type: 'varchar', default: AppointmentStatus.PLANNED })
  statut: AppointmentStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
