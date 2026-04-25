import { Component, input } from '@angular/core';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  // Appointments
  PLANNED:    { label: 'Planifié',    cls: 'bg-secondary' },
  CONFIRMED:  { label: 'Confirmé',   cls: 'bg-primary' },
  WAITING:    { label: 'En attente', cls: 'bg-warning text-dark' },
  DONE:       { label: 'Terminé',    cls: 'bg-success' },
  ABSENT:     { label: 'Absent',     cls: 'bg-danger' },
  CANCELLED:  { label: 'Annulé',     cls: 'bg-secondary bg-opacity-50 text-dark' },
  // Consultations
  EN_ATTENTE: { label: 'En attente', cls: 'bg-warning text-dark' },
  OPEN:       { label: 'En cours',   cls: 'bg-info text-dark' },
  FINALIZED:  { label: 'Finalisée',  cls: 'bg-success' },
  // Invoices
  UNPAID:     { label: 'Non payée',  cls: 'bg-danger' },
  PARTIAL:    { label: 'Partiel',    cls: 'bg-warning text-dark' },
  PAID:       { label: 'Payée',      cls: 'bg-success' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="badge rounded-pill {{ config().cls }}" style="font-size:.75rem">
      {{ config().label }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  config() {
    return STATUS_MAP[this.status()] ?? { label: this.status(), cls: 'bg-secondary' };
  }
}
