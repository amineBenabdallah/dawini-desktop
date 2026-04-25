import { Entity, Column, Index, BeforeInsert } from 'typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';
import { Gender } from '../../common/enums';

@Entity('patients')
export class Patient extends CabinetScopedEntity {
  @Index()
  @Column()
  patientNumber: string;

  @Index()
  @Column()
  lastName: string;

  @Index()
  @Column()
  firstName: string;

  @Column({ type: 'varchar' })
  dateOfBirth: string;

  @Column({ type: 'varchar' })
  gender: Gender;

  @Index()
  @Column()
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  wilaya: string | null;

  @Column({ type: 'varchar', nullable: true })
  commune: string | null;

  @Column({ type: 'varchar', nullable: true })
  nss: string | null;

  @Column({ type: 'varchar', nullable: true })
  emergencyContactName: string | null;

  @Column({ type: 'varchar', nullable: true })
  emergencyContactPhone: string | null;

  @Column({ default: true })
  isActive: boolean;

  @BeforeInsert()
  assertPatientNumber() {
    if (!this.patientNumber) {
      throw new InternalServerErrorException(
        'Patient.patientNumber must be set before insert',
      );
    }
  }
}
