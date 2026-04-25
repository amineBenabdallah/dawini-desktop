import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';
import { RagService } from './rag.service';
import { RulesService } from './rules.service';
import { ContextService } from './context.service';
import { IndexerService } from './indexer.service';
import { Patient } from '../patient/entities/patient.entity';
import { Consultation } from '../consultation/entities/consultation.entity';
import { Ordonnance } from '../ordonnance/entities/ordonnance.entity';
import { LigneOrdonnance } from '../ordonnance/entities/ligne-ordonnance.entity';
import { Certificat } from '../certificat/entities/certificat.entity';
import { RendezVous } from '../rendez-vous/entities/rendez-vous.entity';
import { CabinetService } from '../common/services/cabinet.service';

/**
 * AiModule — Dr. Amira, fully isolated.
 *
 * Can be removed from DesktopAppModule.imports without
 * breaking any existing functionality.
 *
 * Reads from: Patient, Consultation, Ordonnance, Certificat, RendezVous
 * Writes to: nothing (read-only)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Consultation,
      Ordonnance,
      LigneOrdonnance,
      Certificat,
      RendezVous,
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    LlmService,
    RagService,
    RulesService,
    ContextService,
    IndexerService,
    CabinetService,
  ],
})
export class AiModule {}
