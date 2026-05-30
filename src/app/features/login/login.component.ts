import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { AuthService } from '../../core/auth.service';
import { LoginPayload } from '../../core/app.models';

type RecoveryStep = 'login' | 'request' | 'token-shown' | 'reset' | 'done';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ── Login ──────────────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  // ── Recovery ───────────────────────────────
  readonly recoveryStep = signal<RecoveryStep>('login');
  readonly recoveryLoading = signal(false);
  readonly recoveryError = signal<string | null>(null);
  readonly recoveryToken = signal<string | null>(null);
  readonly tokenCopied = signal(false);

  readonly requestForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly resetForm = this.fb.nonNullable.group({
    token: ['', Validators.required],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  // ── Login actions ──────────────────────────
  submit(): void {
    this.error.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.getRawValue();
    const payload: LoginPayload = identifier.includes('@')
      ? { email: identifier, password }
      : { username: identifier, password };

    this.loading.set(true);
    this.auth.login(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(this.extractError(err));
      },
    });
  }

  // ── Recovery actions ───────────────────────
  openRecovery(): void {
    this.recoveryStep.set('request');
    this.recoveryError.set(null);
    this.recoveryToken.set(null);
    this.requestForm.reset();
    this.resetForm.reset();
  }

  backToLogin(): void {
    this.recoveryStep.set('login');
    this.recoveryError.set(null);
  }

  requestRecovery(): void {
    this.recoveryError.set(null);
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }

    const { identifier } = this.requestForm.getRawValue();
    this.recoveryLoading.set(true);

    this.auth.requestRecovery(identifier).subscribe({
      next: (res) => {
        this.recoveryLoading.set(false);
        this.recoveryToken.set(res.token);
        this.recoveryStep.set('token-shown');
      },
      error: (err) => {
        this.recoveryLoading.set(false);
        this.recoveryError.set(this.extractError(err));
      },
    });
  }

  copyToken(): void {
    const token = this.recoveryToken();
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      this.tokenCopied.set(true);
      setTimeout(() => this.tokenCopied.set(false), 2000);
    });
  }

  goToReset(): void {
    this.resetForm.patchValue({ token: this.recoveryToken() ?? '' });
    this.recoveryStep.set('reset');
    this.recoveryError.set(null);
  }

  resetPassword(): void {
    this.recoveryError.set(null);
    const { token, password, confirmPassword } = this.resetForm.getRawValue();

    if (password !== confirmPassword) {
      this.recoveryError.set('Las contraseñas no coinciden.');
      return;
    }

    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.recoveryLoading.set(true);

    this.auth.resetPassword(token, password).subscribe({
      next: () => {
        this.recoveryLoading.set(false);
        this.recoveryStep.set('done');
      },
      error: (err) => {
        this.recoveryLoading.set(false);
        this.recoveryError.set(this.extractError(err));
      },
    });
  }

  private extractError(error: unknown): string {
    const detail = (error as { error?: unknown })?.error;

    if (typeof detail === 'string') return detail;

    if (detail && typeof detail === 'object') {
      const value = Object.values(detail as Record<string, unknown>)[0];
      if (Array.isArray(value)) return String(value[0]);
      if (typeof value === 'string') return value;
    }

    return 'No fue posible completar la operacion.';
  }
}
