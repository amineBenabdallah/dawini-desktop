import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { QueueComponent } from './queue.component';
import { ApiService }    from '../../core/services/api.service';
import { ToastService }  from '../../core/services/toast.service';
import { AuthService }   from '../../core/services/auth.service';

// ── helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID  = '11111111-1111-1111-1111-111111111111';
const RDV_ID_1   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const RDV_ID_2   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const mockPendingCheckins = [
  { rdvId: RDV_ID_1, patientName: 'Amina Khalil',  patientNumber: 'PAT-2026-0001', appointmentTime: new Date().toISOString(), motif: 'Consultation' },
  { rdvId: RDV_ID_2, patientName: 'Omar Bensalem', patientNumber: 'PAT-2026-0002', appointmentTime: new Date().toISOString(), motif: 'Suivi' },
];

const mockSecretaryView = {
  appointmentLane: [],
  walkInLane: [
    {
      id: 'token-1',
      patientName: 'Ahmed Benali',
      type: 'WALK_IN',
      status: 'WAITING',
      appointmentTime: null,
      arrivedAt: new Date().toISOString(),
      isManual: false,
    },
  ],
};

// ── suite ─────────────────────────────────────────────────────────────────────

describe('QueueComponent — walk-in add form', () => {
  let fixture: ComponentFixture<QueueComponent>;
  let component: QueueComponent;
  let http: HttpTestingController;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    const authStub = {
      user: signal({ tenantId: TENANT_ID, id: 'u1', email: 'sec@test.com', role: 'SECRETAIRE' }),
    };

    await TestBed.configureTestingModule({
      imports: [QueueComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    fixture  = TestBed.createComponent(QueueComponent);
    component = fixture.componentInstance;
    http     = TestBed.inject(HttpTestingController);

    // Flush the initial GET /queue/secretary triggered by ngOnInit
    fixture.detectChanges();
    http.expectOne('/api/queue/secretary').flush(mockSecretaryView);
    fixture.detectChanges();
  });

  afterEach(() => {
    // toggleAddForm() lazily calls loadPatients() which fires GET /api/patients.
    // Flush any leftover patients requests before verifying — tests that don't
    // need to assert on patients don't have to flush it themselves.
    http.match(req => req.url.includes('/api/patients')).forEach(r =>
      r.flush({ data: [], total: 0 })
    );
    http.verify();
  });

  // ── toggleAddForm ───────────────────────────────────────────────────────────

  describe('toggleAddForm()', () => {
    it('opens the form on first call', () => {
      expect(component.showAddForm()).toBeFalse();
      component.toggleAddForm();
      expect(component.showAddForm()).toBeTrue();
    });

    it('closes the form on second call', () => {
      component.toggleAddForm();
      component.toggleAddForm();
      expect(component.showAddForm()).toBeFalse();
    });

    it('resets addPatientName when toggling', () => {
      component.addPatientName.set('Karima');
      component.toggleAddForm();   // open
      expect(component.addPatientName()).toBe('');
      component.addPatientName.set('Karima');
      component.toggleAddForm();   // close
      expect(component.addPatientName()).toBe('');
    });
  });

  // ── onAddKeydown ────────────────────────────────────────────────────────────

  describe('onAddKeydown()', () => {
    beforeEach(() => component.toggleAddForm()); // open form

    it('closes form and resets name on Escape', () => {
      component.addPatientName.set('Youcef');
      component.onAddKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(component.showAddForm()).toBeFalse();
      expect(component.addPatientName()).toBe('');
    });

    it('does NOT close form on other keys', () => {
      component.onAddKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(component.showAddForm()).toBeTrue();

      component.onAddKeydown(new KeyboardEvent('keydown', { key: 'Tab' }));
      expect(component.showAddForm()).toBeTrue();
    });
  });

  // ── addWalkIn — guard clauses ───────────────────────────────────────────────

  describe('addWalkIn() — guard clauses', () => {
    it('does nothing when name is blank', () => {
      component.addPatientName.set('   ');
      component.addWalkIn();
      http.expectNone('/api/queue/join');
      expect(toastSpy.error).not.toHaveBeenCalled();
    });

    it('does nothing when already loading', () => {
      component.addPatientName.set('Fatima');
      component.addLoading.set(true);
      component.addWalkIn();
      http.expectNone('/api/queue/join');
      // loading flag stays true — no state change
      expect(component.addLoading()).toBeTrue();
    });

    it('shows error toast when tenantId is missing', () => {
      const authNoTenant = TestBed.inject(AuthService) as any;
      authNoTenant.user = signal({ tenantId: null, id: 'u2', email: 'x@x.com', role: 'SECRETAIRE' });

      component.addPatientId.set('patient-123');
      component.addPatientName.set('Fatima');
      component.addWalkIn();
      http.expectNone('/api/queue/join');
      expect(toastSpy.error).toHaveBeenCalledWith('Tenant introuvable');
    });
  });

  // ── addWalkIn — happy path ──────────────────────────────────────────────────

  describe('addWalkIn() — happy path', () => {
    const PATIENT_NAME  = 'Meriem Bouzid';
    const PATIENT_ID    = 'patient-123';

    beforeEach(() => {
      component.toggleAddForm();
      component.addPatientId.set(PATIENT_ID);
      component.addPatientName.set(PATIENT_NAME);
    });

    it('sets addLoading to true while request is in-flight', fakeAsync(() => {
      component.addWalkIn();
      expect(component.addLoading()).toBeTrue();

      http.expectOne('/api/queue/join').flush({ tokenId: 'abc', estimatedPosition: 1 });
      // flush the subsequent GET /queue/secretary
      http.expectOne('/api/queue/secretary').flush(mockSecretaryView);
      tick();
      expect(component.addLoading()).toBeFalse();
    }));

    it('calls POST /queue/join with correct body', fakeAsync(() => {
      component.addWalkIn();

      const req = http.expectOne('/api/queue/join');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ tenantId: TENANT_ID, patientName: PATIENT_NAME, patientId: PATIENT_ID });

      req.flush({ tokenId: 'abc', estimatedPosition: 1 });
      http.expectOne('/api/queue/secretary').flush(mockSecretaryView);
      tick();
    }));

    it('shows success toast with patient name', fakeAsync(() => {
      component.addWalkIn();
      http.expectOne('/api/queue/join').flush({ tokenId: 'abc', estimatedPosition: 1 });
      http.expectOne('/api/queue/secretary').flush(mockSecretaryView);
      tick();

      expect(toastSpy.success).toHaveBeenCalledWith(`${PATIENT_NAME} ajouté(e) à la file`);
    }));

    it('closes form and resets name after success', fakeAsync(() => {
      component.addWalkIn();
      http.expectOne('/api/queue/join').flush({ tokenId: 'abc', estimatedPosition: 1 });
      http.expectOne('/api/queue/secretary').flush(mockSecretaryView);
      tick();

      expect(component.showAddForm()).toBeFalse();
      expect(component.addPatientName()).toBe('');
    }));

    it('refreshes the walk-in lane after success', fakeAsync(() => {
      const newView = {
        ...mockSecretaryView,
        walkInLane: [
          ...mockSecretaryView.walkInLane,
          {
            id: 'token-2', patientName: PATIENT_NAME, type: 'WALK_IN',
            status: 'WAITING', appointmentTime: null,
            arrivedAt: new Date().toISOString(), isManual: false,
          },
        ],
      };

      component.addWalkIn();
      http.expectOne('/api/queue/join').flush({ tokenId: 'token-2', estimatedPosition: 2 });
      http.expectOne('/api/queue/secretary').flush(newView);
      tick();

      expect(component.walkInLane().length).toBe(2);
    }));
  });

  // ── addWalkIn — error path ──────────────────────────────────────────────────

  describe('addWalkIn() — error path', () => {
    beforeEach(() => {
      component.toggleAddForm();
      component.addPatientId.set('patient-123');
      component.addPatientName.set('Bilal Hamdi');
    });

    it('shows error toast on HTTP failure', fakeAsync(() => {
      component.addWalkIn();
      http.expectOne('/api/queue/join').flush(
        { message: 'Internal Server Error' },
        { status: 500, statusText: 'Server Error' }
      );
      tick();

      expect(toastSpy.error).toHaveBeenCalledWith('Erreur lors de l\'ajout du patient');
    }));

    it('clears addLoading on HTTP failure', fakeAsync(() => {
      component.addWalkIn();
      expect(component.addLoading()).toBeTrue();

      http.expectOne('/api/queue/join').flush(
        { message: 'Bad Request' },
        { status: 400, statusText: 'Bad Request' }
      );
      tick();

      expect(component.addLoading()).toBeFalse();
    }));

    it('keeps the form open and preserves the name on error', fakeAsync(() => {
      component.addWalkIn();
      http.expectOne('/api/queue/join').flush(
        { message: 'Error' },
        { status: 500, statusText: 'Server Error' }
      );
      tick();

      // form stays open so the secretary can retry
      expect(component.showAddForm()).toBeTrue();
      expect(component.addPatientName()).toBe('Bilal Hamdi');
    }));

    it('does NOT refresh the lane on HTTP failure', fakeAsync(() => {
      const initialLength = component.walkInLane().length;
      component.addWalkIn();
      http.expectOne('/api/queue/join').flush(
        { message: 'Error' },
        { status: 500, statusText: 'Server Error' }
      );
      tick();

      // no new GET /queue/secretary should have been issued
      http.expectNone('/api/queue/secretary');
      expect(component.walkInLane().length).toBe(initialLength);
    }));
  });

  // ── DOM integration ─────────────────────────────────────────────────────────

  describe('DOM — walk-in lane header', () => {
    it('renders the add button in the walk-in lane header', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.q-lane__fab--walkin') as HTMLButtonElement;
      expect(btn).toBeTruthy();
    });

    it('does NOT render the inline form by default', () => {
      fixture.detectChanges();
      const form = fixture.nativeElement.querySelector('.q-add-form');
      expect(form).toBeNull();
    });

    it('shows the inline form after clicking add button', () => {
      component.toggleAddForm();
      fixture.detectChanges();
      const form = fixture.nativeElement.querySelector('.q-add-form');
      expect(form).toBeTruthy();
    });

    it('disables the confirm button when input is empty', () => {
      component.toggleAddForm();
      fixture.detectChanges();
      const confirmBtn = fixture.nativeElement.querySelector('.q-add-confirm') as HTMLButtonElement;
      expect(confirmBtn.disabled).toBeTrue();
    });

    it('enables the confirm button when input has text', () => {
      component.toggleAddForm();
      component.addPatientId.set('patient-123');
      component.addPatientName.set('Asma');
      fixture.detectChanges();
      const confirmBtn = fixture.nativeElement.querySelector('.q-add-confirm') as HTMLButtonElement;
      expect(confirmBtn.disabled).toBeFalse();
    });

    it('disables the input while loading', () => {
      component.toggleAddForm();
      component.addLoading.set(true);
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('.q-add-input') as HTMLSelectElement;
      expect(input.disabled).toBeTrue();
    });

    it('shows spinner inside confirm button while loading', () => {
      component.toggleAddForm();
      component.addLoading.set(true);
      fixture.detectChanges();
      const spinner = fixture.nativeElement.querySelector('.q-add-confirm .spinner-border');
      expect(spinner).toBeTruthy();
    });
  });

  // ── toggleCheckinPanel ──────────────────────────────────────────────────────

  describe('toggleCheckinPanel()', () => {
    it('opens the panel and triggers GET /queue/pending-checkin', fakeAsync(() => {
      component.toggleCheckinPanel();
      const req = http.expectOne('/api/queue/pending-checkin');
      expect(req.request.method).toBe('GET');
      req.flush(mockPendingCheckins);
      tick();

      expect(component.showCheckinPanel()).toBeTrue();
      expect(component.pendingCheckins()).toHaveSize(2);
    }));

    it('closes the panel without re-fetching', fakeAsync(() => {
      // open
      component.toggleCheckinPanel();
      http.expectOne('/api/queue/pending-checkin').flush(mockPendingCheckins);
      tick();

      // close
      component.toggleCheckinPanel();
      http.expectNone('/api/queue/pending-checkin');
      expect(component.showCheckinPanel()).toBeFalse();
    }));

    it('shows error toast when pending-checkin request fails', fakeAsync(() => {
      component.toggleCheckinPanel();
      http.expectOne('/api/queue/pending-checkin').flush(
        { message: 'Error' }, { status: 500, statusText: 'Server Error' }
      );
      tick();

      expect(toastSpy.error).toHaveBeenCalledWith('Impossible de charger les rendez-vous');
      expect(component.checkinPanelLoading()).toBeFalse();
    }));
  });

  // ── checkinRdv — happy path ─────────────────────────────────────────────────

  describe('checkinRdv() — happy path', () => {
    beforeEach(fakeAsync(() => {
      // open panel and load list
      component.toggleCheckinPanel();
      http.expectOne('/api/queue/pending-checkin').flush(mockPendingCheckins);
      tick();
    }));

    it('calls POST /queue/checkin with the correct rdvId', fakeAsync(() => {
      component.checkinRdv(RDV_ID_1, 'Amina Khalil');

      const req = http.expectOne('/api/queue/checkin');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ rdvId: RDV_ID_1 });

      req.flush({ tokenId: 'new-token' });
      http.expectOne('/api/queue/secretary').flush({ appointmentLane: [], walkInLane: [] });
      tick();
    }));

    it('shows success toast with patient name', fakeAsync(() => {
      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      http.expectOne('/api/queue/checkin').flush({ tokenId: 'new-token' });
      http.expectOne('/api/queue/secretary').flush({ appointmentLane: [], walkInLane: [] });
      tick();

      expect(toastSpy.success).toHaveBeenCalledWith("Amina Khalil ajouté(e) en file d'attente");
    }));

    it('removes the checked-in patient from the panel immediately', fakeAsync(() => {
      expect(component.pendingCheckins()).toHaveSize(2);

      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      http.expectOne('/api/queue/checkin').flush({ tokenId: 'new-token' });
      http.expectOne('/api/queue/secretary').flush({ appointmentLane: [], walkInLane: [] });
      tick();

      const remaining = component.pendingCheckins();
      expect(remaining).toHaveSize(1);
      expect(remaining[0].rdvId).toBe(RDV_ID_2);
    }));

    it('refreshes the appointment lane after checkin', fakeAsync(() => {
      const newApptToken = {
        id: 'new-token', patientName: 'Amina Khalil', type: 'APPOINTMENT',
        status: 'WAITING', appointmentTime: new Date().toISOString(),
        arrivedAt: new Date().toISOString(), isManual: false,
      };

      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      http.expectOne('/api/queue/checkin').flush({ tokenId: 'new-token' });
      http.expectOne('/api/queue/secretary').flush({
        appointmentLane: [newApptToken], walkInLane: [],
      });
      tick();

      expect(component.apptLane()).toHaveSize(1);
      expect(component.apptLane()[0].patientName).toBe('Amina Khalil');
    }));

    it('does not trigger a second checkin if one is already in-flight', fakeAsync(() => {
      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      expect(component.checkinActionId()).toBe(RDV_ID_1);

      // try a second checkin while first is in-flight
      component.checkinRdv(RDV_ID_2, 'Omar Bensalem');
      // only one POST should be pending
      http.expectOne('/api/queue/checkin').flush({ tokenId: 'new-token' });
      http.expectOne('/api/queue/secretary').flush({ appointmentLane: [], walkInLane: [] });
      tick();
    }));
  });

  // ── checkinRdv — error path ─────────────────────────────────────────────────

  describe('checkinRdv() — error path', () => {
    beforeEach(fakeAsync(() => {
      component.toggleCheckinPanel();
      http.expectOne('/api/queue/pending-checkin').flush(mockPendingCheckins);
      tick();
    }));

    it('shows server error message on failure', fakeAsync(() => {
      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      http.expectOne('/api/queue/checkin').flush(
        { message: 'Ce patient est déjà dans la file d\'attente' },
        { status: 409, statusText: 'Conflict' }
      );
      tick();

      expect(toastSpy.error).toHaveBeenCalledWith('Ce patient est déjà dans la file d\'attente');
    }));

    it('falls back to generic message when no server message', fakeAsync(() => {
      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      http.expectOne('/api/queue/checkin').flush(
        {}, { status: 500, statusText: 'Server Error' }
      );
      tick();

      expect(toastSpy.error).toHaveBeenCalledWith('Erreur lors de l\'enregistrement');
    }));

    it('clears checkinActionId on failure', fakeAsync(() => {
      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      expect(component.checkinActionId()).toBe(RDV_ID_1);

      http.expectOne('/api/queue/checkin').flush(
        { message: 'Error' }, { status: 500, statusText: 'Server Error' }
      );
      tick();

      expect(component.checkinActionId()).toBeNull();
    }));

    it('keeps the patient in the panel list on failure', fakeAsync(() => {
      component.checkinRdv(RDV_ID_1, 'Amina Khalil');
      http.expectOne('/api/queue/checkin').flush(
        { message: 'Error' }, { status: 409, statusText: 'Conflict' }
      );
      tick();

      // list unchanged — secretary can see the patient is still pending
      expect(component.pendingCheckins()).toHaveSize(2);
    }));
  });

  // ── DOM — checkin panel ─────────────────────────────────────────────────────

  describe('DOM — appointment lane checkin panel', () => {
    it('renders the checkin button in the appointment lane header', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.q-lane__fab--appt') as HTMLButtonElement;
      expect(btn).toBeTruthy();
    });

    it('does NOT render the checkin panel by default', () => {
      fixture.detectChanges();
      const panel = fixture.nativeElement.querySelector('.q-checkin-panel');
      expect(panel).toBeNull();
    });

    it('shows the checkin panel after signal is set', fakeAsync(() => {
      component.showCheckinPanel.set(true);
      component.checkinPanelLoading.set(false);
      component.pendingCheckins.set(mockPendingCheckins);
      fixture.detectChanges();

      const panel = fixture.nativeElement.querySelector('.q-checkin-panel');
      expect(panel).toBeTruthy();

      const rows = fixture.nativeElement.querySelectorAll('.q-checkin-row');
      expect(rows.length).toBe(2);
    }));

    it('shows loading spinner while panel is loading', () => {
      component.showCheckinPanel.set(true);
      component.checkinPanelLoading.set(true);
      fixture.detectChanges();

      const loading = fixture.nativeElement.querySelector('.q-checkin-panel .spinner-border');
      expect(loading).toBeTruthy();
    });

    it('shows empty state message when no pending checkins', () => {
      component.showCheckinPanel.set(true);
      component.checkinPanelLoading.set(false);
      component.pendingCheckins.set([]);
      fixture.detectChanges();

      const empty = fixture.nativeElement.querySelector('.q-checkin-panel .q-checkin-msg');
      expect(empty).toBeTruthy();
    });

    it('disables all checkin buttons when one is in-flight', () => {
      component.showCheckinPanel.set(true);
      component.checkinPanelLoading.set(false);
      component.pendingCheckins.set(mockPendingCheckins);
      component.checkinActionId.set(RDV_ID_1);
      fixture.detectChanges();

      const btns = fixture.nativeElement.querySelectorAll('.q-checkin-btn') as NodeListOf<HTMLButtonElement>;
      btns.forEach(btn => expect(btn.disabled).toBeTrue());
    });

    it('shows spinner on the button being actioned', () => {
      component.showCheckinPanel.set(true);
      component.checkinPanelLoading.set(false);
      component.pendingCheckins.set(mockPendingCheckins);
      component.checkinActionId.set(RDV_ID_1);
      fixture.detectChanges();

      // first row's button should show spinner (RDV_ID_1 is the first item)
      const firstRowBtn = fixture.nativeElement.querySelector('.q-checkin-row .q-checkin-btn');
      const spinner = firstRowBtn.querySelector('.spinner-border');
      expect(spinner).toBeTruthy();
    });
  });
});
