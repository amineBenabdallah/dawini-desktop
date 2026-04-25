import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <!-- Left panel — branding -->
      <div class="auth-brand">
        <div class="brand-content">
          <img src="assets/dawini-icon.svg" alt="" width="56" height="56" />
          <h1>Dawini</h1>
          <p>Gestion de cabinet m&eacute;dical intelligente</p>
          <div class="brand-features">
            <div class="feature"><i class="bi bi-shield-check"></i> Donn&eacute;es s&eacute;curis&eacute;es localement</div>
            <div class="feature"><i class="bi bi-lightning-charge"></i> Rapide et hors ligne</div>
            <div class="feature"><i class="bi bi-printer"></i> Impression native</div>
          </div>
        </div>
      </div>

      <!-- Right panel — form -->
      <div class="auth-form-panel">
        <div class="auth-form-card">
          <h2>Connexion</h2>
          <p class="auth-subtitle">Acc&eacute;dez &agrave; votre espace cabinet</p>

          @if (error()) {
            <div class="auth-alert error">
              <i class="bi bi-exclamation-circle"></i>
              {{ error() }}
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="auth-field">
              <label>Adresse e-mail</label>
              <div class="auth-input-wrap">
                <i class="bi bi-envelope"></i>
                <input type="email" formControlName="email"
                       placeholder="docteur&#64;cabinet.dz"
                       [class.invalid]="emailCtrl.invalid && emailCtrl.touched" />
              </div>
              @if (emailCtrl.invalid && emailCtrl.touched) {
                <span class="auth-error-text">Adresse e-mail invalide</span>
              }
            </div>

            <div class="auth-field">
              <label>Mot de passe</label>
              <div class="auth-input-wrap">
                <i class="bi bi-lock"></i>
                <input [type]="showPwd() ? 'text' : 'password'"
                       formControlName="password"
                       placeholder="Votre mot de passe"
                       [class.invalid]="pwdCtrl.invalid && pwdCtrl.touched" />
                <button type="button" class="pwd-toggle" (click)="showPwd.set(!showPwd())" tabindex="-1">
                  <i class="bi" [class.bi-eye]="!showPwd()" [class.bi-eye-slash]="showPwd()"></i>
                </button>
              </div>
              @if (pwdCtrl.invalid && pwdCtrl.touched) {
                <span class="auth-error-text">Mot de passe requis</span>
              }
            </div>

            <button type="submit" class="auth-btn" [disabled]="loading()">
              @if (loading()) {
                <span class="spinner-border spinner-border-sm me-2"></span>
                Connexion...
              } @else {
                Se connecter
                <i class="bi bi-arrow-right ms-2"></i>
              }
            </button>
          </form>

          <div class="auth-footer">
            Premi&egrave;re utilisation ?
            <a routerLink="/setup">Configurer le cabinet</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error   = signal('');
  readonly showPwd = signal(false);

  readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => window.location.href = '/',
      error: (err) => {
        this.error.set(err.status === 401 ? 'Email ou mot de passe incorrect.' : 'Erreur de connexion. R\u00e9essayez.');
        this.loading.set(false);
      },
    });
  }

  get emailCtrl() { return this.form.controls.email; }
  get pwdCtrl()   { return this.form.controls.password; }
}
