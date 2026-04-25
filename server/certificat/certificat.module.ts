import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certificat } from './entities/certificat.entity';
import { CertificatController } from './certificat.controller';
import { CertificatService } from './certificat.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Certificat])],
  controllers: [CertificatController],
  providers: [CertificatService, CabinetService],
})
export class CertificatModule {}
