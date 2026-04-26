import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patient/patients.module';
import { RendezVousModule } from './rendez-vous/rendez-vous.module';
import { ConsultationModule } from './consultation/consultation.module';
import { OrdonnanceModule } from './ordonnance/ordonnance.module';
import { CertificatModule } from './certificat/certificat.module';
import { FacturationModule } from './facturation/facturation.module';
import { AuditModule } from './audit/audit.module';
import { EmployeesModule } from './employees/employees.module';
import { QueueModule } from './queue/queue.module';
import { SettingsModule } from './settings/settings.module';
import { AiModule } from './ai/ai.module';
import { CabinetService } from './common/services/cabinet.service';

/**
 * Desktop AppModule — stripped of:
 *   - SaasPaymentModule (no Stripe)
 *   - SuperadminModule (no platform admin)
 *   - TelegramChatbotModule (no bot, no Claude API)
 *   - SentryModule (no cloud error tracking)
 *   - TenantMiddleware (single cabinet, no multi-tenancy)
 *
 * Uses SQLite via better-sqlite3 instead of PostgreSQL.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH || 'dawini.db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // safe for desktop — single user, single DB
      logging: process.env.NODE_ENV === 'development',
    }),
    HealthModule,
    AuthModule,
    PatientsModule,
    RendezVousModule,
    ConsultationModule,
    OrdonnanceModule,
    CertificatModule,
    FacturationModule,
    AuditModule,
    EmployeesModule,
    QueueModule,
    SettingsModule,
    AiModule,
  ],
  providers: [CabinetService],
  exports: [CabinetService],
})
export class DesktopAppModule {}
