import { Entity, Column, Index } from 'typeorm';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';

@Entity('consultation_attachments')
export class ConsultationAttachment extends CabinetScopedEntity {
  @Index()
  @Column({ type: 'varchar' })
  consultationId: string;

  @Column()
  fileName: string;

  /** Local file path — no cloud storage in desktop */
  @Column()
  filePath: string;

  @Column({ type: 'integer' })
  fileSize: number;

  @Column()
  mimeType: string;
}
