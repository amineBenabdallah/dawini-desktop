import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { RendezVousService } from './rendez-vous.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../patient/entities/patient.entity';

@Controller('rendez-vous')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RendezVousController {
  constructor(
    private service: RendezVousService,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
  ) {}

  @Post()
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.service.create({ ...body, docteurId: body.docteurId || user.id });
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const [rdvs, total] = await this.service.findAll(user.cabinetId, dateFrom, dateTo, date);

    // Enrich with patient names (Angular expects patientFirstName/patientLastName)
    const data = await Promise.all(rdvs.map(async (r) => {
      const patient = r.patientId ? await this.patientRepo.findOne({ where: { id: r.patientId } }) : null;
      return {
        ...r,
        patientFirstName: patient?.firstName || null,
        patientLastName: patient?.lastName || null,
      };
    }));

    return { data, total };
  }

  @Get('agenda/:date')
  agenda(@CurrentUser() user: User, @Param('date') date: string) {
    return this.service.agenda(user.cabinetId, date);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user.cabinetId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: User, @Body() body: any) {
    return this.service.update(id, user.cabinetId, body);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.cancel(id, user.cabinetId);
  }
}
