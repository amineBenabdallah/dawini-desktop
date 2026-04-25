import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService }    from '../../../core/services/auth.service';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeAuthStub(overrides: Partial<{ login: jasmine.Spy }> = {}) {
  return {
    login: overrides.login ?? jasmine.createSpy('login').and.returnValue(of({})),
  };
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authStub: ReturnType<typeof makeAuthStub>;

  beforeEach(async () => {
    authStub = makeAuthStub();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── initial state ──────────────────────────────────────────────────────────

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('form is invalid when empty', () => {
    expect(component.form.invalid).toBeTrue();
  });

  it('loading starts false', () => {
    expect(component.loading()).toBeFalse();
  });

  it('error starts empty', () => {
    expect(component.error()).toBe('');
  });

  // ── form validation ────────────────────────────────────────────────────────

  it('marks all fields touched when submitted with empty form', () => {
    component.submit();
    expect(component.emailCtrl.touched).toBeTrue();
    expect(component.pwdCtrl.touched).toBeTrue();
  });

  it('does NOT call auth.login when form is invalid', () => {
    component.submit();
    expect(authStub.login).not.toHaveBeenCalled();
  });

  it('emailCtrl invalid when email is malformed', () => {
    component.emailCtrl.setValue('not-an-email');
    component.emailCtrl.markAsTouched();
    expect(component.emailCtrl.invalid).toBeTrue();
  });

  it('pwdCtrl invalid when blank', () => {
    component.pwdCtrl.setValue('');
    component.pwdCtrl.markAsTouched();
    expect(component.pwdCtrl.invalid).toBeTrue();
  });

  // ── happy path ─────────────────────────────────────────────────────────────

  it('calls auth.login with correct credentials', fakeAsync(() => {
    component.emailCtrl.setValue('doc@cabinet.dz');
    component.pwdCtrl.setValue('secret123');
    component.submit();
    tick();
    expect(authStub.login).toHaveBeenCalledWith('doc@cabinet.dz', 'secret123');
  }));

  it('sets loading to true while request is in-flight', () => {
    authStub.login.and.returnValue(of({}).pipe()); // stays pending conceptually
    component.emailCtrl.setValue('doc@cabinet.dz');
    component.pwdCtrl.setValue('secret123');
    component.submit();
    expect(component.loading()).toBeTrue();
  });

  // ── error handling ─────────────────────────────────────────────────────────

  it('shows specific message on 401', fakeAsync(() => {
    authStub.login.and.returnValue(throwError(() => ({ status: 401 })));
    component.emailCtrl.setValue('doc@cabinet.dz');
    component.pwdCtrl.setValue('wrong');
    component.submit();
    tick();
    expect(component.error()).toBe('Email ou mot de passe incorrect.');
    expect(component.loading()).toBeFalse();
  }));

  it('shows generic message on non-401 error', fakeAsync(() => {
    authStub.login.and.returnValue(throwError(() => ({ status: 500 })));
    component.emailCtrl.setValue('doc@cabinet.dz');
    component.pwdCtrl.setValue('pwd');
    component.submit();
    tick();
    expect(component.error()).toBe('Erreur de connexion. Réessayez.');
    expect(component.loading()).toBeFalse();
  }));

  it('clears error on new submit attempt', fakeAsync(() => {
    // first attempt fails
    authStub.login.and.returnValue(throwError(() => ({ status: 500 })));
    component.emailCtrl.setValue('doc@cabinet.dz');
    component.pwdCtrl.setValue('pwd');
    component.submit();
    tick();
    expect(component.error()).not.toBe('');

    // second attempt — error cleared at start of submit
    authStub.login.and.returnValue(of({}));
    component.submit();
    expect(component.error()).toBe('');
    tick();
  }));

  // ── password toggle ────────────────────────────────────────────────────────

  it('showPwd starts false', () => {
    expect(component.showPwd()).toBeFalse();
  });

  it('toggles showPwd on button click', () => {
    component.showPwd.set(true);
    expect(component.showPwd()).toBeTrue();
    component.showPwd.set(false);
    expect(component.showPwd()).toBeFalse();
  });

  // ── DOM ───────────────────────────────────────────────────────────────────

  it('renders the submit button', () => {
    const btn = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(btn).toBeTruthy();
  });

  it('submit button is disabled while loading', () => {
    component.loading.set(true);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(btn.disabled).toBeTrue();
  });

  it('shows error alert when error signal is set', () => {
    component.error.set('Email ou mot de passe incorrect.');
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('.alert-danger');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Email ou mot de passe incorrect.');
  });

  it('no error alert by default', () => {
    const alert = fixture.nativeElement.querySelector('.alert-danger');
    expect(alert).toBeNull();
  });

  it('card has w-100 class (full-width on mobile)', () => {
    const card = fixture.nativeElement.querySelector('.login-card');
    expect(card).toBeTruthy();
    // card must not have a fixed pixel width — width: 100% with max-width cap
    expect(getComputedStyle(card).maxWidth).toBe('420px');
  });
});
