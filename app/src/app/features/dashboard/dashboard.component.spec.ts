import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { DashboardComponent } from './dashboard.component';

// ── mock data ─────────────────────────────────────────────────────────────────

const mockAgenda = {
  data: [
    { id: 'a1', dateHeure: '2026-04-03T09:00:00Z', patientFirstName: 'Amina', patientLastName: 'Khalil', statut: 'WAITING',    motif: 'Consultation' },
    { id: 'a2', dateHeure: '2026-04-03T10:30:00Z', patientFirstName: 'Omar',  patientLastName: 'Bensalem', statut: 'CONFIRMED', motif: '' },
  ],
  total: 2,
};

// ── helpers ───────────────────────────────────────────────────────────────────

function flushInit(http: HttpTestingController, agendaOverride = mockAgenda) {
  http.expectOne(r => r.url.includes('rendez-vous')).flush(agendaOverride);
  http.expectOne(r => r.url.includes('patients')).flush({ total: 42 });
  http.expectOne(r => r.url.includes('factures')).flush({ total: 3 });
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    http      = TestBed.inject(HttpTestingController);

    fixture.detectChanges(); // triggers ngOnInit
  });

  afterEach(() => {
    // Drain any leftover init requests (rendez-vous / patients / factures)
    // so helper-only tests don't need to flush them manually.
    http.match(r => r.url.includes('rendez-vous') || r.url.includes('patients') || r.url.includes('factures'))
        .forEach(r => r.flush({ data: [], total: 0 }));
    http.verify();
  });

  // ── initial state ──────────────────────────────────────────────────────────

  it('should create', () => {
    flushInit(http);
    expect(component).toBeTruthy();
  });

  it('loading starts true', () => {
    expect(component.loading()).toBeTrue();
    flushInit(http);
  });

  it('shows skeleton while loading', () => {
    const skeleton = fixture.nativeElement.querySelector('.skeleton');
    expect(skeleton).toBeTruthy();
    flushInit(http);
  });

  // ── stat cards ─────────────────────────────────────────────────────────────

  it('renders 4 stat cards', () => {
    flushInit(http);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.cm-stat-card');
    expect(cards.length).toBe(4);
  });

  it('stat cards use col-6 (2-per-row on mobile)', () => {
    flushInit(http);
    fixture.detectChanges();
    const cols = fixture.nativeElement.querySelectorAll('.col-6');
    expect(cols.length).toBeGreaterThanOrEqual(4);
  });

  it('updates totalPatients stat after patients API resolves', fakeAsync(() => {
    http.expectOne(r => r.url.includes('rendez-vous')).flush(mockAgenda);
    http.expectOne(r => r.url.includes('patients')).flush({ total: 99 });
    http.expectOne(r => r.url.includes('factures')).flush({ total: 0 });
    tick();
    expect(component.stats().totalPatients).toBe(99);
  }));

  it('updates unpaidInvoices stat after factures API resolves', fakeAsync(() => {
    http.expectOne(r => r.url.includes('rendez-vous')).flush(mockAgenda);
    http.expectOne(r => r.url.includes('patients')).flush({ total: 0 });
    http.expectOne(r => r.url.includes('factures')).flush({ total: 7 });
    tick();
    expect(component.stats().unpaidInvoices).toBe(7);
  }));

  // ── error handling ─────────────────────────────────────────────────────────

  it('agenda error: loading set to false, no crash', fakeAsync(() => {
    http.expectOne(r => r.url.includes('rendez-vous'))
        .flush({ message: 'Error' }, { status: 500, statusText: 'Server Error' });
    http.expectOne(r => r.url.includes('patients')).flush({ total: 0 });
    http.expectOne(r => r.url.includes('factures')).flush({ total: 0 });
    tick();
    expect(component.loading()).toBeFalse();
  }));

  it('patients error: stat stays 0, no crash', fakeAsync(() => {
    http.expectOne(r => r.url.includes('rendez-vous')).flush(mockAgenda);
    http.expectOne(r => r.url.includes('patients'))
        .flush({ message: 'Error' }, { status: 500, statusText: 'Server Error' });
    http.expectOne(r => r.url.includes('factures')).flush({ total: 0 });
    tick();
    expect(component.stats().totalPatients).toBe(0);
  }));

  it('factures error: stat stays 0, no crash', fakeAsync(() => {
    http.expectOne(r => r.url.includes('rendez-vous')).flush(mockAgenda);
    http.expectOne(r => r.url.includes('patients')).flush({ total: 0 });
    http.expectOne(r => r.url.includes('factures'))
        .flush({ message: 'Error' }, { status: 500, statusText: 'Server Error' });
    tick();
    expect(component.stats().unpaidInvoices).toBe(0);
  }));

  // ── agenda loaded ──────────────────────────────────────────────────────────

  it('loads agenda appointments and sets loading false', fakeAsync(() => {
    flushInit(http);
    tick();
    fixture.detectChanges();
    expect(component.loading()).toBeFalse();
    expect(component.todayAppointments().length).toBe(2);
  }));

  it('shows empty state when no appointments', fakeAsync(() => {
    http.expectOne(r => r.url.includes('rendez-vous')).flush({ data: [], total: 0 });
    http.expectOne(r => r.url.includes('patients')).flush({ total: 0 });
    http.expectOne(r => r.url.includes('factures')).flush({ total: 0 });
    tick();
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('.bi-calendar-x');
    expect(empty).toBeTruthy();
  }));

  it('sets waitingPatients count from WAITING status', fakeAsync(() => {
    flushInit(http); // mockAgenda has 1 WAITING
    tick();
    expect(component.stats().waitingPatients).toBe(1);
  }));

  it('sets lastRefreshed after successful load', fakeAsync(() => {
    flushInit(http);
    tick();
    expect(component.lastRefreshed()).not.toBeNull();
  }));

  // ── refresh ────────────────────────────────────────────────────────────────

  it('loadAgenda(true) sets refreshing, not loading', fakeAsync(() => {
    flushInit(http); tick(); // initial load

    component.loadAgenda(true);
    expect(component.refreshing()).toBeTrue();
    expect(component.loading()).toBeFalse();

    http.expectOne(r => r.url.includes('rendez-vous')).flush(mockAgenda);
    tick();
    expect(component.refreshing()).toBeFalse();
  }));

  // ── helpers ────────────────────────────────────────────────────────────────

  it('initials returns first letters uppercase', () => {
    const result = component.initials({ id: '1', dateHeure: '', patientFirstName: 'amina', patientLastName: 'khalil', statut: 'DONE' });
    expect(result).toBe('AK');
  });

  it('initials returns ? when names are null', () => {
    const result = component.initials({ id: '1', dateHeure: '', patientFirstName: null, patientLastName: null, statut: 'DONE' });
    expect(result).toBe('?');
  });

  it('statusLabel maps known statuses', () => {
    expect(component.statusLabel('PLANNED')).toBe('Planifié');
    expect(component.statusLabel('WAITING')).toBe('En salle');
    expect(component.statusLabel('DONE')).toBe('Terminé');
  });

  it('formatTime returns — for empty string', () => {
    expect(component.formatTime('')).toBe('—');
  });
});
