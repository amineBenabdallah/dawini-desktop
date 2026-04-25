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
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private service: PatientsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.service.create({ ...body });
  }

  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const [data, total] = await this.service.findAll(
      user.cabinetId,
      search || q,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data, total };
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
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.softDelete(id, user.cabinetId);
  }
}
