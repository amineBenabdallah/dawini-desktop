import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private service: EmployeesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DOCTEUR, Role.SECRETAIRE)
  findAll(@CurrentUser() user: User) { return this.service.findAll(user.cabinetId); }

  @Post('invite')
  @Roles(Role.ADMIN)
  invite(@Body() body: { email: string; role: Role }) {
    return this.service.invite(body);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: { email: string; password: string; role: Role; firstName: string; lastName: string }) {
    return this.service.create(body);
  }

  @Patch(':id/toggle-active')
  @Roles(Role.ADMIN)
  toggleActive(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.toggleActive(id, user.cabinetId);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  changeRole(@Param('id') id: string, @CurrentUser() user: User, @Body() body: { role: Role }) {
    return this.service.changeRole(id, user.cabinetId, body.role);
  }

  @Patch(':id/shifts')
  @Roles(Role.ADMIN)
  updateShifts(@Param('id') id: string, @CurrentUser() user: User, @Body() body: { shifts: any[] }) {
    return this.service.updateShifts(id, user.cabinetId, body.shifts);
  }
}
