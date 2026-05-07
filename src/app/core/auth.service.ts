import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { API_BASE_URL } from './api-endpoints';
import { AppUser, AuthResponse, LoginPayload } from './app.models';

const TOKEN_KEY = 'iot_security_token';
const USER_KEY = 'iot_security_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenState = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly userState = signal<AppUser | null>(this.readStoredUser());

  readonly token = this.tokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.tokenState() && this.userState()));
  readonly isAdmin = computed(() =>
    Boolean(this.userState()?.roles?.some((role) => role.toLowerCase() === 'admin')),
  );

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_BASE_URL}/users/login/`, payload)
      .pipe(tap((response) => this.storeSession(response)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.tokenState.set(null);
    this.userState.set(null);
    this.router.navigateByUrl('/login');
  }

  updateUser(user: AppUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.userState.set(user);
  }

  updateProfile(payload: Partial<AppUser> & { password?: string }): Observable<AppUser> {
    return this.http
      .patch<AppUser>(`${API_BASE_URL}/users/users/me/`, payload)
      .pipe(tap((user) => this.updateUser(user)));
  }

  private storeSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.tokenState.set(response.token);
    this.userState.set(response.user);
  }

  private readStoredUser(): AppUser | null {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
