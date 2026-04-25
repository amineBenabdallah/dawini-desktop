import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ToastComponent } from '../components/toast/toast.component';
import { UpdateBannerComponent } from '../components/update-banner/update-banner.component';
import { LicenseBannerComponent } from '../components/license-banner/license-banner.component';
import { AmiraFabComponent } from '../../features/amira/amira-fab.component';
import { AmiraPanelComponent } from '../../features/amira/amira-panel.component';
import { AmiraSuggestComponent } from '../../features/amira/amira-suggest.component';
import { AuthService } from '../../core/services/auth.service';
import { PlatformService } from '../../core/services/platform.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToastComponent,
    UpdateBannerComponent,
    LicenseBannerComponent,
    AmiraFabComponent,
    AmiraPanelComponent,
    AmiraSuggestComponent,
  ],
  template: `
    <app-update-banner />
    <app-license-banner />

    <div class="app-layout">
      <!-- Sidebar -->
      <aside class="app-sidebar">
        <div class="sidebar-brand p-3">
          <img src="assets/dawini-icon.svg" alt="" width="28" height="28" />
          <span class="ms-2 fw-bold" style="color: var(--dw-primary)">Dawini</span>
        </div>

        <nav class="sidebar-nav flex-grow-1">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
            <i class="bi bi-grid-1x2"></i> Tableau de bord
          </a>
          <a routerLink="/patients" routerLinkActive="active" class="nav-link">
            <i class="bi bi-people"></i> Patients
          </a>
          <a routerLink="/appointments" routerLinkActive="active" class="nav-link">
            <i class="bi bi-calendar-event"></i> Rendez-vous
          </a>
          <a routerLink="/consultations" routerLinkActive="active" class="nav-link">
            <i class="bi bi-clipboard2-pulse"></i> Consultations
          </a>
          <a routerLink="/ordonnances" routerLinkActive="active" class="nav-link">
            <i class="bi bi-file-earmark-medical"></i> Ordonnances
          </a>
          <a routerLink="/certificats" routerLinkActive="active" class="nav-link">
            <i class="bi bi-file-earmark-check"></i> Certificats
          </a>
          <a routerLink="/facturation" routerLinkActive="active" class="nav-link">
            <i class="bi bi-receipt"></i> Facturation
          </a>
          <a routerLink="/queue" routerLinkActive="active" class="nav-link">
            <i class="bi bi-hourglass-split"></i> File d'attente
          </a>

          @if (auth.role() === 'ADMIN') {
            <div class="nav-divider my-2 mx-3" style="border-top: 1px solid var(--dw-border)"></div>
            <a routerLink="/employees" routerLinkActive="active" class="nav-link">
              <i class="bi bi-person-badge"></i> Employ&eacute;s
            </a>
            <a routerLink="/settings" routerLinkActive="active" class="nav-link">
              <i class="bi bi-gear"></i> Param&egrave;tres
            </a>
          }
        </nav>

        <div class="sidebar-footer p-3 border-top" style="border-color: var(--dw-border) !important">
          <div class="d-flex align-items-center gap-2">
            <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                 style="width:32px;height:32px;font-size:13px;font-weight:600">
              {{ initials() }}
            </div>
            <div class="flex-grow-1" style="min-width:0">
              <div class="fw-semibold text-truncate" style="font-size:13px">
                {{ auth.user()?.firstName }} {{ auth.user()?.lastName }}
              </div>
              <div class="text-muted text-truncate" style="font-size:11px">
                {{ auth.user()?.role }}
              </div>
            </div>
            <button class="btn btn-sm btn-light" (click)="auth.logout()" title="D&eacute;connexion">
              <i class="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <div class="app-main">
        <div class="app-header">
          <span class="fw-semibold" style="font-size: 15px">{{ pageTitle() }}</span>

          <div class="ms-auto d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-light" (click)="openTvDisplay()" title="&Eacute;cran salle d'attente">
              <i class="bi bi-tv"></i>
            </button>
          </div>
        </div>

        <main class="app-content route-enter">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-toast />
    <app-amira-fab (toggle)="amiraOpen.set(!amiraOpen())" />
    <app-amira-suggest />
    <app-amira-panel [open]="amiraOpen()" (close)="amiraOpen.set(false)"
                     [screen]="currentScreen()" [patientId]="currentPatientId()"
                     [contextLabel]="amiraContextLabel()" />
  `,
})
export class LayoutComponent {
  readonly auth = inject(AuthService);
  readonly platform = inject(PlatformService);

  // Amira state
  amiraOpen = signal(false);
  currentScreen = signal('dashboard');
  currentPatientId = signal<string | undefined>(undefined);
  amiraContextLabel = signal('');

  initials(): string {
    const u = this.auth.user();
    if (!u) return '';
    return (u.firstName?.[0] || '') + (u.lastName?.[0] || '');
  }

  pageTitle(): string {
    const path = window.location.hash?.replace('#/', '') || window.location.pathname.replace('/', '');
    const titles: Record<string, string> = {
      dashboard: 'Tableau de bord',
      patients: 'Patients',
      appointments: 'Rendez-vous',
      consultations: 'Consultations',
      ordonnances: 'Ordonnances',
      certificats: 'Certificats',
      facturation: 'Facturation',
      queue: "File d'attente",
      employees: 'Employ\u00e9s',
      settings: 'Param\u00e8tres',
    };
    return titles[path] || 'Dawini';
  }

  openTvDisplay(): void {
    this.platform.openTvDisplay();
  }
}
