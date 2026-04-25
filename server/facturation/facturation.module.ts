import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facture } from './entities/facture.entity';
import { Paiement } from './entities/paiement.entity';
import { FacturationController } from './facturation.controller';
import { FacturationService } from './facturation.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Facture, Paiement])],
  controllers: [FacturationController],
  providers: [FacturationService, CabinetService],
})
export class FacturationModule {}
