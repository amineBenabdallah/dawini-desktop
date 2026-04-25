import { Component, OnInit, inject, signal, input } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

interface PrintData {
  numero: string; createdAt: string;
  patient: { firstName: string; lastName: string; dateNaissance?: string };
  docteur: { firstName: string; lastName: string; specialite?: string };
  medicaments: { nom: string; posologie: string; duree?: string }[];
  instructions?: string;
}

@Component({
  selector: 'app-ordonnance-print',
  standalone: true,
  templateUrl: './ordonnance-print.component.html',
})
export class OrdonnancePrintComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly api = inject(ApiService);
  readonly data    = signal<PrintData | null>(null);
  readonly loading = signal(true);
  readonly error   = signal('');

  ngOnInit() {
    this.api.get<PrintData>(`ordonnances/${this.id()}/print`).subscribe({
      next:  (d) => { this.data.set(d); this.loading.set(false); setTimeout(() => window.print(), 400); },
      error: ()  => { this.error.set('Ordonnance introuvable.'); this.loading.set(false); },
    });
  }

  formatDate(iso: string) { return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' }); }
}
