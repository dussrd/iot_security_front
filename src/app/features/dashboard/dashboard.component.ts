import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { ENDPOINTS } from '../../core/api-endpoints';
import { ApiRecord, EndpointDefinition, EndpointState, MetricCard } from '../../core/app.models';
import { AuthService } from '../../core/auth.service';
import { IotApiService } from '../../core/iot-api.service';
import { FormFieldDefinition, RESOURCE_FIELDS } from '../../core/resource-schemas';

type EditorMode = 'create' | 'edit';

@Component({
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    ProgressSpinnerModule,
    TagModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(IotApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly groups: EndpointDefinition['group'][] = ['core', 'devices', 'automation', 'users'];
  readonly selectedKey = signal('homes');
  readonly search = signal('');
  readonly loadingAll = signal(false);
  readonly actionMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly states = signal<Record<string, EndpointState>>(this.createInitialStates());

  editorVisible = false;
  editorMode: EditorMode = 'create';
  editorForm: Record<string, string | number | boolean | null> = {};
  editorFieldErrors: Record<string, string> = {};
  editorError = '';
  editorSaving = false;
  editingRecord: ApiRecord | null = null;
  pendingDelete: ApiRecord | null = null;

  readonly orderedStates = computed(() => ENDPOINTS.map((endpoint) => this.states()[endpoint.key]));
  readonly selectedState = computed(() => this.states()[this.selectedKey()]);
  readonly selectedDefinition = computed(() => this.selectedState().definition);
  readonly selectedRecords = computed(() => this.selectedState().records);
  readonly filteredRecords = computed(() => {
    const query = this.search().trim().toLowerCase();
    const records = this.selectedRecords();

    if (!query) {
      return records;
    }

    return records.filter((record) => this.recordSearchText(record).includes(query));
  });
  readonly columns = computed(() => this.resolveColumns(this.filteredRecords()));
  readonly metrics = computed<MetricCard[]>(() => [
    {
      label: 'Hogares',
      value: this.count('homes'),
      icon: 'pi pi-home',
      tone: 'teal',
      hint: 'Core',
    },
    {
      label: 'Nodos',
      value: this.count('nodes'),
      icon: 'pi pi-sitemap',
      tone: 'indigo',
      hint: 'Devices',
    },
    {
      label: 'Sensores',
      value: this.count('sensors'),
      icon: 'pi pi-compass',
      tone: 'sky',
      hint: 'Devices',
    },
    {
      label: 'Alertas',
      value: this.count('system-alerts'),
      icon: 'pi pi-exclamation-triangle',
      tone: 'rose',
      hint: 'Core',
    },
  ]);
  readonly groupBars = computed(() => {
    const groups = ['core', 'devices', 'automation', 'users'] as const;
    const values = groups.map((group) => ({
      key: group,
      label: this.groupLabel(group),
      value: this.orderedStates()
        .filter((state) => state.definition.group === group)
        .reduce((total, state) => total + state.records.length, 0),
    }));
    const max = Math.max(...values.map((item) => item.value), 1);

    return values.map((item) => ({
      ...item,
      width: `${Math.max(8, Math.round((item.value / max) * 100))}%`,
    }));
  });
  readonly activity = computed(() =>
    [
      ...this.makeActivity('system-alerts', 'Alerta', 'pi pi-exclamation-triangle'),
      ...this.makeActivity('motion-events', 'Movimiento', 'pi pi-bolt'),
      ...this.makeActivity('remote-commands', 'Comando', 'pi pi-send'),
      ...this.makeActivity('system-audits', 'Auditoria', 'pi pi-history'),
      ...this.makeActivity('notifications', 'Notificacion', 'pi pi-bell'),
    ]
      .sort((a, b) => b.timeValue - a.timeValue)
      .slice(0, 8),
  );

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loadingAll.set(true);
    this.actionError.set(null);

    const loadingState = { ...this.states() };

    for (const endpoint of ENDPOINTS) {
      loadingState[endpoint.key] = {
        ...loadingState[endpoint.key],
        loading: true,
        error: null,
      };
    }

    this.states.set(loadingState);

    forkJoin(
      ENDPOINTS.map((endpoint) =>
        this.api.list(endpoint).pipe(
          map((records) => ({ endpoint, records, error: null as string | null })),
          catchError((error) =>
            of({
              endpoint,
              records: [] as ApiRecord[],
              error: this.extractError(error),
            }),
          ),
        ),
      ),
    )
      .pipe(finalize(() => this.loadingAll.set(false)))
      .subscribe((responses) => {
        const nextState = { ...this.states() };

        for (const response of responses) {
          nextState[response.endpoint.key] = {
            definition: response.endpoint,
            records: response.records,
            loading: false,
            error: response.error,
          };
        }

        this.states.set(nextState);
      });
  }

  refreshSelected(): void {
    const endpoint = this.selectedDefinition();
    this.patchState(endpoint.key, { loading: true, error: null });

    this.api
      .list(endpoint)
      .pipe(finalize(() => this.patchState(endpoint.key, { loading: false })))
      .subscribe({
        next: (records) => this.patchState(endpoint.key, { records }),
        error: (error) => this.patchState(endpoint.key, { error: this.extractError(error), records: [] }),
      });
  }

  selectEndpoint(key: string): void {
    this.selectedKey.set(key);
    this.search.set('');
    this.actionMessage.set(null);
    this.actionError.set(null);
    this.pendingDelete = null;
  }

  openCreate(): void {
    this.editorMode = 'create';
    this.editingRecord = null;
    this.editorError = '';
    this.editorFieldErrors = {};
    this.editorForm = this.createEmptyForm();
    this.editorVisible = true;
  }

  openEdit(record: ApiRecord): void {
    this.editorMode = 'edit';
    this.editingRecord = record;
    this.editorError = '';
    this.editorFieldErrors = {};
    this.editorForm = this.createFormFromRecord(record);
    this.editorVisible = true;
  }

  saveForm(): void {
    this.editorError = '';
    this.editorFieldErrors = {};
    const payload = this.buildPayload();

    if (!payload) {
      return;
    }

    const endpoint = this.selectedDefinition();
    this.editorSaving = true;
    const request =
      this.editorMode === 'create'
        ? this.api.create(endpoint, payload)
        : this.api.update(endpoint, this.recordId(this.editingRecord), payload);

    request.pipe(finalize(() => (this.editorSaving = false))).subscribe({
      next: () => {
        this.editorVisible = false;
        this.actionMessage.set(
          this.editorMode === 'create' ? 'Registro creado correctamente.' : 'Registro actualizado.',
        );
        this.refreshSelected();
      },
      error: (error) => {
        this.editorError = this.extractError(error);
      },
    });
  }

  requestDelete(record: ApiRecord): void {
    this.pendingDelete = record;
    this.actionMessage.set(null);
    this.actionError.set(null);
  }

  cancelDelete(): void {
    this.pendingDelete = null;
  }

  confirmDelete(): void {
    if (!this.pendingDelete) {
      return;
    }

    const endpoint = this.selectedDefinition();
    const id = this.recordId(this.pendingDelete);

    this.api.remove(endpoint, id).subscribe({
      next: () => {
        this.pendingDelete = null;
        this.actionMessage.set('Registro eliminado.');
        this.refreshSelected();
      },
      error: (error) => this.actionError.set(this.extractError(error)),
    });
  }

  logout(): void {
    this.auth.logout();
  }

  goLogin(): void {
    this.router.navigateByUrl('/login');
  }

  formFields(): FormFieldDefinition[] {
    return RESOURCE_FIELDS[this.selectedKey()] ?? this.inferFieldsFromRecords();
  }

  relationOptions(field: FormFieldDefinition): ApiRecord[] {
    if (!field.relation) {
      return [];
    }

    return this.states()[field.relation]?.records ?? [];
  }

  relationOptionsLabel(field: FormFieldDefinition, record: ApiRecord): string {
    return field.relation ? this.objectLabel(field.relation, record) : this.displayValue(record['id']);
  }

  displayCell(record: ApiRecord, column: string): string {
    const field = this.fieldForColumn(column);

    if (field?.relation) {
      return this.relatedLabel(field.relation, record[column]);
    }

    return this.displayValue(record[column]);
  }

  fieldLabel(key: string): string {
    return this.fieldForColumn(key)?.label ?? this.columnLabel(key);
  }

  fieldInputType(field: FormFieldDefinition): string {
    if (field.type === 'datetime-local' || field.type === 'date' || field.type === 'email') {
      return field.type;
    }

    if (field.type === 'password') {
      return 'password';
    }

    return field.type === 'number' ? 'number' : 'text';
  }

  isRequired(field: FormFieldDefinition): boolean {
    if (this.editorMode === 'edit' && field.key === 'password') {
      return false;
    }

    return Boolean(field.required);
  }

  recordId(record: ApiRecord | null): string | number {
    const id = record?.['id'];
    return typeof id === 'string' || typeof id === 'number' ? id : '';
  }

  displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return 'Sin dato';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  columnLabel(key: string): string {
    return key.replaceAll('_', ' ');
  }

  isDateLike(value: unknown): boolean {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && value.includes('-');
  }

  dateValue(value: unknown): string | number | Date | null {
    return this.isDateLike(value) ? (value as string) : null;
  }

  groupLabel(group: EndpointDefinition['group']): string {
    const labels = {
      core: 'Core',
      devices: 'Dispositivos',
      automation: 'Automatizacion',
      users: 'Usuarios',
    };

    return labels[group];
  }

  private createInitialStates(): Record<string, EndpointState> {
    return ENDPOINTS.reduce<Record<string, EndpointState>>((state, endpoint) => {
      state[endpoint.key] = {
        definition: endpoint,
        records: [],
        loading: false,
        error: null,
      };
      return state;
    }, {});
  }

  private patchState(key: string, patch: Partial<EndpointState>): void {
    const state = this.states()[key];
    this.states.set({
      ...this.states(),
      [key]: {
        ...state,
        ...patch,
      },
    });
  }

  private count(key: string): number {
    return this.states()[key]?.records.length ?? 0;
  }

  private resolveColumns(records: ApiRecord[]): string[] {
    const hidden = new Set(['password', 'password_hash', 'recovery_token']);
    const keys = new Set<string>();

    for (const record of records.slice(0, 12)) {
      for (const key of Object.keys(record)) {
        if (!hidden.has(key)) {
          keys.add(key);
        }
      }
    }

    const ordered = Array.from(keys);
    ordered.sort((a, b) => {
      if (a === 'id') {
        return -1;
      }

      if (b === 'id') {
        return 1;
      }

      return a.localeCompare(b);
    });

    return ordered.slice(0, 8);
  }

  private fieldForColumn(column: string): FormFieldDefinition | undefined {
    return this.formFields().find((field) => field.key === column);
  }

  private relatedLabel(endpointKey: string, value: unknown): string {
    const record = (this.states()[endpointKey]?.records ?? []).find(
      (item) => String(item['id']) === String(value),
    );

    if (!record) {
      return value ? `#${String(value)}` : 'Sin asignar';
    }

    return this.objectLabel(endpointKey, record);
  }

  private objectLabel(endpointKey: string, record: ApiRecord): string {
    const labelFields: Record<string, string[]> = {
      homes: ['home_name', 'address'],
      zones: ['zone_name', 'description'],
      nodes: ['node_name', 'mac_address'],
      sensors: ['sensor_name', 'sensor_type'],
      actuators: ['actuator_name', 'actuator_type'],
      users: ['full_name', 'username', 'email'],
      roles: ['role_name', 'description'],
      'remote-commands': ['command_type', 'sending_status'],
    };

    for (const field of labelFields[endpointKey] ?? []) {
      if (record[field]) {
        return this.displayValue(record[field]);
      }
    }

    const fallback = ['title', 'rule_name', 'action', 'status', 'id'].find((field) => record[field]);
    return fallback ? this.displayValue(record[fallback]) : 'Objeto relacionado';
  }

  private toDateTimeLocal(value: unknown): string {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      return '';
    }

    return value.slice(0, 16);
  }

  private recordSearchText(record: ApiRecord): string {
    const values = this.resolveColumns([record]).map((column) => this.displayCell(record, column));
    return [...values, JSON.stringify(record)].join(' ').toLowerCase();
  }

  private createEmptyForm(): Record<string, string | number | boolean | null> {
    return this.formFields().reduce<Record<string, string | number | boolean | null>>((form, field) => {
      if (field.type === 'checkbox') {
        form[field.key] = false;
      } else if (field.options?.length) {
        form[field.key] = field.options[0];
      } else {
        form[field.key] = '';
      }

      return form;
    }, {});
  }

  private createFormFromRecord(record: ApiRecord): Record<string, string | number | boolean | null> {
    return this.formFields().reduce<Record<string, string | number | boolean | null>>((form, field) => {
      const value =
        field.key === 'role' && Array.isArray(record['roles']) ? record['roles'][0] : record[field.key];

      if (field.key === 'password') {
        form[field.key] = '';
      } else if (field.type === 'datetime-local') {
        form[field.key] = this.toDateTimeLocal(value);
      } else if (field.type === 'date') {
        form[field.key] = typeof value === 'string' ? value.slice(0, 10) : '';
      } else if (field.type === 'json') {
        form[field.key] = value ? JSON.stringify(value, null, 2) : '';
      } else if (field.type === 'checkbox') {
        form[field.key] = Boolean(value);
      } else if (typeof value === 'number' || typeof value === 'string') {
        form[field.key] = value;
      } else {
        form[field.key] = '';
      }

      return form;
    }, {});
  }

  private buildPayload(): ApiRecord | null {
    const payload: ApiRecord = {};

    for (const field of this.formFields()) {
      const rawValue = this.editorForm[field.key];
      const isEmpty = rawValue === '' || rawValue === null || rawValue === undefined;

      if (this.isRequired(field) && isEmpty) {
        this.editorFieldErrors[field.key] = 'Campo requerido.';
        continue;
      }

      if (this.editorMode === 'edit' && field.key === 'password' && isEmpty) {
        continue;
      }

      if (!field.required && isEmpty) {
        if (field.relation || ['number', 'date', 'datetime-local', 'json'].includes(field.type)) {
          payload[field.key] = null;
        }
        continue;
      }

      if (field.type === 'number' || field.relation) {
        payload[field.key] = Number(rawValue);
      } else if (field.type === 'checkbox') {
        payload[field.key] = Boolean(rawValue);
      } else if (field.type === 'json') {
        try {
          payload[field.key] = isEmpty ? null : JSON.parse(String(rawValue));
        } catch {
          this.editorFieldErrors[field.key] = 'JSON invalido.';
        }
      } else {
        payload[field.key] = rawValue;
      }
    }

    if (Object.keys(this.editorFieldErrors).length) {
      this.editorError = 'Revisa los campos marcados.';
      return null;
    }

    return payload;
  }

  private inferFieldsFromRecords(): FormFieldDefinition[] {
    const record = this.selectedRecords()[0] ?? {};

    return Object.keys(record)
      .filter((key) => !['id', 'password', 'password_hash', 'recovery_token'].includes(key))
      .map((key) => ({
        key,
        label: this.columnLabel(key),
        type: typeof record[key] === 'number' ? 'number' : 'text',
      }));
  }

  private makeActivity(key: string, label: string, icon: string) {
    return (this.states()[key]?.records ?? []).map((record) => {
      const time = this.pickTime(record);
      return {
        label,
        icon,
        title: this.pickTitle(record),
        subtitle: this.pickSubtitle(record),
        time,
        timeValue: time ? Date.parse(time) || 0 : 0,
      };
    });
  }

  private pickTitle(record: ApiRecord): string {
    const candidates = ['title', 'action', 'command_type', 'event_type', 'alert_type', 'status'];

    for (const candidate of candidates) {
      if (record[candidate]) {
        return this.displayValue(record[candidate]);
      }
    }

    return `Registro ${this.recordId(record) || ''}`.trim();
  }

  private pickSubtitle(record: ApiRecord): string {
    const candidates = ['message', 'result', 'severity', 'value', 'channel', 'source_ip'];

    for (const candidate of candidates) {
      if (record[candidate]) {
        return this.displayValue(record[candidate]);
      }
    }

    return this.displayValue(record['id']);
  }

  private pickTime(record: ApiRecord): string | null {
    const candidates = [
      'created_at',
      'timestamp',
      'reading_timestamp',
      'event_timestamp',
      'alert_timestamp',
      'sent_timestamp',
      'action_timestamp',
      'registration_date',
      'last_access',
    ];

    for (const candidate of candidates) {
      const value = record[candidate];

      if (typeof value === 'string') {
        return value;
      }
    }

    return null;
  }

  private extractError(error: unknown): string {
    const detail = (error as { error?: unknown; status?: number })?.error;
    const status = (error as { status?: number })?.status;

    if (status === 401) {
      return 'Sesion no autorizada. Inicia sesion nuevamente.';
    }

    if (status === 403) {
      return 'Tu rol no permite ejecutar esta accion.';
    }

    if (typeof detail === 'string') {
      return detail;
    }

    if (detail && typeof detail === 'object') {
      const first = Object.values(detail as Record<string, unknown>)[0];

      if (Array.isArray(first)) {
        return String(first[0]);
      }

      if (typeof first === 'string') {
        return first;
      }
    }

    return 'No fue posible conectar con el backend.';
  }
}
