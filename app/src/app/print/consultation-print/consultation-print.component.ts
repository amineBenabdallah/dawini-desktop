import { Component, OnInit, inject, signal, input } from '@angular/core';
import { ConsultationService, ConsultationDetail } from '../../core/services/consultation.service';

@Component({
  selector: 'app-consultation-print',
  standalone: true,
  templateUrl: './consultation-print.component.html',
})
export class ConsultationPrintComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly consultationService = inject(ConsultationService);
  readonly data = signal<ConsultationDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit() {
    this.consultationService.getById(this.id()).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
        setTimeout(() => window.print(), 400);
      },
      error: () => {
        this.error.set('Consultation introuvable.');
        this.loading.set(false);
      },
    });
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' });
  }
}
