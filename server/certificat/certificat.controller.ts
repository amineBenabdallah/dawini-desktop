import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CertificatService } from './certificat.service';

@Controller('certificats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CertificatController {
  constructor(private service: CertificatService) {}

  @Post()
  @Roles(Role.ADMIN, Role.DOCTEUR)
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.service.create({ ...body, docteurId: body.docteurId || user.id });
  }

  @Get()
  findAll(@CurrentUser() user: User) { return this.service.findAll(user.cabinetId); }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.findOne(id, user.cabinetId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.DOCTEUR)
  update(@Param('id') id: string, @CurrentUser() user: User, @Body() body: any) {
    return this.service.update(id, user.cabinetId, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.DOCTEUR)
  cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.cancel(id, user.cabinetId);
  }
}
