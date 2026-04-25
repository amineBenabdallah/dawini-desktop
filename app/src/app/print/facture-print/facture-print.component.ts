import { Component, OnInit, inject, signal, input } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

interface PrintData {
  numero: string; createdAt: string; printedAt: string; statut: string;
  montantTotal: number; montantPaye: number; solde: number; notes?: string | null;
  patient: { firstName: string; lastName: string };
  docteur: { firstName: string; lastName: string; specialite?: string };
  paiements: { montant: number; methode: string; datePaiement: string; note?: string | null }[];
}

const METHODE_LABELS: Record<string, string | undefined> = { ESPECES: 'Espèces', CHEQUE: 'Chèque', VIREMENT: 'Virement', EDAHABIA: 'Edahabia', BARIDIMOB: 'BaridiMob', CIB: 'Carte CIB', NONE: '—' };
const STATUT_LABELS: Record<string, string | undefined>  = { UNPAID: 'Non payée', PARTIAL: 'Partiellement payée', PAID: 'Payée', CANCELLED: 'Annulée' };

@Component({
  selector: 'app-facture-print',
  standalone: true,
  templateUrl: './facture-print.component.html',
})
export class FacturePrintComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  readonly data    = signal<PrintData | null>(null);
  readonly loading = signal(true);
  readonly error   = signal('');
  readonly methodeLabels = METHODE_LABELS;
  readonly statutLabels  = STATUT_LABELS;

  ngOnInit() {
    this.api.get<PrintData>(`factures/${this.id()}/print`).subscribe({
      next:  (d) => { this.data.set(d); this.loading.set(false); setTimeout(() => window.print(), 400); },
      error: ()  => { this.error.set('Facture introuvable.'); this.loading.set(false); },
    });
  }

  formatDate(iso: string) { return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' }); }
  formatAmount(n: number) { return Number(n).toLocaleString('fr-DZ') + ' DA'; }
}
