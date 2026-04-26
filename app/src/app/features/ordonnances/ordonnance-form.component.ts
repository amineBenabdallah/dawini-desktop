import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrdonnanceService, OrdonnanceWithLignes } from '../../core/services/ordonnance.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AmiraNotifyService } from '../../core/services/amira-notify.service';
import { ConsultationStatus } from '@shared/index';

interface InteractionWarning {
  drugA: string;
  drugB: string;
  severity: 'info' | 'warning' | 'danger';
  note: string;
}

interface ConsultationOption {
  id: string;
  motif: string;
  dateConsultation: string;
  patient: { firstName: string; lastName: string };
}

interface LigneForm {
  medicament: string;
  dosage: string;
  frequence: string;
  duree: string;
  instructions: string;
}

@Component({
  selector: 'app-ordonnance-form',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent],
  templateUrl: './ordonnance-form.component.html',
})
export class OrdonnanceFormComponent implements OnInit {
  readonly id = input<string>();

  private readonly ordonnanceService = inject(OrdonnanceService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly notify = inject(AmiraNotifyService);

  private interactionTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWarningKeys = new Set<string>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly isEdit = computed(() => !!this.id());

  readonly consultations = signal<ConsultationOption[]>([]);

  consultationId = '';
  lignes: LigneForm[] = [this.emptyLigne()];

  get canSave(): boolean {
    if (!this.isEdit() && !this.consultationId) return false;
    if (this.lignes.length === 0) return false;
    return this.lignes.every(l =>
      l.medicament.trim().length >= 1 && l.medicament.trim().length <= 200 &&
      l.dosage.trim().length >= 1 && l.dosage.trim().length <= 100 &&
      l.frequence.trim().length >= 1 && l.frequence.trim().length <= 200 &&
      l.duree.trim().length >= 1 && l.duree.trim().length <= 100 &&
      (l.instructions.trim().length <= 500),
    );
  }

  readonly prefilledConsultationId = signal('');

  ngOnInit() {
    if (this.isEdit()) {
      this.loadOrdonnance();
    } else {
      const fromQuery = this.route.snapshot.queryParamMap.get('consultationId') ?? '';
      if (fromQuery) {
        this.consultationId = fromQuery;
        this.prefilledConsultationId.set(fromQuery);
      }
      this.loadConsultations();
      this.loading.set(false);
    }
  }

  private loadConsultations() {
    this.api.get<{ data: ConsultationOption[] }>('consultations', { limit: 100 }).subscribe({
      next: (res) => this.consultations.set(
        (res.data ?? []).filter((c: any) =>
          c.statut === ConsultationStatus.FINALIZED || c.statut === 'OPEN',
        ),
      ),
      error: () => {},
    });
  }

  private loadOrdonnance() {
    this.ordonnanceService.getById(this.id()!).subscribe({
      next: (o: OrdonnanceWithLignes) => {
        if (o.statut === 'ANNULEE') {
          this.toast.warning('Cette ordonnance est annulée et ne peut pas être modifiée');
          void this.router.navigate(['/ordonnances', this.id()]);
          return;
        }
        const created = new Date(o.createdAt).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        if (created !== today) {
          this.toast.warning('La modification n\'est possible que le jour de création');
          void this.router.navigate(['/ordonnances', this.id()]);
          return;
        }
        this.consultationId = o.consultationId;
        this.lignes = (o.lignes ?? []).map(l => ({
          medicament: l.medicament,
          dosage: l.dosage,
          frequence: l.frequence,
          duree: l.duree,
          instructions: l.instructions ?? '',
        }));
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Ordonnance introuvable');
        void this.router.navigate(['/ordonnances']);
      },
    });
  }

  addLigne() {
    this.lignes = [...this.lignes, this.emptyLigne()];
  }

  removeLigne(index: number) {
    if (this.lignes.length <= 1) return;
    this.lignes = this.lignes.filter((_, i) => i !== index);
    this.scheduleInteractionCheck();
  }

  /**
   * Called from the medication name input on change. Debounces and queries
   * the backend for any drug-drug interactions across all current lines.
   * Shows new warnings via Amira's notify service; skips already-shown ones.
   */
  onMedicamentChange() {
    this.scheduleInteractionCheck();
  }

  private scheduleInteractionCheck() {
    if (this.interactionTimer) clearTimeout(this.interactionTimer);
    this.interactionTimer = setTimeout(() => this.runInteractionCheck(), 700);
  }

  private runInteractionCheck() {
    const meds = this.lignes
      .map((l) => l.medicament.trim())
      .filter((m) => m.length >= 3);
    if (meds.length < 2) return;

    this.api.post<{ warnings: InteractionWarning[] }>('ai/check-interactions', { medications: meds }).subscribe({
      next: (res) => {
        for (const w of res?.warnings ?? []) {
          const key = [w.drugA.toLowerCase(), w.drugB.toLowerCase()].sort().join('::');
          if (this.lastWarningKeys.has(key)) continue;
          this.lastWarningKeys.add(key);
          this.notify.show({
            title: 'Interaction médicamenteuse',
            body: `<strong>${w.drugA}</strong> + <strong>${w.drugB}</strong>: ${w.note}`,
            severity: w.severity,
          });
        }
      },
      error: () => {},
    });
  }

  save() {
    if (!this.canSave || this.saving()) return;
    this.saving.set(true);

    const lignesPayload = this.lignes.map(l => ({
      medicament: l.medicament.trim(),
      dosage: l.dosage.trim(),
      frequence: l.frequence.trim(),
      duree: l.duree.trim(),
      ...(l.instructions.trim() ? { instructions: l.instructions.trim() } : {}),
    }));

    if (this.isEdit()) {
      this.ordonnanceService.update(this.id()!, { lignes: lignesPayload }).subscribe({
        next: () => {
          this.toast.success('Ordonnance mise à jour');
          this.saving.set(false);
          void this.router.navigate(['/ordonnances', this.id()]);
        },
        error: (err) => {
          this.toast.error(err?.error?.message ?? 'Erreur lors de la mise à jour');
          this.saving.set(false);
        },
      });
    } else {
      this.ordonnanceService.create({ consultationId: this.consultationId, lignes: lignesPayload }).subscribe({
        next: (o) => {
          this.toast.success('Ordonnance créée');
          this.saving.set(false);
          void this.router.navigate(['/ordonnances', o.id]);
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
      void this.router.navigate(['/ordonnances', this.id()]);
    } else {
      void this.router.navigate(['/ordonnances']);
    }
  }

  private emptyLigne(): LigneForm {
    return { medicament: '', dosage: '', frequence: '', duree: '', instructions: '' };
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
