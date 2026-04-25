import { Entity, Column, Index } from 'typeorm';
import { CabinetScopedEntity } from '../../common/entities/cabinet-scoped.entity';

@Entity('lignes_ordonnance')
export class LigneOrdonnance extends CabinetScopedEntity {
  @Index()
  @Column({ type: 'varchar' })
  ordonnanceId: string;

  @Column()
  medicament: string;

  @Column({ type: 'varchar', nullable: true })
  dosage: string | null;

  @Column({ type: 'varchar', nullable: true })
  frequence: string | null;

  @Column({ type: 'varchar', nullable: true })
  duree: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;
}
