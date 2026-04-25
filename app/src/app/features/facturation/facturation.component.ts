import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

interface Facture { id: string; numero: string; createdAt: string; statut: string; montantTotal: number; montantPaye: number; notes?: string; patient?: { firstName: string; lastName: string }; }
interface Paiement { id: string; montant: number; methode: string; datePaiement: string; note?: string; }
interface FactureDetail extends Facture { paiements: Paiement[]; solde: number; }

const METHOD_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', CHEQUE: 'Chèque', VIREMENT: 'Virement',
  EDAHABIA: 'Edahabia', BARIDIMOB: 'BaridiMob', CIB: 'CIB',
};

@Component({
  selector: 'app-facturation',
  standalone: true,
  imports: [PageHeaderComponent, StatusBadgeComponent, LoadingSpinnerComponent],
  templateUrl: './facturation.component.html',
})
export class FacturationComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly factures = signal<Facture[]>([]);
  readonly total    = signal(0);
  readonly loading  = signal(true);
  readonly selectedFacture = signal<FactureDetail | null>(null);
  readonly showDetailModal = signal(false);
  readonly detailLoading = signal(false);
  readonly methodLabels = METHOD_LABELS;

  ngOnInit() {
    this.api.get<{ data: Facture[]; total: number }>('factures', { limit: 20 }).subscribe({
      next: (res) => { this.factures.set(res.data ?? []); this.total.set(res.total ?? 0); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  viewDetail(id: string) {
    this.detailLoading.set(true);
    this.showDetailModal.set(true);
    this.api.get<FactureDetail>(`factures/${id}`).subscribe({
      next: (f) => { this.selectedFacture.set(f); this.detailLoading.set(false); },
      error: () => { this.showDetailModal.set(false); this.detailLoading.set(false); this.toast.error('Facture introuvable'); },
    });
  }

  closeDetailModal() { this.showDetailModal.set(false); this.selectedFacture.set(null); }

  printFacture(id: string) { window.open(`/print/facture/${id}`, '_blank'); }

  formatDate(iso: string)    { return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'short', year: 'numeric' }); }
  formatAmount(n: number)    { return Number(n).toLocaleString('fr-DZ') + ' DA'; }
  solde(f: Facture)          { return Number(f.montantTotal) - Number(f.montantPaye); }
}
