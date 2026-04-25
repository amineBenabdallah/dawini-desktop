import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrdonnanceService, Ordonnance, OrdonnanceWithLignes } from '../../core/services/ordonnance.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { Role } from '@shared/index';

@Component({
  selector: 'app-ordonnances',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, StatusBadgeComponent, LoadingSpinnerComponent],
  templateUrl: './ordonnances.component.html',
})
export class OrdonnancesComponent implements OnInit {
  private readonly ordonnanceService = inject(OrdonnanceService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly ordonnances = signal<Ordonnance[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly limit = 20;

  filterDateFrom = '';
  filterDateTo = '';
  readonly showFilters = signal(false);
  readonly selectedOrd = signal<OrdonnanceWithLignes | null>(null);
  readonly showDetailModal = signal(false);
  readonly detailLoading = signal(false);

  readonly totalPages = computed(() => Math.ceil(this.total() / this.limit) || 1);
  readonly pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));

  readonly canCreate = computed(() => {
    const role = this.auth.role();
    return role === Role.DOCTEUR || role === Role.ADMIN;
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.ordonnanceService.list({
      page: this.page(),
      limit: this.limit,
      ...(this.filterDateFrom ? { dateFrom: this.filterDateFrom } : {}),
      ...(this.filterDateTo ? { dateTo: this.filterDateTo } : {}),
    }).subscribe({
      next: (res) => {
        this.ordonnances.set(res.data ?? []);
        this.total.set(res.total ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Erreur lors du chargement des ordonnances');
        this.loading.set(false);
      },
    });
  }

  applyFilters() {
    this.page.set(1);
    this.load();
  }

  resetFilters() {
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
    this.detailLoading.set(true);
    this.showDetailModal.set(true);
    this.ordonnanceService.getById(id).subscribe({
      next: (o) => { this.selectedOrd.set(o); this.detailLoading.set(false); },
      error: () => { this.showDetailModal.set(false); this.detailLoading.set(false); this.toast.error('Ordonnance introuvable'); },
    });
  }

  closeDetailModal() { this.showDetailModal.set(false); this.selectedOrd.set(null); }

  goEdit(id: string) { void this.router.navigate(['/ordonnances', id, 'edit']); }

  createNew() {
    void this.router.navigate(['/ordonnances', 'new']);
  }

  printOrdonnance(id: string, event: Event) {
    event.stopPropagation();
    window.open(`/print/ordonnance/${id}`, '_blank');
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
