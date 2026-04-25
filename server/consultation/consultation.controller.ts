import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ConsultationService } from './consultation.service';

@Controller('consultations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsultationController {
  constructor(private service: ConsultationService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.service.create({ ...body, docteurId: body.docteurId || user.id });
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('statut') statut?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findAll(
      user.cabinetId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      { statut, dateFrom, dateTo },
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user.cabinetId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: User, @Body() body: any) {
    return this.service.update(id, user.cabinetId, body);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.start(id, user.cabinetId);
  }

  @Post(':id/finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.finalize(id, user.cabinetId);
  }
}
