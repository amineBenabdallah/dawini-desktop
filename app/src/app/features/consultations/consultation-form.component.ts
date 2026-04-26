import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  ConsultationService,
  ConsultationDetail,
  ConsultationStatus,
} from '../../core/services/consultation.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AmiraWhisperComponent } from '../amira/amira-whisper.component';
import { Role } from '@shared/index';

interface PatientOption { id: string; firstName: string; lastName: string }
interface DocteurOption { id: string; firstName: string | null; lastName: string | null; email: string }

@Component({
  selector: 'app-consultation-form',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent, AmiraWhisperComponent],
  templateUrl: './consultation-form.component.html',
})
export class ConsultationFormComponent implements OnInit {
  readonly id = input<string>();

  private readonly consultationService = inject(ConsultationService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly isEdit = computed(() => !!this.id());
  readonly isFinalized = signal(false);

  readonly patients = signal<PatientOption[]>([]);
  readonly docteurs = signal<DocteurOption[]>([]);
  patientSearch = '';

  form = {
    patientId: '',
    docteurId: '',
    dateConsultation: '',
    motif: '',
    examenClinique: '',
    diagnostic: '',
    traitement: '',
    notes: '',
    tensionArterielle: '',
    poids: '' as string,
    temperature: '' as string,
  };

  readonly Role = Role;

  get isCurrentUserDoctor(): boolean { return this.auth.user()?.role === Role.DOCTEUR; }

  get currentDoctorLabel(): string {
    const u = this.auth.user();
    if (!u) return '';
    if (u.firstName || u.lastName) return `Dr ${u.lastName ?? ''} ${u.firstName ?? ''}`.trim();
    return u.email ?? '';
  }

  doctorLabel(d: DocteurOption): string {
    if (d.firstName || d.lastName) return `Dr ${d.lastName ?? ''} ${d.firstName ?? ''}`.trim();
    return d.email;
  }

  get canSave(): boolean {
    return !!this.form.patientId &&
           !!this.form.docteurId &&
           !!this.form.motif.trim() &&
           this.form.motif.trim().length <= 500 &&
           this.isValidBP() &&
           this.isValidPoids() &&
           this.isValidTemperature() &&
           !this.isFinalized();
  }

  ngOnInit() {
    this.loadDropdowns();

    if (this.isEdit()) {
      this.loadConsultation();
    } else {
      // Pre-fill docteurId if current user is a doctor
      const user = this.auth.user();
      if (user?.role === Role.DOCTEUR) {
        this.form.docteurId = user.id;
      }
      this.form.dateConsultation = new Date().toISOString().slice(0, 16);
      this.loading.set(false);
    }
  }

  private loadDropdowns() {
    this.api.get<{ data: PatientOption[] }>('patients', { limit: 100 }).subscribe({
      next: (res) => this.patients.set(res.data ?? []),
      error: () => {},
    });
    this.api.get<DocteurOption[]>('employees').subscribe({
      next: (res) => this.docteurs.set((res ?? []).filter((e: any) => e.role === Role.DOCTEUR)),
      error: () => {},
    });
  }

  private loadConsultation() {
    this.consultationService.getById(this.id()!).subscribe({
      next: (c: ConsultationDetail) => {
        if (c.statut === ConsultationStatus.FINALIZED) {
          this.isFinalized.set(true);
          this.toast.warning('Cette consultation est finalisée et ne peut pas être modifiée');
          void this.router.navigate(['/consultations', this.id()]);
          return;
        }
        if ((c.statut as string) === 'EN_ATTENTE') {
          this.toast.warning('Cette consultation doit être démarrée avant modification');
          void this.router.navigate(['/consultations', this.id()]);
          return;
        }
        this.form.patientId = c.patientId;
        this.form.docteurId = c.docteurId;
        this.form.dateConsultation = c.dateConsultation ? c.dateConsultation.slice(0, 16) : '';
        this.form.motif = c.motif ?? '';
        this.form.examenClinique = c.examenClinique ?? '';
        this.form.diagnostic = c.diagnostic ?? '';
        this.form.traitement = c.traitement ?? '';
        this.form.notes = c.notes ?? '';
        this.form.tensionArterielle = c.tensionArterielle ?? '';
        this.form.poids = c.poids != null ? String(c.poids) : '';
        this.form.temperature = c.temperature != null ? String(c.temperature) : '';
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Consultation introuvable');
        void this.router.navigate(['/consultations']);
      },
    });
  }

  save() {
    if (!this.canSave || this.saving()) return;
    this.saving.set(true);

    const payload: Record<string, unknown> = {
      motif: this.form.motif.trim(),
      examenClinique: this.form.examenClinique.trim() || undefined,
      diagnostic: this.form.diagnostic.trim() || undefined,
      traitement: this.form.traitement.trim() || undefined,
      notes: this.form.notes.trim() || undefined,
      tensionArterielle: this.form.tensionArterielle.trim() || undefined,
      poids: this.form.poids ? Number(this.form.poids) : undefined,
      temperature: this.form.temperature ? Number(this.form.temperature) : undefined,
    };

    if (this.isEdit()) {
      if (this.form.dateConsultation) {
        payload['dateConsultation'] = new Date(this.form.dateConsultation).toISOString();
      }
      this.consultationService.update(this.id()!, payload).subscribe({
        next: () => {
          this.toast.success('Consultation mise à jour');
          this.saving.set(false);
          void this.router.navigate(['/consultations', this.id()]);
        },
        error: (err) => {
          this.toast.error(err?.error?.message ?? 'Erreur lors de la mise à jour');
          this.saving.set(false);
        },
      });
    } else {
      payload['patientId'] = this.form.patientId;
      payload['docteurId'] = this.form.docteurId;
      if (this.form.dateConsultation) {
        payload['dateConsultation'] = new Date(this.form.dateConsultation).toISOString();
      }
      this.consultationService.create(payload as any).subscribe({
        next: (c) => {
          this.toast.success('Consultation créée');
          this.saving.set(false);
          void this.router.navigate(['/consultations', c.id]);
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
      void this.router.navigate(['/consultations', this.id()]);
    } else {
      void this.router.navigate(['/consultations']);
    }
  }

  // ── Validation helpers ──────────────────────────────────────────────────

  isValidBP(): boolean {
    if (!this.form.tensionArterielle.trim()) return true;
    return /^\d{2,3}\/\d{2,3}$/.test(this.form.tensionArterielle.trim());
  }

  isValidPoids(): boolean {
    if (!this.form.poids) return true;
    const v = Number(this.form.poids);
    return !isNaN(v) && v >= 1 && v <= 500;
  }

  isValidTemperature(): boolean {
    if (!this.form.temperature) return true;
    const v = Number(this.form.temperature);
    return !isNaN(v) && v >= 30 && v <= 45;
  }
}
