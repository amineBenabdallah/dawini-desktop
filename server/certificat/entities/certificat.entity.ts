import { Entity, Column, Index, BeforeInsert } from 'typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';
import { CertificatType, CertificatStatus } from '../../common/enums';

@Entity('certificats')
export class Certificat extends CabinetScopedEntity {
  @Index()
  @Column({ type: 'varchar' })
  consultationId: string;

  @Index()
  @Column({ type: 'varchar' })
  patientId: string;

  @Index()
  @Column({ type: 'varchar' })
  docteurId: string;

  @Column({ type: 'varchar' })
  type: CertificatType;

  @Index()
  @Column()
  numero: string;

  @Column({ type: 'text' })
  contenu: string;

  @Column({ type: 'integer', nullable: true })
  joursRepos: number | null;

  @Column({ type: 'datetime' })
  dateEmission: Date;

  @Column({ type: 'varchar', default: CertificatStatus.ACTIVE })
  statut: CertificatStatus;

  @BeforeInsert()
  assertNumero() {
    if (!this.numero) {
      throw new InternalServerErrorException(
        'Certificat.numero must be set before insert',
      );
    }
  }
}
