import 'temporal-polyfill/global';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { CalendarComponent } from '@schedule-x/angular';
import { createCalendar, viewWeek } from '@schedule-x/calendar';

export interface Appointment {
  id: string;
  dateHeure: string;
  dureeMinutes: number;
  statut: string;
  motif?: string;
  patientId: string;
  docteurId: string;
  patientFirstName: string | null;
  patientLastName: string | null;
}

interface Patient  { id: string; firstName: string; lastName: string; }
interface Employee { id: string; firstName: string; lastName: string; role: string; }

const MOTIF_CHIPS = ['Consultation', 'Suivi', 'Urgence', 'Renouvellement', 'Résultats'];

const TIME_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30',
];

/** Format a Date to a Temporal.ZonedDateTime in UTC as required by ScheduleX v4 */
function formatToScheduleX(d: Date): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(d.getTime())
    .toZonedDateTimeISO('UTC');
}

/** Extract 'YYYY-MM-DD HH:mm' string from a Temporal.ZonedDateTime (UTC) */
function zonedToString(zdt: Temporal.ZonedDateTime): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)} ${pad(zdt.hour)}:${pad(zdt.minute)}`;
}

/** Get Monday (ISO week start) for a given date */
function getMondayOf(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

/** Format date to YYYY-MM-DD using local calendar */
function toLocalDateStr(d: Date): string {
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [FormsModule, LoadingSpinnerComponent, CalendarComponent],
  templateUrl: './appointments.component.html',
})
export class AppointmentsComponent implements OnInit {
  private readonly api   = inject(ApiService);
  private readonly auth  = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly appointments  = signal<Appointment[]>([]);
  readonly total         = signal(0);
  readonly loading       = signal(true);
  readonly showModal     = signal(false);
  readonly saving        = signal(false);
  readonly savingPatient = signal(false);
  readonly patients      = signal<Patient[]>([]);
  readonly doctors       = signal<Employee[]>([]);

  /** Signal for the appointment being edited */
  readonly editAppt = signal<Appointment | null>(null);

  // ── Edit panel state ──────────────────────────────────────────────────────
  readonly editSaving        = signal(false);
  readonly editDeleting      = signal(false);
  readonly showDeleteConfirm = signal(false);

  readonly editMotif  = signal('');
  readonly editNotes  = signal('');
  readonly editDuree  = signal(30);
  readonly editStatut = signal('');

  readonly STATUT_OPTIONS = [
    { value: 'PLANNED',   label: 'Planifié',  icon: 'bi-calendar' },
    { value: 'CONFIRMED', label: 'Confirmé',  icon: 'bi-check-circle' },
    { value: 'WAITING',   label: 'En salle',  icon: 'bi-person-clock' },
    { value: 'DONE',      label: 'Terminé',   icon: 'bi-check2-all' },
    { value: 'ABSENT',    label: 'Absent',    icon: 'bi-person-x' },
    { value: 'CANCELLED', label: 'Annulé',    icon: 'bi-x-circle' },
  ];

  readonly activeStatuses = signal<Set<string>>(
    new Set(['PLANNED','CONFIRMED','WAITING','DONE','ABSENT','CANCELLED'])
  );

  readonly statusCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const a of this.appointments()) {
      counts[a.statut] = (counts[a.statut] ?? 0) + 1;
    }
    return counts;
  });

  isStatusActive(status: string): boolean { return this.activeStatuses().has(status); }

  toggleStatus(status: string): void {
    const next = new Set(this.activeStatuses());
    if (next.has(status)) { next.delete(status); } else { next.add(status); }
    this.activeStatuses.set(next);
    this.applyFilters();
  }

  // ── Week navigation ───────────────────────────────────────────────────────
  /** YYYY-MM-DD of the Monday of the currently displayed week */
  readonly weekStart = signal(toLocalDateStr(getMondayOf(new Date())));

  readonly isCurrentWeek = computed(() =>
    this.weekStart() === toLocalDateStr(getMondayOf(new Date())),
  );

  /** Week range label shown in the toolbar (e.g. "13 – 18 avr. 2026") */
  readonly monthLabel = computed(() => {
    const monday   = new Date(this.weekStart() + 'T00:00:00');
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const d1 = monday.getDate();
    const d2 = saturday.getDate();

    if (monday.getMonth() === saturday.getMonth()) {
      // Same month: "13 – 18 avr. 2026"
      const mv = saturday.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
      return `${d1} – ${d2} ${mv}`;
    }
    // Spans two months: "28 mars – 2 avr. 2026"
    const m1 = monday.toLocaleDateString('fr-FR', { month: 'short' });
    const m2 = saturday.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return `${d1} ${m1} – ${d2} ${m2}`;
  });

  // ── Signal-based form fields ──────────────────────────────────────────────
  readonly selectedPatient  = signal<Patient | null>(null);
  readonly patientSearch    = signal('');
  readonly showPatientList  = signal(false);

  readonly formDate         = signal('');
  readonly formDocteurId    = signal('');
  readonly formTime         = signal('');
  readonly formDuree        = signal(30);
  readonly formMotif        = signal('');
  readonly formNotes        = signal('');

  readonly minDate = toLocalDateStr(new Date());

  readonly filteredPatients = computed(() => {
    const q = this.patientSearch().toLowerCase().trim();
    if (!q) return [];
    return this.patients()
      .filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      .slice(0, 6);
  });

  readonly canCreate = computed(() =>
    !!this.formDate() &&
    !!this.selectedPatient() &&
    !!this.formDocteurId() &&
    !!this.formTime() &&
    !!this.formMotif().trim(),
  );

  readonly totalLabel = computed(() => `${this.total()} rendez-vous`);

  // ── New patient inline form ───────────────────────────────────────────────
  showNewPatient      = false;
  showOptionalPatient = false;
  showNotesField      = false;
  newPatient = {
    firstName: '', lastName: '', phone: '',
    dateOfBirth: '', gender: '' as 'M' | 'F' | '',
    email: '', wilaya: '', commune: '', nss: '',
  };

  get canSavePatient(): boolean {
    return !!this.newPatient.firstName.trim() &&
           !!this.newPatient.lastName.trim() &&
           !!this.newPatient.phone.trim() &&
           !!this.newPatient.dateOfBirth &&
           !!this.newPatient.gender;
  }

  motifChips = MOTIF_CHIPS;
  timeSlots  = TIME_SLOTS;

  readonly suggestedSlots = signal<{ start: string; end: string; score: number }[]>([]);
  readonly loadingSlots   = signal(false);

  // ── ScheduleX calendar (week view, Mon–Sat) ──────────────────────────────
  readonly calendarApp = createCalendar({
    locale: 'fr-FR',
    views: [viewWeek],
    defaultView: viewWeek.name,
    dayBoundaries: { start: '08:00', end: '18:00' },
    weekOptions: { nDays: 6, gridHeight: 420 },  // 420px / 10 h = 42px/h → ~21px per 30-min slot
    calendars: {
      PLANNED:   { colorName: 'PLANNED',   lightColors: { main: '#1d4ed8', container: '#3b82f6', onContainer: '#ffffff' } },
      CONFIRMED: { colorName: 'CONFIRMED', lightColors: { main: '#15803d', container: '#22c55e', onContainer: '#ffffff' } },
      WAITING:   { colorName: 'WAITING',   lightColors: { main: '#b45309', container: '#f59e0b', onContainer: '#ffffff' } },
      DONE:      { colorName: 'DONE',      lightColors: { main: '#475569', container: '#94a3b8', onContainer: '#ffffff' } },
      ABSENT:    { colorName: 'ABSENT',    lightColors: { main: '#991b1b', container: '#ef4444', onContainer: '#ffffff' } },
      CANCELLED: { colorName: 'CANCELLED', lightColors: { main: '#94a3b8', container: '#e2e8f0', onContainer: '#475569' } },
    },
    callbacks: {
      onEventClick: (event) => {
        const appt = this.appointments().find(a => a.id === event.id);
        if (appt) this.openEditPanel(appt);
      },
      onClickDateTime: (dateTime: unknown) => {
        let dtStr: string;
        if (dateTime instanceof Temporal.ZonedDateTime) {
          dtStr = zonedToString(dateTime);
        } else if (dateTime instanceof Date) {
          dtStr = zonedToString(formatToScheduleX(dateTime));
        } else {
          dtStr = String(dateTime);
        }
        const [datePart, timePart] = dtStr.split(' ');
        this.openModal();
        if (datePart) this.formDate.set(datePart);
        if (timePart) this.formTime.set(timePart);
      },
    },
    plugins: [],
  });

  ngOnInit() {
    this.loadWeek(new Date());
  }

  // ── Week navigation ───────────────────────────────────────────────────────

  private navigateSx(monday: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $app = (this.calendarApp as any).$app;
    if ($app?.datePickerState?.selectedDate) {
      $app.datePickerState.selectedDate.value = Temporal.PlainDate.from(monday);
    }
  }

  prevWeek(): void {
    const d = new Date(this.weekStart() + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    const monday = toLocalDateStr(getMondayOf(d));
    this.weekStart.set(monday);
    this.loadWeek(d);
    this.navigateSx(monday);
  }

  nextWeek(): void {
    const d = new Date(this.weekStart() + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const monday = toLocalDateStr(getMondayOf(d));
    this.weekStart.set(monday);
    this.loadWeek(d);
    this.navigateSx(monday);
  }

  todayWeek(): void {
    const monday = toLocalDateStr(getMondayOf(new Date()));
    this.weekStart.set(monday);
    this.loadWeek(new Date());
    this.navigateSx(monday);
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  /** Load Mon–Sat appointments for the week containing `weekStart` */
  loadWeek(weekStart: Date): void {
    const monday   = getMondayOf(weekStart);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const dateFrom = toLocalDateStr(monday);
    const dateTo   = toLocalDateStr(saturday);

    this.loading.set(true);
    this.api.get<{ data: Appointment[]; total: number }>('rendez-vous', {
      dateFrom,
      dateTo,
      limit: 200,
    }).subscribe({
      next: (res) => {
        const appts = res.data ?? [];
        this.appointments.set(appts);
        this.total.set(res.total ?? appts.length);
        this.loading.set(false);

        this.applyFilters();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? 'Erreur de chargement des rendez-vous';
        this.toast.error(msg);
      },
    });
  }

  // ── Keep backward-compat load() for tests ────────────────────────────────
  load() { this.loadWeek(new Date(this.weekStart() + 'T00:00:00')); }

  // ── Modal ─────────────────────────────────────────────────────────────────

  openModal() {
    this.selectedPatient.set(null);
    this.patientSearch.set('');
    this.showPatientList.set(false);
    this.formDate.set(toLocalDateStr(new Date()));
    this.formDocteurId.set('');
    this.formTime.set('');
    this.formDuree.set(30);
    this.formMotif.set('');
    this.formNotes.set('');
    this.suggestedSlots.set([]);

    this.showNewPatient      = false;
    this.showOptionalPatient = false;
    this.showNotesField      = false;
    this.newPatient = { firstName: '', lastName: '', phone: '', dateOfBirth: '', gender: '', email: '', wilaya: '', commune: '', nss: '' };

    this.showModal.set(true);

    this.api.get<{ data: Patient[] }>('patients', { limit: 100 }).subscribe({
      next: (res) => this.patients.set(res.data ?? []),
      error: () => {},
    });
    this.api.get<Employee[]>('employees').subscribe({
      next: (res) => {
        const docs = (res ?? []).filter(e => e.role === 'DOCTEUR');
        this.doctors.set(docs);
        if (docs.length === 1) {
          this.formDocteurId.set(docs[0].id);
          this.fetchSlotSuggestions();
        } else if (docs.length === 0) {
          // No DOCTEUR employee found — the logged-in user (ADMIN) is the doctor
          const me = this.auth.user();
          if (me) this.formDocteurId.set(me.id);
        }
      },
      error: () => {},
    });
  }

  closeModal() { this.showModal.set(false); }

  onPatientSearchChange(val: string) {
    this.patientSearch.set(val);
    this.selectedPatient.set(null);
    this.showPatientList.set(val.trim().length >= 1);
  }

  selectPatient(p: Patient) {
    this.selectedPatient.set(p);
    this.patientSearch.set(`${p.firstName} ${p.lastName}`);
    this.showPatientList.set(false);
    this.showNewPatient = false;
  }

  toggleNewPatient() {
    this.showNewPatient = !this.showNewPatient;
    if (this.showNewPatient) {
      const parts = this.patientSearch().trim().split(' ');
      this.newPatient.firstName = parts[0] ?? '';
      this.newPatient.lastName  = parts.slice(1).join(' ');
      this.selectedPatient.set(null);
      this.showPatientList.set(false);
    }
  }

  saveNewPatient() {
    if (!this.canSavePatient || this.savingPatient()) return;
    this.savingPatient.set(true);

    this.api.post<Patient>('patients', {
      firstName:   this.newPatient.firstName.trim(),
      lastName:    this.newPatient.lastName.trim(),
      phone:       this.newPatient.phone.trim(),
      dateOfBirth: this.newPatient.dateOfBirth,
      gender:      this.newPatient.gender,
      email:       this.newPatient.email.trim()   || undefined,
      wilaya:      this.newPatient.wilaya.trim()   || undefined,
      commune:     this.newPatient.commune.trim()  || undefined,
      nss:         this.newPatient.nss.trim()      || undefined,
    }).subscribe({
      next: (patient) => {
        this.savingPatient.set(false);
        this.selectedPatient.set(patient);
        this.patientSearch.set(`${patient.firstName} ${patient.lastName}`);
        this.showNewPatient      = false;
        this.showOptionalPatient = false;
        this.toast.success(`Patient ${patient.firstName} ${patient.lastName} enregistré`);
      },
      error: (err) => {
        this.savingPatient.set(false);
        const msg = err?.error?.message ?? 'Erreur lors de la création du patient';
        this.toast.error(msg);
      },
    });
  }

  selectMotif(chip: string) { this.formMotif.set(chip); }

  onDoctorChange() {
    this.formTime.set('');
    this.fetchSlotSuggestions();
  }

  onFormDateChange() {
    this.formTime.set('');
    this.suggestedSlots.set([]);
    this.fetchSlotSuggestions();
  }

  fetchSlotSuggestions() {
    const docteurId = this.formDocteurId();
    if (!docteurId) { this.suggestedSlots.set([]); return; }
    this.loadingSlots.set(true);
    this.suggestedSlots.set([]);
    this.api.get<{ slots: { start: string; end: string; score: number }[] }>(
      'rendez-vous/suggest',
      { docteurId, date: this.formDate(), dureeMinutes: this.formDuree() },
    ).subscribe({
      next: (res) => { this.suggestedSlots.set(res.slots ?? []); this.loadingSlots.set(false); },
      error: ()    => { this.loadingSlots.set(false); },
    });
  }

  selectSlot(startIso: string) {
    const d  = new Date(startIso);
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    this.formTime.set(`${hh}:${mm}`);
    this.suggestedSlots.set([]);
  }

  slotLabel(startIso: string): string {
    return new Date(startIso).toLocaleTimeString('fr-DZ', {
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    });
  }

  // ── Local state helpers (no API reload) ──────────────────────────────────

  private toSxEvent(appt: Appointment) {
    const start = new Date(appt.dateHeure);
    const end   = new Date(start.getTime() + appt.dureeMinutes * 60_000);
    return {
      id:          appt.id,
      title:       `${appt.patientFirstName ?? ''} ${appt.patientLastName ?? ''}`.trim(),
      start:       formatToScheduleX(start),
      end:         formatToScheduleX(end),
      calendarId:  appt.statut,
      description: appt.motif ?? '',
    };
  }

  create() {
    if (!this.canCreate() || this.saving()) return;
    this.saving.set(true);

    const dateHeure = `${this.formDate()}T${this.formTime()}:00.000Z`;
    const patient   = this.selectedPatient()!;

    this.api.post<{ id: string }>('rendez-vous', {
      patientId:    patient.id,
      docteurId:    this.formDocteurId(),
      dateHeure,
      dureeMinutes: this.formDuree(),
      motif:        this.formMotif().trim(),
      notes:        this.formNotes().trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.closeModal();
        const newAppt: Appointment = {
          id:               res.id,
          dateHeure,
          dureeMinutes:     this.formDuree(),
          statut:           'PLANNED',
          motif:            this.formMotif().trim(),
          patientId:        patient.id,
          docteurId:        this.formDocteurId(),
          patientFirstName: patient.firstName,
          patientLastName:  patient.lastName,
        };
        this.appointments.update(list => [...list, newAppt]);
        this.applyFilters();
        this.toast.success('Rendez-vous créé');
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? 'Erreur lors de la création';
        this.toast.error(msg);
      },
    });
  }

  // ── Edit panel ────────────────────────────────────────────────────────────

  openEditPanel(appt: Appointment): void {
    this.editMotif.set(appt.motif ?? '');
    this.editNotes.set('');
    this.editDuree.set(appt.dureeMinutes);
    this.editStatut.set(appt.statut);
    this.editAppt.set(appt);
    this.showDeleteConfirm.set(false);
  }

  saveEdit(): void {
    const appt = this.editAppt();
    if (!appt || this.editSaving()) return;
    this.editSaving.set(true);

    const notes = this.editNotes();
    this.api.patch<{ id: string }>(`rendez-vous/${appt.id}`, {
      motif: this.editMotif(),
      notes: notes || undefined,
      dureeMinutes: this.editDuree(),
    }).subscribe({
      next: () => {
        const updatedAppt: Appointment = {
          ...appt,
          motif:        this.editMotif().trim(),
          dureeMinutes: this.editDuree(),
        };
        this.appointments.update(list => list.map(a => a.id === appt.id ? updatedAppt : a));
        this.applyFilters();
        this.editSaving.set(false);
        this.editAppt.set(null);
        this.toast.success('Rendez-vous mis à jour');
      },
      error: (err) => {
        this.editSaving.set(false);
        const msg = err?.error?.message ?? 'Erreur lors de la mise à jour';
        this.toast.error(msg);
      },
    });
  }

  changeStatut(newStatut: string): void {
    const appt = this.editAppt();
    if (!appt || this.editSaving()) return;
    this.editSaving.set(true);

    this.api.patch<{ id: string }>(`rendez-vous/${appt.id}`, { statut: newStatut }).subscribe({
      next: () => {
        const updatedAppt: Appointment = { ...appt, statut: newStatut };
        this.editStatut.set(newStatut);
        this.appointments.update(list => list.map(a => a.id === appt.id ? updatedAppt : a));
        this.applyFilters();
        this.editSaving.set(false);
        this.toast.success('Statut mis à jour');
      },
      error: (err) => {
        this.editSaving.set(false);
        const msg = err?.error?.message ?? 'Erreur lors du changement de statut';
        this.toast.error(msg);
      },
    });
  }

  deleteAppt(): void {
    const appt = this.editAppt();
    if (!appt || this.editDeleting()) return;
    this.editDeleting.set(true);

    this.api.delete<unknown>(`rendez-vous/${appt.id}`).subscribe({
      next: () => {
        this.appointments.update(list => list.filter(a => a.id !== appt.id));
        this.applyFilters();
        this.editDeleting.set(false);
        this.editAppt.set(null);
        this.toast.success('Rendez-vous annulé');
      },
      error: (err) => {
        this.editDeleting.set(false);
        const msg = err?.error?.message ?? 'Erreur lors de l\'annulation';
        this.toast.error(msg);
      },
    });
  }

  private applyFilters(): void {
    const active = this.activeStatuses();
    this.calendarApp.events.set(
      this.appointments().filter(a => active.has(a.statut)).map(a => this.toSxEvent(a))
    );
  }

  formatTime(iso: string) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-DZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
}
