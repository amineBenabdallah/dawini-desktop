import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consultation } from './entities/consultation.entity';
import { ConsultationAttachment } from './entities/consultation-attachment.entity';
import { Patient } from '../patient/entities/patient.entity';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Consultation, ConsultationAttachment, Patient])],
  controllers: [ConsultationController],
  providers: [ConsultationService, CabinetService],
  exports: [ConsultationService],
})
export class ConsultationModule {}
