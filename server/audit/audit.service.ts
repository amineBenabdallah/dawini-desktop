import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction, AuditResource, Role } from '../common/enums';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
  ) {}

  async log(data: {
    cabinetId: string;
    userId: string;
    userEmail: string;
    userRole: Role;
    action: AuditAction;
    resource: AuditResource;
    resourceId?: string;
  }): Promise<void> {
    const entry = this.repo.create({
      cabinetId: data.cabinetId,
      userId: data.userId,
      userEmail: data.userEmail,
      userRole: data.userRole,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId || null,
    });
    await this.repo.save(entry);
  }

  async findAll(cabinetId: string, page = 1, limit = 50) {
    return this.repo.findAndCount({
      where: { cabinetId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }
}
