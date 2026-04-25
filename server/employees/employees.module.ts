import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { CabinetService } from '../common/services/cabinet.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken])],
  controllers: [EmployeesController],
  providers: [EmployeesService, CabinetService],
})
export class EmployeesModule {}
