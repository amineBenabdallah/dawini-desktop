import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { Router } from '@angular/router';
import { OrdonnanceService, OrdonnanceWithLignes } from '../../core/services/ordonnance.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { Role } from '@shared/index';

@Component({
  selector: 'app-ordonnance-detail',
  standalone: true,
  imports: [StatusBadgeComponent, LoadingSpinnerComponent, ConfirmModalComponent],
  templateUrl: './ordonnance-detail.component.html',
})
export class OrdonnanceDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly ordonnanceService = inject(OrdonnanceService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly ordonnance = signal<OrdonnanceWithLignes | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly showAnnulModal = signal(false);
  readonly annulling = signal(false);

  readonly isActive = computed(() => this.ordonnance()?.statut === 'ACTIVE');

  readonly isSameDay = computed(() => {
    const o = this.ordonnance();
    if (!o) return false;
    const created = new Date(o.createdAt).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return created === today;
  });

  readonly canEdit = computed(() => {
    const role = this.auth.role();
    return this.isActive() && this.isSameDay() && (role === Role.DOCTEUR || role === Role.ADMIN);
  });

  readonly canAnnul = computed(() => {
    const role = this.auth.role();
    return this.isActive() && (role === Role.DOCTEUR || role === Role.ADMIN);
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.ordonnanceService.getById(this.id()).subscribe({
      next: (data) => { this.ordonnance.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Ordonnance introuvable');
        this.loading.set(false);
      },
    });
  }

  confirmAnnul() {
    this.annulling.set(true);
    this.ordonnanceService.annuler(this.id()).subscribe({
      next: () => {
        this.toast.success('Ordonnance annulée');
        this.showAnnulModal.set(false);
        this.annulling.set(false);
        this.load();
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Impossible d\'annuler l\'ordonnance');
        this.annulling.set(false);
      },
    });
  }

  goEdit() { void this.router.navigate(['/ordonnances', this.id(), 'edit']); }
  goPrint() { window.open(`/print/ordonnance/${this.id()}`, '_blank'); }
  goBack() { void this.router.navigate(['/ordonnances']); }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
