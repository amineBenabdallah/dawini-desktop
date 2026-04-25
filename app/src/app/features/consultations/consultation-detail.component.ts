import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  ConsultationService,
  ConsultationDetail,
  ConsultationAttachment,
  ConsultationStatus,
} from '../../core/services/consultation.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { ConfirmModalComponent } from '../../shared/components/confirm-modal/confirm-modal.component';
import { Role } from '@shared/index';

@Component({
  selector: 'app-consultation-detail',
  standalone: true,
  imports: [StatusBadgeComponent, LoadingSpinnerComponent, ConfirmModalComponent, FormsModule],
  templateUrl: './consultation-detail.component.html',
})
export class ConsultationDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly consultationService = inject(ConsultationService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly consultation = signal<ConsultationDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly showFinalizeModal = signal(false);
  readonly finalizing = signal(false);
  readonly uploading = signal(false);

  // Invoice
  readonly hasInvoice = signal(false);
  readonly showInvoiceModal = signal(false);
  readonly invoiceSaving = signal(false);
  invoiceAmount = '';
  invoiceNotes = '';

  readonly isOpen = computed(() => this.consultation()?.statut === ConsultationStatus.OPEN);

  readonly isFinalized = computed(() =>
    this.consultation()?.statut === ConsultationStatus.FINALIZED,
  );

  readonly canCreateInvoice = computed(() => {
    const role = this.auth.role();
    return this.isFinalized() && !this.hasInvoice() &&
      (role === Role.DOCTEUR || role === Role.SECRETAIRE || role === Role.ADMIN);
  });

  readonly canCreateOrdonnance = computed(() =>
    (this.isOpen() || this.isFinalized()) && this.auth.role() === Role.DOCTEUR,
  );

  readonly canEdit = computed(() => {
    const role = this.auth.role();
    return this.isOpen() && (role === Role.DOCTEUR || role === Role.ADMIN);
  });

  readonly canFinalize = computed(() => {
    const user = this.auth.user();
    return this.isOpen() &&
      (user?.role === Role.DOCTEUR || user?.role === Role.ADMIN);
  });

  readonly canUpload = computed(() => this.isOpen());

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.consultationService.getById(this.id()).subscribe({
      next: (data) => {
        this.consultation.set(data);
        this.loading.set(false);
        // Check if an invoice already exists for this consultation
        if (data.statut === ConsultationStatus.FINALIZED) {
          this.checkInvoice();
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Consultation introuvable');
        this.loading.set(false);
      },
    });
  }

  private checkInvoice() {
    this.api.get<{ data: { id: string }[]; total: number }>('factures', {
      consultationId: this.id() as unknown as string,
      limit: 1,
    }).subscribe({
      next: (res) => this.hasInvoice.set((res.total ?? 0) > 0),
      error: () => {},
    });
  }

  // ── Finalize ──────────────────────────────────────────────────────────────

  confirmFinalize() {
    this.finalizing.set(true);
    this.consultationService.finalize(this.id()).subscribe({
      next: () => {
        this.toast.success('Consultation finalisée');
        this.showFinalizeModal.set(false);
        this.finalizing.set(false);
        this.load();
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Impossible de finaliser la consultation');
        this.finalizing.set(false);
      },
    });
  }

  // ── Attachment upload ─────────────────────────────────────────────────────

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.toast.error('Le fichier dépasse la taille maximale de 10 Mo');
      input.value = '';
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      this.toast.error('Seuls les fichiers PDF, JPEG et PNG sont autorisés');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.consultationService.uploadAttachment(this.id(), file).subscribe({
      next: () => {
        this.toast.success('Fichier ajouté');
        this.uploading.set(false);
        input.value = '';
        this.load();
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Erreur lors de l\'envoi du fichier');
        this.uploading.set(false);
        input.value = '';
      },
    });
  }

  // ── Invoice ───────────────────────────────────────────────────────────────

  openInvoiceModal() {
    this.invoiceAmount = '';
    this.invoiceNotes = '';
    this.showInvoiceModal.set(true);
  }

  createInvoice() {
    const montant = Number(this.invoiceAmount);
    if (!montant || montant <= 0 || this.invoiceSaving()) return;
    this.invoiceSaving.set(true);
    this.api.post<{ id: string }>('factures', {
      consultationId: this.id(),
      montantTotal: montant,
      notes: this.invoiceNotes.trim() || undefined,
    }).subscribe({
      next: () => {
        this.toast.success('Facture créée');
        this.invoiceSaving.set(false);
        this.showInvoiceModal.set(false);
        this.hasInvoice.set(true);
      },
      error: (err) => {
        this.toast.error(err?.error?.message ?? 'Erreur lors de la création de la facture');
        this.invoiceSaving.set(false);
      },
    });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goEdit() { void this.router.navigate(['/consultations', this.id(), 'edit']); }
  goPrint() { window.open(`/print/consultation/${this.id()}`, '_blank'); }
  goBack() { void this.router.navigate(['/consultations']); }
  goCreateOrdonnance() {
    void this.router.navigate(['/ordonnances', 'new'], { queryParams: { consultationId: this.id() } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' o';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
  }

  fileIcon(mime: string): string {
    if (mime === 'application/pdf') return 'bi-file-earmark-pdf text-danger';
    if (mime.startsWith('image/')) return 'bi-file-earmark-image text-primary';
    return 'bi-file-earmark text-muted';
  }

  downloadUrl(att: ConsultationAttachment): string {
    return `/api/consultations/${this.id()}/attachments/${att.id}`;
  }
}
