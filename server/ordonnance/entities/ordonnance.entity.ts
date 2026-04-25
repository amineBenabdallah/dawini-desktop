import { Entity, Column, Index, BeforeInsert } from 'typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';
import { OrdonnanceStatus } from '../../common/enums';

@Entity('ordonnances')
export class Ordonnance extends CabinetScopedEntity {
  @Index()
  @Column({ type: 'varchar' })
  consultationId: string;

  @Index()
  @Column({ type: 'varchar' })
  patientId: string;

  @Index()
  @Column({ type: 'varchar' })
  docteurId: string;

  @Column({ type: 'datetime' })
  dateEmission: Date;

  @Index()
  @Column()
  numero: string;

  @Column({ type: 'varchar', default: OrdonnanceStatus.ACTIVE })
  statut: OrdonnanceStatus;

  @BeforeInsert()
  assertNumero() {
    if (!this.numero) {
      throw new InternalServerErrorException(
        'Ordonnance.numero must be set before insert',
      );
    }
  }
}
