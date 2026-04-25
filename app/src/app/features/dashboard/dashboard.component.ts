import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

interface Stats {
  todayAppointments: number;
  waitingPatients: number;
  totalPatients: number;
  unpaidInvoices: number;
}

interface Appointment {
  id: string;
  dateHeure: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  statut: string;
  motif?: string;
}

function localDateStr(): string {
  const d = new Date();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly stats             = signal<Stats>({ todayAppointments: 0, waitingPatients: 0, totalPatients: 0, unpaidInvoices: 0 });
  readonly todayAppointments = signal<Appointment[]>([]);
  readonly loading           = signal(true);
  readonly refreshing        = signal(false);
  readonly lastRefreshed     = signal<Date | null>(null);

  readonly today = new Date().toLocaleDateString('fr-DZ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  ngOnInit() {
    this.loadAgenda();
    this.api.get<{ total: number }>('patients').subscribe({
      next:  (res) => this.stats.update(s => ({ ...s, totalPatients: res.total ?? 0 })),
      error: ()    => { /* stat stays at 0 — non-blocking */ },
    });
    this.api.get<{ total: number }>('factures', { statut: 'UNPAID' }).subscribe({
      next:  (res) => this.stats.update(s => ({ ...s, unpaidInvoices: res.total ?? 0 })),
      error: ()    => { /* stat stays at 0 — non-blocking */ },
    });
  }

  loadAgenda(isRefresh = false) {
    if (isRefresh) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }
    this.api.get<{ data: Appointment[]; total: number }>('rendez-vous', { date: localDateStr(), limit: 20 }).subscribe({
      next: (res) => {
        this.todayAppointments.set(res.data ?? []);
        const waiting = res.data?.filter(a => a.statut === 'WAITING').length ?? 0;
        this.stats.update(s => ({ ...s, todayAppointments: res.total ?? 0, waitingPatients: waiting }));
        this.loading.set(false);
        this.refreshing.set(false);
        this.lastRefreshed.set(new Date());
      },
      error: () => {
        this.loading.set(false);
        this.refreshing.set(false);
      },
    });
  }

  initials(appt: Appointment): string {
    const f = appt.patientFirstName?.[0] ?? '';
    const l = appt.patientLastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  }

  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }

  lastRefreshedLabel(): string {
    const d = this.lastRefreshed();
    if (!d) return '';
    return d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });
  }

  statusLabel(s: string): string {
    return ({ PLANNED: 'Planifié', CONFIRMED: 'Confirmé', WAITING: 'En salle', DONE: 'Terminé', ABSENT: 'Absent', CANCELLED: 'Annulé' } as Record<string,string>)[s] ?? s;
  }

  statusClass(s: string): string {
    return ({ PLANNED: 'secondary', CONFIRMED: 'primary', WAITING: 'warning', DONE: 'success', ABSENT: 'danger', CANCELLED: 'secondary' } as Record<string,string>)[s] ?? 'secondary';
  }
}
