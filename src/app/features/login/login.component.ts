import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { AuthService } from '../../core/auth.service';
import { LoginPayload } from '../../core/app.models';

type Step =
  | 'login'
  | 'register'
  | 'verify-email'
  | 'request'
  | 'reset'
  | 'done-register'
  | 'done-reset';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private readonly fb    = inject(FormBuilder);
  private readonly auth  = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  // ── Estado global ─────────────────────────
  readonly step      = signal<Step>('login');
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);
  readonly devToken  = signal<string | null>(null);

  // ── Login ──────────────────────────────────
  readonly loginForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
    password:   ['', [Validators.required, Validators.minLength(4)]],
  });

  // ── Registro ───────────────────────────────
  readonly registerForm = this.fb.nonNullable.group({
    full_name:       ['', Validators.required],
    username:        ['', [Validators.required, Validators.minLength(3)]],
    email:           ['', [Validators.required, Validators.email]],
    password:        ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });
  readonly fieldErrors = signal<Record<string, string>>({});

  // ── Verificar email ────────────────────────
  readonly verifyForm = this.fb.nonNullable.group({
    token: ['', Validators.required],
  });

  // ── Recuperar contraseña ───────────────────
  readonly requestForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly resetForm = this.fb.nonNullable.group({
    token:           ['', Validators.required],
    password:        ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  });

  // ── Init: detecta ?verify=TOKEN en la URL ──
  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['verify']) {
        this.verifyForm.patchValue({ token: params['verify'] });
        this.step.set('verify-email');
      } else if (params['token']) {
        this.resetForm.patchValue({ token: params['token'] });
        this.step.set('reset');
      }
    });
  }

  // ── Login ──────────────────────────────────
  login(): void {
    this.error.set(null);
    if (this.loginForm.invalid) { this.loginForm.markAllAsTouched(); return; }

    const { identifier, password } = this.loginForm.getRawValue();
    const payload: LoginPayload = identifier.includes('@')
      ? { email: identifier, password }
      : { username: identifier, password };

    this.loading.set(true);
    this.auth.login(payload).subscribe({
      next: () => { this.loading.set(false); this.router.navigateByUrl('/dashboard'); },
      error: (err) => { this.loading.set(false); this.error.set(this.extractError(err)); },
    });
  }

  // ── Registro ───────────────────────────────
  submitRegister(): void {
    this.error.set(null);
    this.fieldErrors.set({});
    const { password, confirmPassword } = this.registerForm.getRawValue();

    if (password !== confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); return; }

    const { full_name, username, email } = this.registerForm.getRawValue();
    this.loading.set(true);

    this.auth.register({ full_name, username, email, password }).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        if (res?.dev_token) this.devToken.set(res.dev_token);
        this.step.set('verify-email');
      },
      error: (err) => {
        this.loading.set(false);
        const raw = (err as { error?: unknown })?.error;
        if (raw && typeof raw === 'object') {
          this.fieldErrors.set(raw as Record<string, string>);
        } else {
          this.error.set(this.extractError(err));
        }
      },
    });
  }

  // ── Verificar email ────────────────────────
  submitVerify(): void {
    this.error.set(null);
    if (this.verifyForm.invalid) { this.verifyForm.markAllAsTouched(); return; }

    const { token } = this.verifyForm.getRawValue();
    this.loading.set(true);

    this.auth.verifyEmail(token).subscribe({
      next: () => { this.loading.set(false); this.step.set('done-register'); },
      error: (err) => { this.loading.set(false); this.error.set(this.extractError(err)); },
    });
  }

  // ── Recuperar contraseña ───────────────────
  requestRecovery(): void {
    this.error.set(null);
    if (this.requestForm.invalid) { this.requestForm.markAllAsTouched(); return; }

    const { identifier } = this.requestForm.getRawValue();
    this.loading.set(true);

    this.auth.requestRecovery(identifier).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        if (res?.dev_token) this.devToken.set(res.dev_token);
        this.step.set('reset');
      },
      error: (err) => { this.loading.set(false); this.error.set(this.extractError(err)); },
    });
  }

  resetPassword(): void {
    this.error.set(null);
    const { token, password, confirmPassword } = this.resetForm.getRawValue();

    if (password !== confirmPassword) { this.error.set('Las contraseñas no coinciden.'); return; }
    if (this.resetForm.invalid) { this.resetForm.markAllAsTouched(); return; }

    this.loading.set(true);
    this.auth.resetPassword(token, password).subscribe({
      next: () => { this.loading.set(false); this.step.set('done-reset'); },
      error: (err) => { this.loading.set(false); this.error.set(this.extractError(err)); },
    });
  }

  // ── Helpers ────────────────────────────────
  goTo(s: Step): void {
    this.step.set(s);
    this.error.set(null);
    this.fieldErrors.set({});
  }

  fieldError(key: string): string | null {
    return this.fieldErrors()[key] ?? null;
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
