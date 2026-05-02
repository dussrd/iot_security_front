import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { AuthService } from '../../core/auth.service';
import { LoginPayload, RegisterPayload } from '../../core/app.models';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);

  readonly mode = signal<'login' | 'register'>('login');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly roleOptions = ['admin', 'operador', 'lector'];

  readonly title = computed(() =>
    this.mode() === 'login' ? 'Acceso IoT Security' : 'Crear usuario',
  );
  readonly submitLabel = computed(() =>
    this.mode() === 'login' ? 'Iniciar sesion' : 'Crear usuario y entrar',
  );

  readonly loginForm = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  readonly registerForm = this.fb.nonNullable.group({
    home: [1, [Validators.required, Validators.min(1)]],
    full_name: ['', [Validators.required, Validators.minLength(3)]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: [''],
    role: ['lector', [Validators.required]],
  });

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  switchMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  submit(): void {
    this.error.set(null);

    if (this.mode() === 'login') {
      this.submitLogin();
      return;
    }

    this.submitRegister();
  }

  private submitLogin(): void {
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
      error: (error) => {
        this.loading.set(false);
        this.error.set(this.extractError(error));
      },
    });
  }

  private submitRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const payload = this.registerForm.getRawValue() as RegisterPayload;

    this.loading.set(true);
    this.auth.register(payload).subscribe({
      next: () => {
        this.auth.login({ username: payload.username, password: payload.password }).subscribe({
          next: () => {
            this.loading.set(false);
            this.router.navigateByUrl('/dashboard');
          },
          error: (error) => {
            this.loading.set(false);
            this.error.set(this.extractError(error));
          },
        });
      },
      error: (error) => {
        this.loading.set(false);
        this.error.set(this.extractError(error));
      },
    });
  }

  private extractError(error: unknown): string {
    const detail = (error as { error?: unknown })?.error;

    if (typeof detail === 'string') {
      return detail;
    }

    if (detail && typeof detail === 'object') {
      const value = Object.values(detail as Record<string, unknown>)[0];

      if (Array.isArray(value)) {
        return String(value[0]);
      }

      if (typeof value === 'string') {
        return value;
      }
    }

    return 'No fue posible completar la operacion.';
  }
}
