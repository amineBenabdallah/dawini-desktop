import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RendezVous } from './entities/rendez-vous.entity';
import { Patient } from '../patient/entities/patient.entity';
import { RendezVousController } from './rendez-vous.controller';
import { RendezVousService } from './rendez-vous.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [TypeOrmModule.forFeature([RendezVous, Patient])],
  controllers: [RendezVousController],
  providers: [RendezVousService, CabinetService],
  exports: [RendezVousService],
})
export class RendezVousModule {}
