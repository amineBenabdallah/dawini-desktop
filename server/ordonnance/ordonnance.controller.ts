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
import { Roles, Role } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { OrdonnanceService } from './ordonnance.service';

@Controller('ordonnances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdonnanceController {
  constructor(private service: OrdonnanceService) {}

  @Post()
  @Roles(Role.ADMIN, Role.DOCTEUR)
  create(@CurrentUser() user: User, @Body() body: any) {
    const { lignes, ...data } = body;
    return this.service.create(
      { ...data, docteurId: data.docteurId || user.id },
      lignes || [],
    );
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(
      user.cabinetId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 100,
    );
  }

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
