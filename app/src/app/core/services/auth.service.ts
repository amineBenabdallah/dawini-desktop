import { Injectable, signal, computed } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  id: string;
  cabinetId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _token = signal<string | null>(
    localStorage.getItem('access_token'),
  );
  private readonly _refreshToken = signal<string | null>(
    localStorage.getItem('refresh_token'),
  );

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly role = computed(() => this._user()?.role ?? null);

  private readonly api = environment.apiUrl;
  private readonly httpDirect: HttpClient;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    httpBackend: HttpBackend,
  ) {
    this.httpDirect = new HttpClient(httpBackend);

    const token = this._token();
    if (token) {
      this.fetchProfile();
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${this.api}/auth/login`, { email, password })
      .pipe(
        tap((res) => {
          this.storeTokens(res.accessToken, res.refreshToken);
          this.fetchProfile();
        }),
      );
  }

  logout() {
    const refreshToken = this._refreshToken();
    if (refreshToken) {
      this.httpDirect
        .post(`${this.api}/auth/logout`, { refreshToken })
        .subscribe({ error: () => {} });
    }
    this._token.set(null);
    this._refreshToken.set(null);
    this._user.set(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    void this.router.navigate(['/login']);
  }

  refreshAccessToken(): Observable<{ accessToken: string }> {
    const refreshToken = this._refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    return this.httpDirect
      .post<{ accessToken: string }>(`${this.api}/auth/refresh`, { refreshToken })
      .pipe(
        tap((res) => {
          this._token.set(res.accessToken);
          localStorage.setItem('access_token', res.accessToken);
        }),
      );
  }

  private storeTokens(access: string, refresh: string) {
    this._token.set(access);
    this._refreshToken.set(refresh);
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  private fetchProfile() {
    const token = this._token();
    this.httpDirect
      .get<AuthUser>(`${this.api}/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .subscribe({
        next: (user) => this._user.set(user),
        error: () => this.logout(),
      });
  }
}
