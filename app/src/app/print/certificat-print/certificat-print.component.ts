import { Component, OnInit, inject, signal, input } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

interface PrintData {
  numero: string; type: string; createdAt: string; content: string;
  patient: { firstName: string; lastName: string; dateNaissance?: string };
  docteur: { firstName: string; lastName: string; specialite?: string };
  joursRepos?: number;
}

const TYPE_LABELS: Record<string, string | undefined> = { REPOS: 'Certificat de repos médical', APTITUDE: 'Certificat d\'aptitude', INAPTITUDE: 'Certificat d\'inaptitude', SCOLAIRE: 'Certificat scolaire' };

@Component({
  selector: 'app-certificat-print',
  standalone: true,
  templateUrl: './certificat-print.component.html',
})
export class CertificatPrintComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  readonly data    = signal<PrintData | null>(null);
  readonly loading = signal(true);
  readonly error   = signal('');
  readonly typeLabels = TYPE_LABELS;

  ngOnInit() {
    this.api.get<PrintData>(`certificats/${this.id()}/print`).subscribe({
      next:  (d) => { this.data.set(d); this.loading.set(false); setTimeout(() => window.print(), 400); },
      error: ()  => { this.error.set('Certificat introuvable.'); this.loading.set(false); },
    });
  }

  formatDate(iso: string) { return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' }); }
}
