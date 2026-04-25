import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CabinetSettings } from './entities/cabinet-settings.entity';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [TypeOrmModule.forFeature([CabinetSettings])],
  controllers: [SettingsController],
  providers: [SettingsService, CabinetService],
})
export class SettingsModule {}
