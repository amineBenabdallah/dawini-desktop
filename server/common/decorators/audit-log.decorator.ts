import { SetMetadata } from '@nestjs/common';
import { AuditAction, AuditResource } from '../enums';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMeta {
  resource: AuditResource;
  action: AuditAction;
}

export const AuditLog = (resource: AuditResource, action: AuditAction) =>
  SetMetadata(AUDIT_LOG_KEY, { resource, action });
