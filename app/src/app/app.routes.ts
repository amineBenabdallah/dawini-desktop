import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Desktop routes — stripped of:
 *   - Landing page (no marketing)
 *   - Register (replaced by Setup wizard)
 *   - Superadmin (no platform admin)
 *   - Chatbot (no Telegram/Claude)
 *   - Blog, Privacy, Terms, Contact pages
 */
export const routes: Routes = [
  // Setup wizard — only shown on first launch (no users in DB)
  {
    path: 'setup',
    loadComponent: () =>
      import('./features/setup/setup.component').then((m) => m.SetupComponent),
  },
  // Login
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  // Main layout — all protected routes
  {
    path: '',
    loadComponent: () =>
      import('./shared/layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'patients',
        loadComponent: () =>
          import('./features/patients/patients.component').then((m) => m.PatientsComponent),
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./features/appointments/appointments.component').then((m) => m.AppointmentsComponent),
      },
      {
        path: 'consultations',
        loadComponent: () =>
          import('./features/consultations/consultations.component').then((m) => m.ConsultationsComponent),
      },
      {
        path: 'consultations/new',
        loadComponent: () =>
          import('./features/consultations/consultation-form.component').then((m) => m.ConsultationFormComponent),
      },
      {
        path: 'consultations/:id/edit',
        loadComponent: () =>
          import('./features/consultations/consultation-form.component').then((m) => m.ConsultationFormComponent),
      },
      {
        path: 'consultations/:id',
        loadComponent: () =>
          import('./features/consultations/consultation-detail.component').then((m) => m.ConsultationDetailComponent),
      },
      {
        path: 'ordonnances',
        loadComponent: () =>
          import('./features/ordonnances/ordonnances.component').then((m) => m.OrdonnancesComponent),
      },
      {
        path: 'ordonnances/new',
        loadComponent: () =>
          import('./features/ordonnances/ordonnance-form.component').then((m) => m.OrdonnanceFormComponent),
      },
      {
        path: 'ordonnances/:id/edit',
        loadComponent: () =>
          import('./features/ordonnances/ordonnance-form.component').then((m) => m.OrdonnanceFormComponent),
      },
      {
        path: 'ordonnances/:id',
        loadComponent: () =>
          import('./features/ordonnances/ordonnance-detail.component').then((m) => m.OrdonnanceDetailComponent),
      },
      {
        path: 'certificats',
        loadComponent: () =>
          import('./features/certificats/certificats.component').then((m) => m.CertificatsComponent),
      },
      {
        path: 'certificats/new',
        loadComponent: () =>
          import('./features/certificats/certificat-form.component').then((m) => m.CertificatFormComponent),
      },
      {
        path: 'certificats/:id/edit',
        loadComponent: () =>
          import('./features/certificats/certificat-form.component').then((m) => m.CertificatFormComponent),
      },
      {
        path: 'certificats/:id',
        loadComponent: () =>
          import('./features/certificats/certificat-detail.component').then((m) => m.CertificatDetailComponent),
      },
      {
        path: 'facturation',
        loadComponent: () =>
          import('./features/facturation/facturation.component').then((m) => m.FacturationComponent),
      },
      {
        path: 'employees',
        canActivate: [() => roleGuard(['ADMIN'])],
        loadComponent: () =>
          import('./features/employees/employees.component').then((m) => m.EmployeesComponent),
      },
      {
        path: 'queue',
        loadComponent: () =>
          import('./features/queue/queue.component').then((m) => m.QueueComponent),
      },
      {
        path: 'settings',
        canActivate: [() => roleGuard(['ADMIN'])],
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },
  // Print routes — no layout wrapper
  {
    path: 'print/ordonnance/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./print/ordonnance-print/ordonnance-print.component').then((m) => m.OrdonnancePrintComponent),
  },
  {
    path: 'print/certificat/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./print/certificat-print/certificat-print.component').then((m) => m.CertificatPrintComponent),
  },
  {
    path: 'print/facture/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./print/facture-print/facture-print.component').then((m) => m.FacturePrintComponent),
  },
  {
    path: 'print/consultation/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./print/consultation-print/consultation-print.component').then((m) => m.ConsultationPrintComponent),
  },
  // Public: waiting room for patient phones on WiFi
  {
    path: 'salle/:cabinetId',
    loadComponent: () =>
      import('./features/queue/waiting-room.component').then((m) => m.WaitingRoomComponent),
  },
  // TV display board — fullscreen, dark, large fonts
  {
    path: 'display/queue',
    loadComponent: () =>
      import('./features/queue/tv-display.component').then((m) => m.TvDisplayComponent),
  },
  { path: '**', redirectTo: '' },
];
