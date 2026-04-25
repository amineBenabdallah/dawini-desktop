import { Entity, Column, Index } from 'typeorm';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';
import { ConsultationStatus } from '../../common/enums';

@Entity('consultations')
export class Consultation extends CabinetScopedEntity {
  @Index()
  @Column({ type: 'varchar' })
  patientId: string;

  @Index()
  @Column({ type: 'varchar' })
  docteurId: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  rendezVousId: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  queueTokenId: string | null;

  @Column({ type: 'datetime' })
  dateConsultation: Date;

  @Column({ length: 500 })
  motif: string;

  @Column({ type: 'text', nullable: true })
  examenClinique: string | null;

  @Column({ type: 'text', nullable: true })
  diagnostic: string | null;

  @Column({ type: 'text', nullable: true })
  traitement: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  tensionArterielle: string | null;

  @Column({ type: 'real', nullable: true })
  poids: number | null;

  @Column({ type: 'real', nullable: true })
  temperature: number | null;

  @Column({ type: 'varchar', default: ConsultationStatus.OPEN })
  statut: ConsultationStatus;
}
