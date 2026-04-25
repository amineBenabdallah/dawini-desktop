import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import * as QRCode from 'qrcode';

interface PatientOption { id: string; firstName: string; lastName: string }

interface QueueToken {
  id: string;
  patientName: string;
  type: 'APPOINTMENT' | 'WALK_IN';
  status: 'WAITING' | 'CALLED' | 'CALLED_MANUAL' | 'DONE' | 'ABSENT';
  appointmentTime: string | null;
  arrivedAt: string;
  isManual: boolean;
}

interface SecretaryView {
  appointmentLane: QueueToken[];
  walkInLane:      QueueToken[];
}

interface PendingCheckin {
  rdvId:           string;
  patientName:     string;
  patientNumber:   string;
  appointmentTime: string;
  motif:           string;
}

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './queue.component.html',
})
export class QueueComponent implements OnInit, OnDestroy {
  private readonly api   = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly auth  = inject(AuthService);

  readonly apptLane   = signal<QueueToken[]>([]);
  readonly walkInLane = signal<QueueToken[]>([]);
  readonly loading    = signal(true);
  readonly calling    = signal(false);
  readonly actionId   = signal<string | null>(null);
  readonly showQr        = signal(false);
  readonly qrDataUrl     = signal('');
  readonly showAddForm    = signal(false);
  readonly addPatientName = signal('');
  readonly addPatientId   = signal('');
  readonly addLoading     = signal(false);
  readonly patients       = signal<PatientOption[]>([]);

  readonly showCheckinPanel  = signal(false);
  readonly pendingCheckins   = signal<PendingCheckin[]>([]);
  readonly checkinPanelLoading = signal(false);
  readonly checkinActionId   = signal<string | null>(null);

  readonly waitingRoomUrl = computed(() => {
    const tenantId = this.auth.user()?.cabinetId;
    if (!tenantId) return '';
    return `${window.location.origin}/salle/${tenantId}`;
  });

  readonly totalWaiting = computed(() =>
    [...this.apptLane(), ...this.walkInLane()]
      .filter(t => t.status === 'WAITING').length
  );

  readonly calledAppt    = computed(() => this.apptLane().filter(t => t.status === 'CALLED' || t.status === 'CALLED_MANUAL'));
  readonly waitingAppt   = computed(() => this.apptLane().filter(t => t.status === 'WAITING'));
  readonly calledWalkIn  = computed(() => this.walkInLane().filter(t => t.status === 'CALLED' || t.status === 'CALLED_MANUAL'));
  readonly waitingWalkIn = computed(() => this.walkInLane().filter(t => t.status === 'WAITING'));

  private pollSub?: Subscription;

  ngOnInit() {
    this.load();
    // Poll every 10 seconds for live updates
    this.pollSub = interval(10_000).subscribe(() => this.load());
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  load() {
    this.api.get<SecretaryView>('queue/secretary').subscribe({
      next: (res) => {
        this.apptLane.set(res.appointmentLane ?? []);
        this.walkInLane.set(res.walkInLane ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  callNext() {
    if (this.calling()) return;
    this.calling.set(true);
    this.api.patch<{ calledPatientName: string; type: string; isManual: boolean } | null>(
      'queue/next', {}
    ).subscribe({
      next: (res) => {
        this.calling.set(false);
        if (!res) {
          this.toast.success('La salle d\'attente est vide');
        } else if (res.isManual) {
          this.toast.success(`Appeler manuellement : ${res.calledPatientName}`);
        } else {
          this.toast.success(`Notification envoyée à ${res.calledPatientName}`);
        }
        this.load();
      },
      error: () => { this.calling.set(false); this.toast.error('Erreur lors de l\'appel'); },
    });
  }

  manualCall(token: QueueToken) {
    this.actionId.set(token.id);
    this.api.patch(`queue/${token.id}/manual`, {}).subscribe({
      next: () => { this.actionId.set(null); this.load(); this.toast.success(`${token.patientName} — appel manuel`); },
      error: () => { this.actionId.set(null); this.toast.error('Erreur'); },
    });
  }

  markDone(token: QueueToken) {
    this.actionId.set(token.id);
    this.api.patch(`queue/${token.id}/done`, {}).subscribe({
      next: () => { this.actionId.set(null); this.load(); },
      error: () => { this.actionId.set(null); this.toast.error('Erreur'); },
    });
  }

  markAbsent(token: QueueToken) {
    this.actionId.set(token.id);
    this.api.patch(`queue/${token.id}/absent`, {}).subscribe({
      next: () => { this.actionId.set(null); this.load(); },
      error: () => { this.actionId.set(null); this.toast.error('Erreur'); },
    });
  }

  async openQr() {
    const url = this.waitingRoomUrl();
    if (!url) return;
    const dataUrl = await QRCode.toDataURL(url, { width: 260, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } });
    this.qrDataUrl.set(dataUrl);
    this.showQr.set(true);
  }

  closeQr() { this.showQr.set(false); }

  toggleCheckinPanel() {
    const opening = !this.showCheckinPanel();
    this.showCheckinPanel.set(opening);
    if (opening) {
      this.loadPendingCheckins();
    }
  }

  loadPendingCheckins() {
    this.checkinPanelLoading.set(true);
    this.api.get<PendingCheckin[]>('queue/pending-checkin').subscribe({
      next: (list) => {
        this.pendingCheckins.set(list);
        this.checkinPanelLoading.set(false);
      },
      error: () => {
        this.checkinPanelLoading.set(false);
        this.toast.error('Impossible de charger les rendez-vous');
      },
    });
  }

  checkinRdv(rdvId: string, patientName: string) {
    if (this.checkinActionId()) return;
    this.checkinActionId.set(rdvId);
    this.api.post<{ tokenId: string }>('queue/checkin', { rdvId }).subscribe({
      next: () => {
        this.checkinActionId.set(null);
        this.toast.success(`${patientName} ajouté(e) en file d'attente`);
        // Remove from panel immediately, then refresh lane
        this.pendingCheckins.update(list => list.filter(p => p.rdvId !== rdvId));
        this.load();
      },
      error: (err) => {
        this.checkinActionId.set(null);
        const msg = err?.error?.message ?? 'Erreur lors de l\'enregistrement';
        this.toast.error(msg);
      },
    });
  }

  toggleAddForm() {
    const opening = !this.showAddForm();
    this.showAddForm.set(opening);
    this.addPatientId.set('');
    this.addPatientName.set('');
    if (opening && this.patients().length === 0) {
      this.loadPatients();
    }
  }

  /** Close the add-form on Escape; ignore all other keys. */
  onAddKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.showAddForm.set(false);
      this.addPatientName.set('');
    }
  }

  private loadPatients() {
    this.api.get<{ data: PatientOption[] }>('patients', { limit: '100' }).subscribe({
      next: (res) => this.patients.set(res.data ?? []),
      error: () => {},
    });
  }

  onPatientSelect(event: Event) {
    const select = event.target as HTMLSelectElement;
    const patientId = select.value;
    this.addPatientId.set(patientId);
    const patient = this.patients().find(p => p.id === patientId);
    if (patient) {
      this.addPatientName.set(`${patient.firstName} ${patient.lastName}`);
    } else {
      this.addPatientName.set('');
    }
  }

  addWalkIn() {
    const patientId = this.addPatientId();
    const name = this.addPatientName().trim();
    if (!patientId || !name || this.addLoading()) return;

    const tenantId = this.auth.user()?.cabinetId;
    if (!tenantId) {
      this.toast.error('Tenant introuvable');
      return;
    }

    this.addLoading.set(true);
    this.api.post<{ tokenId: string; estimatedPosition: number }>(
      'queue/join', { tenantId, patientName: name, patientId }
    ).subscribe({
      next: () => {
        this.addLoading.set(false);
        this.showAddForm.set(false);
        this.addPatientId.set('');
        this.addPatientName.set('');
        this.toast.success(`${name} ajouté(e) à la file`);
        this.load();
      },
      error: () => {
        this.addLoading.set(false);
        this.toast.error('Erreur lors de l\'ajout du patient');
      },
    });
  }

  copyLink() {
    navigator.clipboard.writeText(this.waitingRoomUrl()).then(() =>
      this.toast.success('Lien copié !')
    );
  }

  statusLabel(s: string): string {
    return {
      WAITING: 'En attente', CALLED: 'Appelé', CALLED_MANUAL: 'Appelé',
      DONE: 'Entré', ABSENT: 'Absent',
    }[s] ?? s;
  }

  formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }

  arrivedAgo(iso: string): string {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1)  return 'à l\'instant';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`;
  }

  isActioning(id: string): boolean {
    return this.actionId() === id;
  }
}
