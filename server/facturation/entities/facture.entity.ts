import { Entity, Column, Index } from 'typeorm';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';
import { InvoiceStatus } from '../../common/enums';

@Entity('factures')
export class Facture extends CabinetScopedEntity {
  @Index()
  @Column({ length: 20 })
  numero: string;

  @Index()
  @Column({ type: 'varchar' })
  consultationId: string;

  @Index()
  @Column({ type: 'varchar' })
  patientId: string;

  @Column({ type: 'varchar' })
  docteurId: string;

  @Column({ type: 'real' })
  montantTotal: number;

  @Column({ type: 'real', default: 0 })
  montantPaye: number;

  @Column({ type: 'varchar', default: InvoiceStatus.UNPAID })
  statut: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
