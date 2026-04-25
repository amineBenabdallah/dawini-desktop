import 'temporal-polyfill/global';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { AppointmentsComponent } from './appointments.component';
import { ToastService } from '../../core/services/toast.service';

// ── helpers ───────────────────────────────────────────────────────────────────

const TODAY    = new Date().toISOString().split('T')[0];
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

const PATIENT = { id: 'p1', firstName: 'Ahmed',  lastName: 'Benali' };
const DOCTOR  = { id: 'd1', firstName: 'Karim',  lastName: 'Meziane', role: 'DOCTEUR' };

/** Flush the initial loadWeek GET call made in ngOnInit */
function flushInitialLoad(http: HttpTestingController): void {
  http.expectOne(r => r.url.includes('rendez-vous') && r.params.has('dateFrom')).flush({ data: [], total: 0 });
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AppointmentsComponent', () => {
  let fixture: ComponentFixture<AppointmentsComponent>;
  let component: AppointmentsComponent;
  let http: HttpTestingController;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [AppointmentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture   = TestBed.createComponent(AppointmentsComponent);
    component = fixture.componentInstance;
    http      = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    flushInitialLoad(http);
  });

  afterEach(() => http.verify());

  // ── openModal ───────────────────────────────────────────────────────────────

  describe('openModal()', () => {
    it('initialises formDate to today', fakeAsync(() => {
      component.openModal();
      flushModalRequests(http);
      tick();

      expect(component.formDate()).toBe(TODAY);
    }));

    it('resets formDate to today on every open', fakeAsync(() => {
      component.openModal();
      flushModalRequests(http);
      tick();

      component.formDate.set(TOMORROW);
      component.closeModal();

      component.openModal();
      flushModalRequests(http);
      tick();

      expect(component.formDate()).toBe(TODAY);
    }));
  });

  // ── canCreate ───────────────────────────────────────────────────────────────

  describe('canCreate', () => {
    it('is false when formDate is empty', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFieldsExcept(component, 'date');
      expect(component.canCreate()).toBeFalse();
    }));

    it('is false when selectedPatient is null', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFieldsExcept(component, 'patient');
      expect(component.canCreate()).toBeFalse();
    }));

    it('is false when formDocteurId is empty', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFieldsExcept(component, 'doctor');
      expect(component.canCreate()).toBeFalse();
    }));

    it('is false when formTime is empty', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFieldsExcept(component, 'time');
      expect(component.canCreate()).toBeFalse();
    }));

    it('is false when formMotif is blank', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFieldsExcept(component, 'motif');
      expect(component.canCreate()).toBeFalse();
    }));

    it('is true when all five required fields are set', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFields(component);
      expect(component.canCreate()).toBeTrue();
    }));
  });

  // ── onFormDateChange ────────────────────────────────────────────────────────

  describe('onFormDateChange()', () => {
    it('resets formTime', fakeAsync(() => {
      openAndFlush(component, http);
      component.formTime.set('09:00');
      component.formDocteurId.set('');
      component.onFormDateChange();
      http.match(r => r.url.includes('suggest'));
      expect(component.formTime()).toBe('');
    }));

    it('clears suggestedSlots', fakeAsync(() => {
      openAndFlush(component, http);
      component.suggestedSlots.set([{ start: 'x', end: 'y', score: 1 }]);
      component.formDocteurId.set('');
      component.onFormDateChange();
      http.match(r => r.url.includes('suggest'));
      expect(component.suggestedSlots()).toEqual([]);
    }));

    it('fetches new slot suggestions for the new date', fakeAsync(() => {
      openAndFlush(component, http);
      component.formDocteurId.set(DOCTOR.id);
      component.formDate.set(TOMORROW);
      component.onFormDateChange();
      tick();

      const req = http.expectOne(r =>
        r.url.includes('rendez-vous/suggest') && r.params.get('date') === TOMORROW,
      );
      expect(req.request.params.get('date')).toBe(TOMORROW);
      req.flush({ slots: [] });
    }));
  });

  // ── fetchSlotSuggestions ────────────────────────────────────────────────────

  describe('fetchSlotSuggestions()', () => {
    it('sends formDate() as the date param', fakeAsync(() => {
      openAndFlush(component, http);
      component.formDocteurId.set(DOCTOR.id);
      component.formDate.set(TOMORROW);
      component.fetchSlotSuggestions();
      tick();

      const req = http.expectOne(r => r.url.includes('rendez-vous/suggest'));
      expect(req.request.params.get('date')).toBe(TOMORROW);
      req.flush({ slots: [] });
    }));

    it('does nothing when formDocteurId is empty', fakeAsync(() => {
      openAndFlush(component, http);
      component.formDocteurId.set('');
      component.fetchSlotSuggestions();
      http.expectNone(r => r.url.includes('suggest'));
      expect(component.loadingSlots()).toBeFalse();
    }));
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('builds dateHeure from formDate + formTime', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFields(component);

      component.create();
      tick();

      const req = http.expectOne(r => r.method === 'POST' && r.url.includes('rendez-vous'));
      expect((req.request.body as { dateHeure: string }).dateHeure).toBe(`${TOMORROW}T09:00:00.000Z`);
      req.flush({ id: 'new-rdv' });
    }));

    it('shows success toast and closes modal on success', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFields(component);

      component.create();
      tick();

      http.expectOne(r => r.method === 'POST').flush({ id: 'new-rdv' });

      expect(toastSpy.success).toHaveBeenCalledWith('Rendez-vous créé');
      expect(component.showModal()).toBeFalse();
    }));

    it('adds the new appointment to local state without reloading', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFields(component);

      component.create();
      tick();

      http.expectOne(r => r.method === 'POST').flush({ id: 'new-rdv' });

      const appt = component.appointments().find(a => a.id === 'new-rdv');
      expect(appt).toBeTruthy();
      expect(appt!.statut).toBe('PLANNED');
      expect(appt!.patientFirstName).toBe(PATIENT.firstName);
    }));

    it('shows error toast and keeps modal open on failure', fakeAsync(() => {
      openAndFlush(component, http);
      setAllFields(component);

      component.create();
      tick();

      http.expectOne(r => r.method === 'POST').flush(
        { message: 'Cannot create an appointment in the past' },
        { status: 400, statusText: 'Bad Request' },
      );

      expect(toastSpy.error).toHaveBeenCalledWith('Cannot create an appointment in the past');
      expect(component.showModal()).toBeTrue();
      expect(component.saving()).toBeFalse();
    }));

    it('is a no-op when canCreate() is false', () => {
      component.create();
      http.expectNone(r => r.method === 'POST');
      expect(component.saving()).toBeFalse();
    });
  });

  // ── loadWeek ────────────────────────────────────────────────────────────────

  describe('loadWeek()', () => {
    it('calls API with dateFrom (Monday) and dateTo (Saturday)', fakeAsync(() => {
      const monday = new Date('2026-04-13T00:00:00');
      component.loadWeek(monday);
      tick();

      const req = http.expectOne(r =>
        r.url.includes('rendez-vous') && r.params.has('dateFrom') && r.params.has('dateTo'),
      );
      expect(req.request.params.get('dateFrom')).toBe('2026-04-13');
      expect(req.request.params.get('dateTo')).toBe('2026-04-18');
      expect(req.request.params.get('limit')).toBe('200');
      req.flush({ data: [], total: 0 });
    }));

    it('maps appointments to ScheduleX event format', fakeAsync(() => {
      const monday = new Date('2026-04-13T00:00:00');
      component.loadWeek(monday);
      tick();

      const appt = {
        id: 'rdv-1',
        dateHeure: '2026-04-14T09:00:00.000Z',
        dureeMinutes: 30,
        statut: 'PLANNED',
        motif: 'Consultation',
        patientId: 'p1', docteurId: 'd1',
        patientFirstName: 'Ahmed', patientLastName: 'Benali',
      };

      http.expectOne(r => r.url.includes('rendez-vous') && r.params.has('dateFrom'))
        .flush({ data: [appt], total: 1 });

      const events = component.calendarApp.events.getAll();
      expect(events.length).toBe(1);
      expect(events[0].id).toBe('rdv-1');
      expect(events[0].title).toBe('Ahmed Benali');
      const startZdt = events[0].start as Temporal.ZonedDateTime;
      const endZdt   = events[0].end   as Temporal.ZonedDateTime;
      expect(startZdt.year).toBe(2026);
      expect(startZdt.month).toBe(4);
      expect(startZdt.day).toBe(14);
      expect(startZdt.hour).toBe(9);
      expect(startZdt.minute).toBe(0);
      expect(endZdt.hour).toBe(9);
      expect(endZdt.minute).toBe(30);
      expect(events[0].calendarId).toBe('PLANNED');
      expect(events[0].description).toBe('Consultation');
    }));

    it('shows error toast when API call fails', fakeAsync(() => {
      const monday = new Date('2026-04-13T00:00:00');
      component.loadWeek(monday);
      tick();

      http.expectOne(r => r.url.includes('rendez-vous') && r.params.has('dateFrom')).flush(
        { message: 'Server error' },
        { status: 500, statusText: 'Internal Server Error' },
      );

      expect(toastSpy.error).toHaveBeenCalled();
      expect(component.loading()).toBeFalse();
    }));
  });

  // ── prevWeek / nextWeek / todayWeek ─────────────────────────────────────────

  describe('week navigation', () => {
    it('prevWeek() shifts weekStart back 7 days', fakeAsync(() => {
      component.weekStart.set('2026-04-13');
      component.prevWeek();
      tick();
      expect(component.weekStart()).toBe('2026-04-06');
      http.expectOne(r => r.params.has('dateFrom')).flush({ data: [], total: 0 });
    }));

    it('nextWeek() shifts weekStart forward 7 days', fakeAsync(() => {
      component.weekStart.set('2026-04-13');
      component.nextWeek();
      tick();
      expect(component.weekStart()).toBe('2026-04-20');
      http.expectOne(r => r.params.has('dateFrom')).flush({ data: [], total: 0 });
    }));

    it('todayWeek() resets weekStart to this week\'s Monday and reloads', fakeAsync(() => {
      component.weekStart.set('2025-12-29');
      component.todayWeek();
      tick();
      expect(component.weekStart()).not.toBe('2025-12-29');
      http.match(r => r.params.has('dateFrom')).forEach(r => r.flush({ data: [], total: 0 }));
    }));
  });

  // ── openModal pre-fills from calendar click ──────────────────────────────────

  describe('openModal pre-fill from calendar click', () => {
    it('pre-fills formDate and formTime when called via onClickDateTime callback', fakeAsync(() => {
      const dateTime = '2026-04-15 14:30';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callbacks = (component.calendarApp as any).$app?.config?.callbacks;
      if (!callbacks?.onClickDateTime) {
        pending('ScheduleX callbacks not accessible in this environment');
        return;
      }
      callbacks.onClickDateTime(dateTime);

      flushModalRequests(http);
      tick();

      expect(component.formDate()).toBe('2026-04-15');
      expect(component.formTime()).toBe('14:30');
      expect(component.showModal()).toBeTrue();
    }));
  });

  // ── edit panel ────────────────────────────────────────────────────────────────

  describe('edit panel', () => {

    const APPT: import('./appointments.component').Appointment = {
      id: 'rdv-42',
      dateHeure: '2026-04-14T09:00:00.000Z',
      dureeMinutes: 30,
      statut: 'PLANNED',
      motif: 'Consultation',
      patientId: 'p1', docteurId: 'd1',
      patientFirstName: 'Ahmed', patientLastName: 'Benali',
    };

    beforeEach(() => {
      component.appointments.set([APPT]);
    });

    describe('openEditPanel()', () => {
      it('populates editMotif from appt', () => {
        component.openEditPanel(APPT);
        expect(component.editMotif()).toBe('Consultation');
      });

      it('populates editDuree from appt', () => {
        component.openEditPanel(APPT);
        expect(component.editDuree()).toBe(30);
      });

      it('populates editStatut from appt', () => {
        component.openEditPanel(APPT);
        expect(component.editStatut()).toBe('PLANNED');
      });

      it('resets editNotes to empty string', () => {
        component.editNotes.set('previous notes');
        component.openEditPanel(APPT);
        expect(component.editNotes()).toBe('');
      });

      it('sets editAppt to the given appointment', () => {
        component.openEditPanel(APPT);
        expect(component.editAppt()).toEqual(APPT);
      });

      it('resets showDeleteConfirm to false', () => {
        component.showDeleteConfirm.set(true);
        component.openEditPanel(APPT);
        expect(component.showDeleteConfirm()).toBeFalse();
      });
    });

    describe('saveEdit()', () => {
      beforeEach(() => {
        component.openEditPanel(APPT);
        component.editMotif.set('Suivi');
        component.editNotes.set('note text');
        component.editDuree.set(45);
      });

      it('calls PATCH with motif, notes and dureeMinutes', fakeAsync(() => {
        component.saveEdit();
        tick();

        const req = http.expectOne(r => r.method === 'PATCH' && r.url.includes('rendez-vous/rdv-42'));
        expect(req.request.body).toEqual(jasmine.objectContaining({ motif: 'Suivi', notes: 'note text', dureeMinutes: 45 }));
        req.flush({ id: 'rdv-42' });
      }));

      it('sends notes as undefined when empty', fakeAsync(() => {
        component.editNotes.set('');
        component.saveEdit();
        tick();

        const req = http.expectOne(r => r.method === 'PATCH' && r.url.includes('rendez-vous/rdv-42'));
        expect(req.request.body['notes']).toBeUndefined();
        req.flush({ id: 'rdv-42' });
      }));

      it('updates local appointment state without reloading', fakeAsync(() => {
        component.saveEdit();
        tick();

        http.expectOne(r => r.method === 'PATCH').flush({ id: 'rdv-42' });

        const appt = component.appointments().find(a => a.id === 'rdv-42');
        expect(appt?.motif).toBe('Suivi');
        expect(appt?.dureeMinutes).toBe(45);
        expect(component.editAppt()).toBeNull();
      }));

      it('closes panel and shows success toast on success', fakeAsync(() => {
        component.saveEdit();
        tick();

        http.expectOne(r => r.method === 'PATCH').flush({ id: 'rdv-42' });

        expect(component.editAppt()).toBeNull();
        expect(component.editSaving()).toBeFalse();
        expect(toastSpy.success).toHaveBeenCalledWith('Rendez-vous mis à jour');
      }));

      it('shows error toast and resets editSaving on failure', fakeAsync(() => {
        component.saveEdit();
        tick();

        http.expectOne(r => r.method === 'PATCH').flush(
          { message: 'Appointment not found' }, { status: 404, statusText: 'Not Found' },
        );

        expect(component.editSaving()).toBeFalse();
        expect(toastSpy.error).toHaveBeenCalledWith('Appointment not found');
        expect(component.editAppt()).not.toBeNull();
      }));

      it('is a no-op when editSaving is already true', fakeAsync(() => {
        component.editSaving.set(true);
        component.saveEdit();
        http.expectNone(r => r.method === 'PATCH');
        expect(component.editSaving()).toBeTrue();
      }));
    });

    describe('changeStatut()', () => {
      beforeEach(() => { component.openEditPanel(APPT); });

      it('calls PATCH with { statut } only', fakeAsync(() => {
        component.changeStatut('CONFIRMED');
        tick();

        const req = http.expectOne(r => r.method === 'PATCH' && r.url.includes('rendez-vous/rdv-42'));
        expect(req.request.body).toEqual({ statut: 'CONFIRMED' });
        req.flush({ id: 'rdv-42', statut: 'CONFIRMED' });
      }));

      it('updates editStatut signal on success', fakeAsync(() => {
        component.changeStatut('CONFIRMED');
        tick();

        http.expectOne(r => r.method === 'PATCH').flush({ id: 'rdv-42', statut: 'CONFIRMED' });

        expect(component.editStatut()).toBe('CONFIRMED');
      }));

      it('updates the appointments signal on success', fakeAsync(() => {
        component.changeStatut('WAITING');
        tick();

        http.expectOne(r => r.method === 'PATCH').flush({ id: 'rdv-42', statut: 'WAITING' });
        expect(component.appointments().find(a => a.id === 'rdv-42')?.statut).toBe('WAITING');
      }));

      it('shows success toast on success', fakeAsync(() => {
        component.changeStatut('DONE');
        tick();

        http.expectOne(r => r.method === 'PATCH').flush({ id: 'rdv-42', statut: 'DONE' });

        expect(toastSpy.success).toHaveBeenCalledWith('Statut mis à jour');
      }));

      it('shows error toast and resets editSaving on failure', fakeAsync(() => {
        component.changeStatut('DONE');
        tick();

        http.expectOne(r => r.method === 'PATCH').flush(
          { message: 'Invalid transition' }, { status: 400, statusText: 'Bad Request' },
        );

        expect(component.editSaving()).toBeFalse();
        expect(toastSpy.error).toHaveBeenCalledWith('Invalid transition');
      }));

      it('is a no-op when editSaving is already true', fakeAsync(() => {
        component.editSaving.set(true);
        component.changeStatut('DONE');
        http.expectNone(r => r.method === 'PATCH');
        expect(component.editStatut()).toBe('PLANNED');
      }));
    });

    describe('deleteAppt()', () => {
      beforeEach(() => { component.openEditPanel(APPT); });

      it('calls DELETE rendez-vous/:id', fakeAsync(() => {
        component.deleteAppt();
        tick();

        const req = http.expectOne(r => r.method === 'DELETE' && r.url.includes('rendez-vous/rdv-42'));
        expect(req.request.method).toBe('DELETE');
        req.flush({});
      }));

      it('closes panel, removes from local state and shows success toast', fakeAsync(() => {
        component.deleteAppt();
        tick();

        http.expectOne(r => r.method === 'DELETE').flush({});

        expect(component.editAppt()).toBeNull();
        expect(component.editDeleting()).toBeFalse();
        expect(component.appointments().find(a => a.id === 'rdv-42')).toBeUndefined();
        expect(toastSpy.success).toHaveBeenCalledWith('Rendez-vous annulé');
      }));

      it('shows error toast and resets editDeleting on failure', fakeAsync(() => {
        component.deleteAppt();
        tick();

        http.expectOne(r => r.method === 'DELETE').flush(
          { message: 'Cannot cancel a completed appointment' },
          { status: 400, statusText: 'Bad Request' },
        );

        expect(component.editDeleting()).toBeFalse();
        expect(toastSpy.error).toHaveBeenCalledWith('Cannot cancel a completed appointment');
        expect(component.editAppt()).not.toBeNull();
      }));

      it('is a no-op when editDeleting is already true', fakeAsync(() => {
        component.editDeleting.set(true);
        component.deleteAppt();
        http.expectNone(r => r.method === 'DELETE');
        expect(component.editDeleting()).toBeTrue();
      }));
    });

    describe('showDeleteConfirm toggling', () => {
      it('starts as false', () => {
        component.openEditPanel(APPT);
        expect(component.showDeleteConfirm()).toBeFalse();
      });

      it('can be set to true', () => {
        component.openEditPanel(APPT);
        component.showDeleteConfirm.set(true);
        expect(component.showDeleteConfirm()).toBeTrue();
      });

      it('resets to false when openEditPanel is called again', () => {
        component.showDeleteConfirm.set(true);
        component.openEditPanel(APPT);
        expect(component.showDeleteConfirm()).toBeFalse();
      });
    });

  });

});

// ── test helpers ──────────────────────────────────────────────────────────────

function flushModalRequests(http: HttpTestingController): void {
  http.match(r => r.url.includes('patients')).forEach(r => r.flush({ data: [] }));
  http.match(r => r.url.includes('employees')).forEach(r => r.flush([]));
  http.match(r => r.url.includes('suggest')).forEach(r => r.flush({ slots: [] }));
}

function openAndFlush(component: AppointmentsComponent, http: HttpTestingController): void {
  component.openModal();
  flushModalRequests(http);
}

function setAllFields(component: AppointmentsComponent): void {
  component.formDate.set(TOMORROW);
  component.selectedPatient.set(PATIENT);
  component.formDocteurId.set(DOCTOR.id);
  component.formTime.set('09:00');
  component.formMotif.set('Consultation');
}

function setAllFieldsExcept(
  component: AppointmentsComponent,
  skip: 'date' | 'patient' | 'doctor' | 'time' | 'motif',
): void {
  if (skip !== 'date')    component.formDate.set(TOMORROW); else component.formDate.set('');
  if (skip !== 'patient') component.selectedPatient.set(PATIENT);
  if (skip !== 'doctor')  component.formDocteurId.set(DOCTOR.id);
  if (skip !== 'time')    component.formTime.set('09:00');
  if (skip !== 'motif')   component.formMotif.set('Consultation');
}
