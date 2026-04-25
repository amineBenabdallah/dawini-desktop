import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Desktop edition — single cabinet, but we keep cabinetId for:
 *   1. Data portability (import/export to/from web SaaS)
 *   2. Queue WiFi routes that reference cabinetId in URLs
 *
 * The cabinetId is set once during initial setup and never changes.
 * No TenantMiddleware — cabinetId is injected by CabinetService.
 */
export abstract class CabinetScopedEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar' })
  cabinetId: string;
}
