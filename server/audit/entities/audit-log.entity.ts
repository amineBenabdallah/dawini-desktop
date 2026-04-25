import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Role } from '../../common/enums';
import { AuditAction, AuditResource } from '../../common/enums';

@Entity('audit_logs')
@Index(['cabinetId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  cabinetId: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column()
  userEmail: string;

  @Column({ type: 'varchar' })
  userRole: Role;

  @Column({ type: 'varchar' })
  action: AuditAction;

  @Column({ type: 'varchar' })
  resource: AuditResource;

  @Column({ type: 'varchar', nullable: true })
  resourceId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
