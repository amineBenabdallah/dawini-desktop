import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { FacturationService } from './facturation.service';

@Controller('facturation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FacturationController {
  constructor(private service: FacturationService) {}

  @Post('invoice')
  createInvoice(@CurrentUser() user: User, @Body() body: any) {
    return this.service.createInvoice({ ...body, docteurId: body.docteurId || user.id });
  }

  @Get()
  findAll(@CurrentUser() user: User) { return this.service.findAll(user.cabinetId); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user.cabinetId);
  }

  @Patch(':id/payment')
  recordPayment(@Param('id') id: string, @CurrentUser() user: User, @Body() body: any) {
    return this.service.recordPayment(id, user.cabinetId, body);
  }
}
