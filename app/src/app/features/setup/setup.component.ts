import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page">
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

      <div class="auth-form-panel">
        <div class="auth-form-card">
          <h2>Configuration initiale</h2>
          <p class="auth-subtitle">Cr&eacute;ez votre compte administrateur</p>

          @if (error()) {
            <div class="auth-alert error">
              <i class="bi bi-exclamation-circle"></i>
              {{ error() }}
            </div>
          }

          @if (success()) {
            <div class="auth-alert success">
              <i class="bi bi-check-circle"></i>
              Cabinet cr&eacute;&eacute; ! Redirection...
            </div>
          }

          <form (ngSubmit)="submit()" novalidate>
            <div class="auth-field-row">
              <div class="auth-field">
                <label>Pr&eacute;nom</label>
                <div class="auth-input-wrap">
                  <i class="bi bi-person"></i>
                  <input type="text" [(ngModel)]="firstName" name="firstName" placeholder="Ali" />
                </div>
              </div>
              <div class="auth-field">
                <label>Nom</label>
                <div class="auth-input-wrap">
                  <i class="bi bi-person"></i>
                  <input type="text" [(ngModel)]="lastName" name="lastName" placeholder="Benali" />
                </div>
              </div>
            </div>

            <div class="auth-field">
              <label>Adresse e-mail</label>
              <div class="auth-input-wrap">
                <i class="bi bi-envelope"></i>
                <input type="email" [(ngModel)]="email" name="email" placeholder="docteur&#64;cabinet.dz" />
              </div>
            </div>

            <div class="auth-field">
              <label>Mot de passe</label>
              <div class="auth-input-wrap">
                <i class="bi bi-lock"></i>
                <input type="password" [(ngModel)]="password" name="password"
                       placeholder="Minimum 8 caract&egrave;res" />
              </div>
            </div>

            <button type="submit" class="auth-btn" [disabled]="loading()">
              @if (loading()) {
                <span class="spinner-border spinner-border-sm me-2"></span>
                Cr&eacute;ation...
              } @else {
                Cr&eacute;er mon cabinet
                <i class="bi bi-arrow-right ms-2"></i>
              }
            </button>
          </form>

          <div class="auth-footer">
            D&eacute;j&agrave; configur&eacute; ?
            <a routerLink="/login">Se connecter</a>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './setup.component.scss',
})
export class SetupComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  success = signal(false);

  submit(): void {
    if (!this.firstName || !this.lastName || !this.email || !this.password) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('Le mot de passe doit contenir au moins 8 caract\u00e8res.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.http.post<{ accessToken: string; refreshToken: string }>(
      `${environment.apiUrl}/auth/setup`,
      { email: this.email, password: this.password, firstName: this.firstName, lastName: this.lastName },
    ).subscribe({
      next: (res) => {
        localStorage.setItem('access_token', res.accessToken);
        localStorage.setItem('refresh_token', res.refreshToken);
        this.success.set(true);
        setTimeout(() => { window.location.href = '/'; }, 800);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message?.[0] || err.error?.message || 'Une erreur est survenue.');
      },
    });
  }
}
