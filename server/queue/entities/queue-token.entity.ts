import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';
import { QueueTokenStatus, QueueTokenType, DeviceHint } from '../../common/enums';
import { RendezVous } from '../../rendez-vous/entities/rendez-vous.entity';

@Entity('queue_tokens')
export class QueueToken extends CabinetScopedEntity {
  @Column()
  patientName: string;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  patientId: string | null;

  @Column({ type: 'varchar' })
  type: QueueTokenType;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  rdvId: string | null;

  @ManyToOne(() => RendezVous, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rdvId' })
  rdv: RendezVous | null;

  @Column({ type: 'datetime', nullable: true })
  appointmentTime: Date | null;

  @Column({ type: 'datetime' })
  arrivedAt: Date;

  @Index()
  @Column({ type: 'varchar', default: QueueTokenStatus.WAITING })
  status: QueueTokenStatus;

  @Column({ type: 'varchar', default: DeviceHint.UNKNOWN })
  deviceHint: DeviceHint;

  @Column({ default: false })
  isManual: boolean;
}
