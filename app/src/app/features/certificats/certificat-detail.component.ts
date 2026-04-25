import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { Router } from '@angular/router';
import { CertificatService, Certificat, TYPE_LABELS } from '../../core/services/certificat.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { Role } from '@shared/index';

@Component({
  selector: 'app-certificat-detail',
  standalone: true,
  imports: [StatusBadgeComponent, LoadingSpinnerComponent, ConfirmModalComponent],
  templateUrl: './certificat-detail.component.html',
})
export class CertificatDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly certificatService = inject(CertificatService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly certificat = signal<Certificat | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly showAnnulModal = signal(false);
  readonly annulling = signal(false);
  readonly typeLabels = TYPE_LABELS;

  readonly isActive = computed(() => this.certificat()?.statut === 'ACTIVE');

  readonly isSameDay = computed(() => {
    const c = this.certificat();
    if (!c) return false;
    return new Date(c.createdAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
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
    this.certificatService.getById(this.id()).subscribe({
      next: (data) => { this.certificat.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Certificat introuvable');
        this.loading.set(false);
      },
    });
  }

  confirmAnnul() {
    this.annulling.set(true);
    this.certificatService.annuler(this.id()).subscribe({
      next: () => {
        this.toast.success('Certificat annulé');
        this.showAnnulModal.set(false);
        this.annulling.set(false);
        this.load();
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Impossible d\'annuler le certificat');
        this.annulling.set(false);
      },
    });
  }

  goEdit() { void this.router.navigate(['/certificats', this.id(), 'edit']); }
  goPrint() { window.open(`/print/certificat/${this.id()}`, '_blank'); }
  goBack() { void this.router.navigate(['/certificats']); }

  typeBadgeClass(type: string): string {
    switch (type) {
      case 'REPOS': return 'text-bg-primary';
      case 'APTITUDE': return 'text-bg-success';
      case 'INAPTITUDE': return 'text-bg-danger';
      case 'SCOLAIRE': return 'text-bg-info';
      default: return 'text-bg-secondary';
    }
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
