import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConsultationService, Consultation, ConsultationStatus } from '../../core/services/consultation.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { Role } from '@shared/index';

@Component({
  selector: 'app-consultations',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, StatusBadgeComponent, LoadingSpinnerComponent],
  templateUrl: './consultations.component.html',
})
export class ConsultationsComponent implements OnInit {
  private readonly consultationService = inject(ConsultationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly consultations = signal<Consultation[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly limit = 20;

  // Filters
  filterStatut = '';
  filterDateFrom = '';
  filterDateTo = '';

  readonly showFilters = signal(false);

  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit) || 1);
  readonly pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  readonly canCreate = computed(() => {
    const role = this.auth.role();
    return role === Role.DOCTEUR || role === Role.ADMIN;
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.consultationService.list({
      page: this.page(),
      limit: this.limit,
      ...(this.filterStatut ? { statut: this.filterStatut as ConsultationStatus } : {}),
      ...(this.filterDateFrom ? { dateFrom: this.filterDateFrom } : {}),
      ...(this.filterDateTo ? { dateTo: this.filterDateTo } : {}),
    }).subscribe({
      next: (res) => {
        this.consultations.set(res.data ?? []);
        this.total.set(res.total ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Erreur lors du chargement des consultations');
        this.loading.set(false);
      },
    });
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  resetFilters() {
    this.filterStatut = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.page.set(1);
    this.load();
  }

  setPage(p: number) {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.load();
  }

  viewDetail(id: string) {
    void this.router.navigate(['/consultations', id]);
  }

  createNew() {
    void this.router.navigate(['/consultations', 'new']);
  }

  startConsultation(id: string) {
    this.consultationService.start(id).subscribe({
      next: () => {
        this.toast.success('Consultation démarrée');
        void this.router.navigate(['/consultations', id, 'edit']);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Erreur lors du démarrage');
      },
    });
  }

  isEnAttente(statut: ConsultationStatus): boolean {
    return (statut as string) === 'EN_ATTENTE';
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
