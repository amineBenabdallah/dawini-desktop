import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { AUDIT_LOG_KEY, AuditLogMeta } from '../common/decorators/audit-log.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditLogMeta>(AUDIT_LOG_KEY, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return next.handle();

    return next.handle().pipe(
      tap((response) => {
        const resourceId = request.params?.id || response?.id || null;
        this.auditService.log({
          cabinetId: user.cabinetId,
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: meta.action,
          resource: meta.resource,
          resourceId,
        }).catch(() => {}); // Never block the response for audit failures
      }),
    );
  }
}
