import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CertificatService, Certificat, TYPE_LABELS } from '../../core/services/certificat.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ConsultationStatus } from '@shared/index';

interface ConsultationOption {
  id: string;
  motif: string;
  dateConsultation: string;
  patient: { firstName: string; lastName: string };
}

const TEMPLATES: Record<string, string> = {
  REPOS: 'Je soussigné(e), certifie que le/la patient(e) sus-nommé(e) nécessite un repos médical à compter de ce jour.',
  APTITUDE: 'Je soussigné(e), certifie que le/la patient(e) sus-nommé(e) est apte à exercer ses activités professionnelles.',
  INAPTITUDE: 'Je soussigné(e), certifie que le/la patient(e) sus-nommé(e) est inapte à exercer ses activités professionnelles.',
  SCOLAIRE: 'Je soussigné(e), certifie que le/la patient(e) sus-nommé(e) est en bonne santé et ne présente aucune affection contagieuse.',
};

@Component({
  selector: 'app-certificat-form',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent],
  templateUrl: './certificat-form.component.html',
})
export class CertificatFormComponent implements OnInit {
  readonly id = input<string>();

  private readonly certificatService = inject(CertificatService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly isEdit = computed(() => !!this.id());
  readonly consultations = signal<ConsultationOption[]>([]);
  readonly typeLabels = TYPE_LABELS;

  consultationId = '';
  type = '';
  contenu = '';
  joursRepos = '' as string;

  get isRepos(): boolean { return this.type === 'REPOS'; }

  get canSave(): boolean {
    if (!this.isEdit() && !this.consultationId) return false;
    if (!this.type) return false;
    if (!this.contenu.trim() || this.contenu.trim().length > 2000) return false;
    if (this.isRepos && this.joursRepos) {
      const v = Number(this.joursRepos);
      if (isNaN(v) || v < 1 || v > 180) return false;
    }
    return true;
  }

  ngOnInit() {
    if (this.isEdit()) {
      this.loadCertificat();
    } else {
      this.loadConsultations();
      this.loading.set(false);
    }
  }

  private loadConsultations() {
    this.api.get<{ data: ConsultationOption[] }>('consultations', {
      statut: ConsultationStatus.FINALIZED,
      limit: 100,
    }).subscribe({
      next: (res) => this.consultations.set(res.data ?? []),
      error: () => {},
    });
  }

  private loadCertificat() {
    this.certificatService.getById(this.id()!).subscribe({
      next: (c: Certificat) => {
        if (c.statut === 'ANNULEE') {
          this.toast.warning('Ce certificat est annulé et ne peut pas être modifié');
          void this.router.navigate(['/certificats', this.id()]);
          return;
        }
        const created = new Date(c.createdAt).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        if (created !== today) {
          this.toast.warning('La modification n\'est possible que le jour de création');
          void this.router.navigate(['/certificats', this.id()]);
          return;
        }
        this.consultationId = c.consultationId;
        this.type = c.type;
        this.contenu = c.contenu;
        this.joursRepos = c.joursRepos != null ? String(c.joursRepos) : '';
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Certificat introuvable');
        void this.router.navigate(['/certificats']);
      },
    });
  }

  onTypeChange() {
    // Only pre-fill template on create (don't overwrite existing content in edit)
    if (!this.isEdit() && this.type && TEMPLATES[this.type]) {
      this.contenu = TEMPLATES[this.type];
    }
    // Clear joursRepos if not REPOS
    if (this.type !== 'REPOS') {
      this.joursRepos = '';
    }
  }

  save() {
    if (!this.canSave || this.saving()) return;
    this.saving.set(true);

    const payload: Record<string, unknown> = {
      type: this.type,
      contenu: this.contenu.trim(),
      ...(this.isRepos && this.joursRepos ? { joursRepos: Number(this.joursRepos) } : {}),
    };

    if (this.isEdit()) {
      this.certificatService.update(this.id()!, payload).subscribe({
        next: () => {
          this.toast.success('Certificat mis à jour');
          this.saving.set(false);
          void this.router.navigate(['/certificats', this.id()]);
        },
        error: (err) => {
          this.toast.error(err?.error?.message ?? 'Erreur lors de la mise à jour');
          this.saving.set(false);
        },
      });
    } else {
      payload['consultationId'] = this.consultationId;
      this.certificatService.create(payload as any).subscribe({
        next: (c) => {
          this.toast.success('Certificat créé');
          this.saving.set(false);
          void this.router.navigate(['/certificats', c.id]);
        },
        error: (err) => {
          this.toast.error(err?.error?.message ?? 'Erreur lors de la création');
          this.saving.set(false);
        },
      });
    }
  }

  cancel() {
    if (this.isEdit()) {
      void this.router.navigate(['/certificats', this.id()]);
    } else {
      void this.router.navigate(['/certificats']);
    }
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
