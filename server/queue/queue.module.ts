import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { QueueToken } from './entities/queue-token.entity';
import { RendezVous } from '../rendez-vous/entities/rendez-vous.entity';
import { Patient } from '../patient/entities/patient.entity';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { QueueSseService } from './queue.sse.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([QueueToken, RendezVous, Patient]),
    EventEmitterModule.forRoot(),
  ],
  controllers: [QueueController],
  providers: [QueueService, QueueSseService, CabinetService],
  exports: [QueueService],
})
export class QueueModule {}
