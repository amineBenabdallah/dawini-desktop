import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ordonnance } from './entities/ordonnance.entity';
import { LigneOrdonnance } from './entities/ligne-ordonnance.entity';
import { Consultation } from '../consultation/entities/consultation.entity';
import { Patient } from '../patient/entities/patient.entity';
import { OrdonnanceController } from './ordonnance.controller';
import { OrdonnanceService } from './ordonnance.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ordonnance, LigneOrdonnance, Consultation, Patient])],
  controllers: [OrdonnanceController],
  providers: [OrdonnanceService, CabinetService],
  exports: [OrdonnanceService],
})
export class OrdonnanceModule {}
