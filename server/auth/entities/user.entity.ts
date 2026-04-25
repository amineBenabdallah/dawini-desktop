import { Entity, Column, Index } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../common/entities/base.entity';
import { Role } from '../../common/enums';

@Entity('users')
export class User extends BaseEntity {
  @Index()
  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  passwordHash: string;

  @Column({ type: 'varchar' })
  role: Role;

  @Index()
  @Column({ type: 'varchar' })
  cabinetId: string;

  @Column({ default: true })
  isActive: boolean;

  @Exclude()
  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Exclude()
  @Column({ type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'varchar', nullable: true })
  firstName: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'simple-json', nullable: true })
  shifts: { day: number; start: string; end: string }[] | null;
}
