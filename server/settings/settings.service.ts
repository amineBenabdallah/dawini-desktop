import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CabinetSettings } from './entities/cabinet-settings.entity';
import { CabinetService } from '../common/services/cabinet.service';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(CabinetSettings) private repo: Repository<CabinetSettings>,
    private cabinetService: CabinetService,
  ) {}

  async get(): Promise<CabinetSettings> {
    const cabinetId = this.cabinetService.getCabinetId();
    let settings = await this.repo.findOne({ where: { cabinetId } });
    if (!settings) {
      settings = this.repo.create({ cabinetId });
      settings = await this.repo.save(settings);
    }
    return settings;
  }

  async update(data: Partial<CabinetSettings>): Promise<CabinetSettings> {
    const settings = await this.get();
    Object.assign(settings, data);
    return this.repo.save(settings);
  }
}
