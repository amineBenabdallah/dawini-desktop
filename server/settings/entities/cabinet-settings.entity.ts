import { Entity, Column, BeforeInsert } from 'typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('cabinet_settings')
export class CabinetSettings extends BaseEntity {
  @Column({ type: 'varchar' })
  cabinetId: string;

  @Column({ type: 'varchar', nullable: true })
  cabinetName: string | null;

  @Column({ type: 'varchar', nullable: true })
  doctorFirstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  doctorLastName: string | null;

  @Column({ type: 'varchar', nullable: true })
  specialty: string | null;

  @Column({ type: 'varchar', nullable: true })
  ordreNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  wilaya: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoPath: string | null;

  @Column({ type: 'integer', default: 30 })
  defaultConsultationDuration: number;

  @Column({ type: 'simple-json', nullable: true })
  consultationTypes: { label: string; fee: number }[] | null;

  @Column({ type: 'simple-json', nullable: true })
  openingHours: Record<string, string> | null;

  @BeforeInsert()
  assertCabinetId() {
    if (!this.cabinetId) {
      throw new InternalServerErrorException(
        'CabinetSettings.cabinetId must be set before insert',
      );
    }
  }
}
