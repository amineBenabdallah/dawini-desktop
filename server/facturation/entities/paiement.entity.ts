import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PaymentMethod } from '../../common/enums';

@Entity('paiements')
export class Paiement extends BaseEntity {
  @Index()
  @Column({ type: 'varchar' })
  factureId: string;

  @Column({ type: 'real' })
  montant: number;

  @Column({ type: 'varchar', default: PaymentMethod.ESPECES })
  methode: PaymentMethod;

  @Column({ type: 'datetime' })
  datePaiement: Date;

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
