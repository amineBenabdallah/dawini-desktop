import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

import { PatientsComponent } from './patients.component';
import { ToastService } from '../../core/services/toast.service';

// ── mock data ─────────────────────────────────────────────────────────────────

const PATIENTS = [
  { id: 'p1', firstName: 'Amina',  lastName: 'Khalil',  phone: '0550001234', dateOfBirth: '1990-05-12', gender: 'F' },
  { id: 'p2', firstName: 'Omar',   lastName: 'Bensalem', phone: '0551009988', dateOfBirth: '1985-11-03', gender: 'M' },
];

function flushLoad(http: HttpTestingController, override = { data: PATIENTS, total: PATIENTS.length }) {
  http.expectOne(r => r.url.includes('patients') && r.params.has('page')).flush(override);
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('PatientsComponent', () => {
  let fixture: ComponentFixture<PatientsComponent>;
  let component: PatientsComponent;
  let http: HttpTestingController;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [PatientsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture   = TestBed.createComponent(PatientsComponent);
    component = fixture.componentInstance;
    http      = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
  });

  afterEach(() => {
    http.match(r => r.url.includes('patients')).forEach(r => r.flush({ data: [], total: 0 }));
    http.verify();
  });

  // ── initial load ────────────────────────────────────────────────────────────

  it('should create', () => {
    flushLoad(http);
    expect(component).toBeTruthy();
  });

  it('loading starts true', () => {
    expect(component.loading()).toBeTrue();
    flushLoad(http);
  });

  it('populates patients after load', fakeAsync(() => {
    flushLoad(http);
    tick();
    expect(component.patients().length).toBe(2);
    expect(component.total()).toBe(2);
    expect(component.loading()).toBeFalse();
  }));

  it('sets loading false on API error', fakeAsync(() => {
    http.expectOne(r => r.url.includes('patients') && r.params.has('page')).flush(
      { message: 'Server error' }, { status: 500, statusText: 'Internal Server Error' },
    );
    tick();
    expect(component.loading()).toBeFalse();
  }));

  // ── search ──────────────────────────────────────────────────────────────────

  it('onSearch() resets page to 1 and reloads', fakeAsync(() => {
    flushLoad(http);
    tick();

    component.page.set(3);
    component.search = 'Amina';
    component.onSearch();

    expect(component.page()).toBe(1);

    flushLoad(http);
    tick();
  }));

  // ── pagination ──────────────────────────────────────────────────────────────

  it('totalPages() returns 1 when total ≤ 20', fakeAsync(() => {
    flushLoad(http, { data: PATIENTS, total: 15 });
    tick();
    expect(component.totalPages()).toBe(1);
  }));

  it('totalPages() returns ceil(total / 20)', fakeAsync(() => {
    flushLoad(http, { data: PATIENTS, total: 45 });
    tick();
    expect(component.totalPages()).toBe(3);
  }));

  it('setPage() changes page and reloads', fakeAsync(() => {
    flushLoad(http, { data: PATIENTS, total: 45 });
    tick();

    component.setPage(2);
    flushLoad(http, { data: [], total: 45 });
    tick();

    expect(component.page()).toBe(2);
  }));

  // ── canSave ─────────────────────────────────────────────────────────────────

  it('canSave is false when form is empty', () => {
    component.openModal();
    expect(component.canSave).toBeFalse();
  });

  it('canSave is false when gender is missing', () => {
    component.openModal();
    component.form.firstName  = 'Amina';
    component.form.lastName   = 'Khalil';
    component.form.phone      = '0550001234';
    component.form.dateOfBirth = '1990-05-12';
    // gender left empty
    expect(component.canSave).toBeFalse();
  });

  it('canSave is true when all required fields are filled', () => {
    component.openModal();
    component.form.firstName  = 'Amina';
    component.form.lastName   = 'Khalil';
    component.form.phone      = '0550001234';
    component.form.dateOfBirth = '1990-05-12';
    component.form.gender     = 'F';
    expect(component.canSave).toBeTrue();
  });

  // ── save (create patient) ───────────────────────────────────────────────────

  it('save() is a no-op when canSave is false', () => {
    component.openModal();
    component.save();
    http.expectNone(r => r.method === 'POST');
    expect(component.saving()).toBeFalse();
  });

  it('save() POSTs trimmed fields and closes modal on success', fakeAsync(() => {
    flushLoad(http);
    tick();

    component.openModal();
    fillForm(component);
    component.save();
    tick();

    const req = http.expectOne(r => r.method === 'POST' && r.url.includes('patients'));
    expect(req.request.body).toEqual(jasmine.objectContaining({
      firstName: 'Amina', lastName: 'Khalil', phone: '0550001234', gender: 'F',
    }));
    req.flush({ id: 'new-p' });

    // reloads
    flushLoad(http);
    tick();

    expect(component.showModal()).toBeFalse();
    expect(component.saving()).toBeFalse();
    expect(toastSpy.success).toHaveBeenCalled();
  }));

  it('save() strips undefined optional fields', fakeAsync(() => {
    flushLoad(http);
    tick();

    component.openModal();
    fillForm(component);
    // leave email/wilaya/commune/nss empty
    component.save();
    tick();

    const req = http.expectOne(r => r.method === 'POST');
    expect(req.request.body['email']).toBeUndefined();
    expect(req.request.body['wilaya']).toBeUndefined();
    req.flush({ id: 'new-p' });
    flushLoad(http);
    tick();
  }));

  it('save() shows error toast and keeps modal open on failure', fakeAsync(() => {
    flushLoad(http);
    tick();

    component.openModal();
    fillForm(component);
    component.save();
    tick();

    http.expectOne(r => r.method === 'POST').flush(
      { message: 'Duplicate phone' }, { status: 409, statusText: 'Conflict' },
    );

    expect(toastSpy.error).toHaveBeenCalledWith('Duplicate phone');
    expect(component.showModal()).toBeTrue();
    expect(component.saving()).toBeFalse();
  }));

  it('save() is a no-op when already saving', fakeAsync(() => {
    flushLoad(http);
    tick();

    component.openModal();
    fillForm(component);
    component.saving.set(true);
    component.save();

    http.expectNone(r => r.method === 'POST');
  }));

  // ── viewPatient ─────────────────────────────────────────────────────────────

  it('viewPatient() opens detail modal and sets selectedPatient on success', fakeAsync(() => {
    flushLoad(http);
    tick();

    component.viewPatient('p1');
    expect(component.showDetailModal()).toBeTrue();
    expect(component.detailLoading()).toBeTrue();

    http.expectOne(r => r.url.includes('patients/p1')).flush(PATIENTS[0]);
    tick();

    expect(component.selectedPatient()).toEqual(PATIENTS[0] as any);
    expect(component.detailLoading()).toBeFalse();
  }));

  it('viewPatient() closes modal and shows error toast on failure', fakeAsync(() => {
    flushLoad(http);
    tick();

    component.viewPatient('bad-id');
    http.expectOne(r => r.url.includes('patients/bad-id')).flush(
      { message: 'Not found' }, { status: 404, statusText: 'Not Found' },
    );
    tick();

    expect(component.showDetailModal()).toBeFalse();
    expect(toastSpy.error).toHaveBeenCalledWith('Patient introuvable');
  }));

  // ── age() helper ────────────────────────────────────────────────────────────

  it('age() returns — for undefined', () => {
    expect(component.age(undefined)).toBe('—');
  });

  it('age() returns a numeric string ending with "ans"', () => {
    const result = component.age('1990-01-01');
    expect(result).toMatch(/^\d+ ans$/);
  });
});

// ── test helper ───────────────────────────────────────────────────────────────

function fillForm(component: PatientsComponent): void {
  component.form.firstName   = 'Amina';
  component.form.lastName    = 'Khalil';
  component.form.phone       = '0550001234';
  component.form.dateOfBirth = '1990-05-12';
  component.form.gender      = 'F';
}
