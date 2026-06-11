import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
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
import { barrioLabel, cityLabel, neighborhoodsForCity } from '../../core/location-options';
import { FormFieldDefinition, RESOURCE_FIELDS } from '../../core/resource-schemas';

type EditorMode = 'create' | 'edit';
type SmartSection =
  | 'home'
  | 'devices'
  | 'automations'
  | 'history'
  | 'profile'
  | 'scenes'
  | 'settings'
  | 'alerts';
type AdminSection =
  | 'home'
  | 'devices'
  | 'automations'
  | 'history'
  | 'profile'
  | 'scenes'
  | 'settings'
  | 'alerts'
  | 'users'
  | 'system';

interface SmartMenuItem {
  key: SmartSection;
  label: string;
  icon: string;
  roles: string[];
}

interface AdminMenuItem {
  key: AdminSection;
  label: string;
  icon: string;
}

interface SmartVisualItem {
  label: string;
  icon: string;
  tone: string;
  position: string;
  active: boolean;
}

type DeviceFilter = 'all' | 'security' | 'lighting' | 'other';
type HistoryFilter = 'all' | 'alerts' | 'devices' | 'automations';
type SettingsPanel = 'notifications' | 'connection' | 'language' | 'theme' | 'security' | 'about';

interface SmartDeviceCard {
  id: string | number;
  source: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: string;
  status: string;
  statusValue: string;
  detail: string;
  online: boolean;
  category: DeviceFilter;
  canToggle: boolean;
}

interface SmartHistoryEvent {
  title: string;
  subtitle: string;
  icon: string;
  tone: string;
  time: string | null;
  category: string;
  categoryKey: HistoryFilter;
  group: string;
}

interface SmartAlertCard {
  id: string | number;
  title: string;
  detail: string;
  icon: string;
  tone: string;
  time: string | null;
  zone: string;
  resolved: boolean;
}

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
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly api = inject(IotApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly titleService = inject(Title);
  private readonly doc = inject(DOCUMENT);

  readonly sidebarOpen = signal(false);

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
  readonly apiReadonlyResources = new Set<string>();
  private clockId: number | null = null;

  readonly adminSection = signal<AdminSection>('home');
  readonly systemSelectedKey = signal<string | null>(null);
  readonly adminDeviceSearch = signal('');
  readonly adminMenu: AdminMenuItem[] = [
    { key: 'home', label: 'Inicio', icon: 'pi pi-home' },
    { key: 'devices', label: 'Dispositivos', icon: 'pi pi-microchip' },
    { key: 'automations', label: 'Automatizaciones', icon: 'pi pi-sync' },
    { key: 'scenes', label: 'Escenas', icon: 'pi pi-sparkles' },
    { key: 'history', label: 'Historial', icon: 'pi pi-clock' },
    { key: 'alerts', label: 'Alertas', icon: 'pi pi-exclamation-triangle' },
    { key: 'users', label: 'Usuarios', icon: 'pi pi-users' },
    { key: 'settings', label: 'Configuracion', icon: 'pi pi-cog' },
    { key: 'system', label: 'Sistema', icon: 'pi pi-server' },
    { key: 'profile', label: 'Perfil', icon: 'pi pi-user' },
  ];

  readonly smartSection = signal<SmartSection>('home');
  readonly currentTime = signal(new Date());
  readonly smartNotice = signal<string | null>(null);
  readonly deviceFilter = signal<DeviceFilter>('all');
  readonly historyFilter = signal<HistoryFilter>('all');
  readonly selectedDevice = signal<SmartDeviceCard | null>(null);
  readonly selectedSettingsPanel = signal<SettingsPanel | null>(null);
  readonly localDeviceStatuses = signal<Record<string, string>>({});
  readonly localAutomationStates = signal<Record<string, boolean>>({});
  readonly localAlertStates = signal<Record<string, boolean>>({});
  readonly settingsState = signal({
    push: true,
    sound: true,
    vibration: false,
    wifi: true,
    language: 'Espanol',
    theme: 'Oscuro',
    biometric: false,
    pin: false,
  });
  profileEditorVisible = false;
  profileSaving = false;
  profileError = '';
  profileForm = {
    full_name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
  };
  readonly smartMenu: SmartMenuItem[] = [
    { key: 'home', label: 'Inicio', icon: 'pi pi-home', roles: ['lector', 'operador'] },
    { key: 'devices', label: 'Dispositivos', icon: 'pi pi-microchip', roles: ['lector', 'operador'] },
    { key: 'automations', label: 'Automatizaciones', icon: 'pi pi-sync', roles: ['operador'] },
    { key: 'history', label: 'Historial', icon: 'pi pi-clock', roles: ['lector', 'operador'] },
    { key: 'scenes', label: 'Escenas', icon: 'pi pi-sparkles', roles: ['operador'] },
    { key: 'alerts', label: 'Alertas', icon: 'pi pi-exclamation-triangle', roles: ['lector', 'operador'] },
    { key: 'settings', label: 'Configuracion', icon: 'pi pi-cog', roles: ['lector', 'operador'] },
    { key: 'profile', label: 'Perfil', icon: 'pi pi-user', roles: ['lector', 'operador'] },
  ];
  readonly sceneCards = [
    {
      name: 'Estoy en casa',
      detail: 'Enciende luces principales y desactiva alarma',
      icon: 'pi pi-home',
      tone: 'green',
    },
    {
      name: 'Me voy',
      detail: 'Apaga luces, arma alarma y vigila accesos',
      icon: 'pi pi-lock',
      tone: 'amber',
    },
    {
      name: 'Modo noche',
      detail: 'Atenua luces y activa sensores perimetrales',
      icon: 'pi pi-moon',
      tone: 'violet',
    },
    {
      name: 'Fiesta',
      detail: 'Activa ambiente decorativo en zonas sociales',
      icon: 'pi pi-star',
      tone: 'blue',
    },
  ];
  readonly settingsGroups = [
    {
      key: 'notifications' as const,
      label: 'Notificaciones',
      detail: 'Push, sonido y vibracion',
      icon: 'pi pi-bell',
    },
    {
      key: 'connection' as const,
      label: 'Red y conexion',
      detail: 'WiFi, intensidad y reconexion',
      icon: 'pi pi-wifi',
    },
    {
      key: 'language' as const,
      label: 'Idioma',
      detail: 'Espanol e ingles',
      icon: 'pi pi-globe',
    },
    {
      key: 'theme' as const,
      label: 'Tema',
      detail: 'Claro, oscuro y automatico',
      icon: 'pi pi-moon',
    },
    {
      key: 'security' as const,
      label: 'Seguridad',
      detail: 'Contrasena, PIN y biometria',
      icon: 'pi pi-lock',
    },
    {
      key: 'about' as const,
      label: 'Informacion',
      detail: 'Version app, soporte y estado',
      icon: 'pi pi-info-circle',
    },
  ];

  readonly visibleEndpoints = computed(() => ENDPOINTS.filter((endpoint) => this.canViewEndpoint(endpoint)));
  readonly adminSummaryCards = computed(() => [
    {
      label: 'Sistema',
      value: this.alarmLabel(this.latestAlarm()?.['status']).replace('Sistema ', '') || 'Operativo',
      detail: this.smartHeader().safe ? 'Todo seguro' : `${this.activeAlerts().length} alertas activas`,
      icon: 'pi pi-shield',
      tone: this.smartHeader().safe ? 'green' : 'red',
    },
    {
      label: 'Dispositivos',
      value: String(this.recordsFor('sensors').length + this.recordsFor('actuators').length + this.recordsFor('nodes').length),
      detail: `${this.connectedNodes().length} nodos conectados`,
      icon: 'pi pi-microchip',
      tone: 'blue',
    },
    {
      label: 'Automatizaciones',
      value: String(this.activeAutomationCount()),
      detail: `${this.recordsFor('automation-settings').length} reglas registradas`,
      icon: 'pi pi-sync',
      tone: 'violet',
    },
    {
      label: 'Alertas',
      value: String(this.activeAlerts().length),
      detail: `${this.criticalAlertCount()} criticas`,
      icon: 'pi pi-exclamation-triangle',
      tone: this.activeAlerts().length ? 'amber' : 'green',
    },
  ]);
  readonly adminVisualZones = computed<SmartVisualItem[]>(() => [
    { label: 'Patio', icon: 'pi pi-directions-run', tone: 'green', position: 'yard', active: true },
    { label: 'Entrada', icon: 'pi pi-video', tone: 'blue', position: 'entry', active: true },
    { label: 'Jardin', icon: 'pi pi-lightbulb', tone: 'amber', position: 'living', active: this.lightsOnCount() > 0 },
    { label: 'Garaje', icon: 'pi pi-car', tone: 'violet', position: 'garage', active: true },
  ]);
  readonly adminDeviceCards = computed(() => this.smartDeviceCards());
  readonly filteredAdminDeviceCards = computed(() => {
    const query = this.adminDeviceSearch().trim().toLowerCase();
    const cards = this.adminDeviceCards();

    if (!query) {
      return cards;
    }

    return cards.filter((device) =>
      [device.title, device.subtitle, device.status, device.detail, device.category].join(' ').toLowerCase().includes(query),
    );
  });
  readonly adminUsers = computed(() => this.recordsFor('users'));
  readonly adminRoles = computed(() => this.recordsFor('roles'));
  readonly adminSystemResources = computed(() =>
    ENDPOINTS.map((endpoint) => ({
      ...endpoint,
      records: this.states()[endpoint.key]?.records.length ?? 0,
      error: this.states()[endpoint.key]?.error,
    })),
  );
  readonly smartMenuItems = computed(() =>
    this.smartMenu.filter((item) => item.roles.some((role) => this.currentRoles().includes(role))),
  );
  readonly smartHomeRecord = computed(() => {
    const homes = this.recordsFor('homes');
    const userHome = this.auth.user()?.home;

    return homes.find((home) => String(home['id']) === String(userHome)) ?? homes[0] ?? null;
  });
  readonly activeAlerts = computed(() =>
    this.recordsFor('system-alerts').filter(
      (alert) => !(this.localAlertStates()[String(this.recordId(alert))] ?? this.truthy(alert['is_resolved'])),
    ),
  );
  readonly connectedNodes = computed(() =>
    this.recordsFor('nodes').filter((node) => String(node['connection_status'] ?? '').toLowerCase() === 'connected'),
  );
  readonly latestMotion = computed(() => this.latestByTime(this.recordsFor('motion-events')));
  readonly latestLighting = computed(() => this.latestByTime(this.recordsFor('lighting-statuses')));
  readonly latestAlarm = computed(() => this.latestByTime(this.recordsFor('alarm-statuses')));
  readonly lightsOnCount = computed(
    () =>
      this.recordsFor('lighting-statuses').filter((light) =>
        ['on', 'dimmed'].includes(String(light['status'] ?? '').toLowerCase()),
      ).length,
  );
  readonly activeAutomationCount = computed(
    () => this.recordsFor('automation-settings').filter((rule) => this.truthy(rule['is_active'])).length,
  );
  readonly smartHeader = computed(() => {
    const home = this.smartHomeRecord();
    const city = cityLabel(home?.['city'] ?? 'riohacha');
    const barrio = barrioLabel(home?.['barrio'] ?? '');

    return {
      homeName: this.displayValue(home?.['home_name'] || 'Casa Inteligente'),
      location: barrio ? `${barrio}, ${city}` : city,
      safe: this.activeAlerts().length === 0,
      temperature: '30C',
      weather: 'Riohacha, La Guajira',
    };
  });
  readonly smartSummaryCards = computed(() => [
    {
      label: 'Estado del sistema',
      value: this.smartHeader().safe ? 'Hogar seguro' : 'Alerta activa',
      detail: this.alarmLabel(this.latestAlarm()?.['status']),
      icon: 'pi pi-shield',
      tone: this.smartHeader().safe ? 'green' : 'red',
    },
    {
      label: 'Iluminacion',
      value: `${this.lightsOnCount()} luces`,
      detail: `${this.activeAutomationCount()} automaticas activas`,
      icon: 'pi pi-lightbulb',
      tone: 'amber',
    },
    {
      label: 'Movimiento',
      value: this.latestMotion() ? this.elapsedFrom(this.pickTime(this.latestMotion() as ApiRecord)) : 'Sin movimiento',
      detail: this.latestMotion() ? this.relatedLabel('zones', this.latestMotion()?.['zone']) : 'Zonas tranquilas',
      icon: 'pi pi-directions-run',
      tone: 'emerald',
    },
    {
      label: 'Alertas activas',
      value: String(this.activeAlerts().length),
      detail: this.connectionLabel(),
      icon: 'pi pi-bell',
      tone: this.activeAlerts().length ? 'red' : 'blue',
    },
  ]);
  readonly homeVisualItems = computed<SmartVisualItem[]>(() => [
    {
      label: 'Entrada',
      icon: 'pi pi-video',
      tone: 'blue',
      position: 'entry',
      active: true,
    },
    {
      label: 'Sala',
      icon: 'pi pi-lightbulb',
      tone: 'amber',
      position: 'living',
      active: this.lightsOnCount() > 0,
    },
    {
      label: 'Patio',
      icon: 'pi pi-directions-run',
      tone: 'green',
      position: 'yard',
      active: Boolean(this.latestMotion()),
    },
  ]);
  readonly alertBreakdown = computed(() => {
    const alerts = this.activeAlerts();
    const disconnected = this.recordsFor('nodes').filter(
      (node) => String(node['connection_status'] ?? '').toLowerCase() !== 'connected',
    ).length;

    return [
      { label: 'Movimiento', value: alerts.filter((alert) => alert['alert_type'] === 'motion').length },
      { label: 'Sensor desconectado', value: disconnected },
      { label: 'Error de conexion', value: alerts.filter((alert) => alert['alert_type'] === 'connection').length },
    ];
  });
  readonly smartDeviceCards = computed(() => this.buildDeviceCards());
  readonly filteredSmartDeviceCards = computed(() => {
    const filter = this.deviceFilter();
    const cards = this.smartDeviceCards();

    return filter === 'all' ? cards : cards.filter((device) => device.category === filter);
  });
  readonly smartAutomations = computed(() => this.buildAutomations());
  readonly smartHistory = computed(() => this.buildHistory());
  readonly filteredSmartHistory = computed(() => {
    const filter = this.historyFilter();
    const events = this.smartHistory();

    return filter === 'all' ? events : events.filter((event) => event.categoryKey === filter);
  });
  readonly emergencyAlerts = computed(() => this.buildEmergencyAlerts());
  readonly visibleGroups = computed(() =>
    this.groups.filter((group) => this.visibleEndpoints().some((endpoint) => endpoint.group === group)),
  );
  readonly orderedStates = computed(() =>
    this.visibleEndpoints().map((endpoint) => this.states()[endpoint.key]),
  );
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
    const groups = this.visibleGroups();
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

  constructor() {
    const savedTheme = localStorage.getItem('iot_theme') ?? 'dark';
    this.doc.documentElement.setAttribute('data-theme', savedTheme);
    const themeLabel = savedTheme === 'light' ? 'Claro' : savedTheme === 'auto' ? 'Automatico' : 'Oscuro';
    this.settingsState.update((s) => ({ ...s, theme: themeLabel }));

    effect(() => {
      if (this.auth.isAdmin()) {
        const label = this.adminMenu.find((m) => m.key === this.adminSection())?.label ?? 'Inicio';
        this.titleService.setTitle(`${label} — SmartHome IoT`);
      } else {
        const label = this.smartMenu.find((m) => m.key === this.smartSection())?.label ?? 'Inicio';
        this.titleService.setTitle(`${label} — SmartHome IoT`);
      }
    });
  }

  ngOnInit(): void {
    this.clockId = window.setInterval(() => this.currentTime.set(new Date()), 60000);
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.clockId) {
      window.clearInterval(this.clockId);
    }
  }

  loadAll(): void {
    this.ensureSelectedEndpoint();
    this.loadingAll.set(true);
    this.actionError.set(null);

    const loadingState = { ...this.states() };
    const visibleEndpoints = this.visibleEndpoints();
    const visibleKeys = new Set(visibleEndpoints.map((endpoint) => endpoint.key));

    for (const endpoint of ENDPOINTS) {
      loadingState[endpoint.key] = {
        ...loadingState[endpoint.key],
        records: visibleKeys.has(endpoint.key) ? loadingState[endpoint.key].records : [],
        loading: visibleKeys.has(endpoint.key),
        error: null,
      };
    }

    this.states.set(loadingState);

    if (!visibleEndpoints.length) {
      this.loadingAll.set(false);
      return;
    }

    forkJoin(
      visibleEndpoints.map((endpoint) =>
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
    this.ensureSelectedEndpoint();
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
    const endpoint = ENDPOINTS.find((item) => item.key === key);

    if (!endpoint || !this.canViewEndpoint(endpoint)) {
      return;
    }

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

  fieldOptions(field: FormFieldDefinition): string[] {
    if (field.key === 'barrio') {
      return neighborhoodsForCity(String(this.editorForm['city'] || 'riohacha')).map(
        (option) => option.value,
      );
    }

    return field.options ?? [];
  }

  optionLabel(field: FormFieldDefinition, value: string): string {
    if (field.key === 'city') {
      return cityLabel(value);
    }

    if (field.key === 'barrio') {
      return barrioLabel(value);
    }

    return value;
  }

  onFormFieldChange(field: FormFieldDefinition): void {
    if (field.key !== 'city') {
      return;
    }

    const barrios = neighborhoodsForCity(String(this.editorForm['city']));

    if (!barrios.some((option) => option.value === this.editorForm['barrio'])) {
      this.editorForm['barrio'] = barrios[0]?.value ?? '';
    }
  }

  canMutateSelected(): boolean {
    return this.auth.isAdmin() && !this.apiReadonlyResources.has(this.selectedKey());
  }

  canViewEndpoint(endpoint: EndpointDefinition): boolean {
    if (this.auth.isAdmin()) {
      return true;
    }

    const userRoles = this.currentRoles();
    return endpoint.allowedRoles.some((role) => userRoles.includes(role.toLowerCase()));
  }

  currentRoleLabel(): string {
    if (this.auth.isAdmin()) {
      return 'Admin';
    }

    const roles = this.currentRoles();

    if (roles.includes('operador')) {
      return 'Operador';
    }

    if (roles.includes('lector')) {
      return 'Lector';
    }

    return 'Sin rol';
  }

  selectAdminSection(section: AdminSection): void {
    this.adminSection.set(section);
    this.smartNotice.set(null);
  }

  adminSectionTitle(): string {
    return this.adminMenu.find((item) => item.key === this.adminSection())?.label ?? 'Inicio';
  }

  openAdminCreate(endpointKey: string): void {
    const endpoint = this.endpointByKey(endpointKey);

    if (!endpoint) {
      this.smartNotice.set('Recurso no disponible.');
      return;
    }

    this.selectedKey.set(endpoint.key);
    this.openCreate();
  }

  openAdminEdit(endpointKey: string, record: ApiRecord): void {
    const endpoint = this.endpointByKey(endpointKey);

    if (!endpoint) {
      this.smartNotice.set('Recurso no disponible.');
      return;
    }

    this.selectedKey.set(endpoint.key);
    this.openEdit(record);
  }

  deleteAdminRecord(endpointKey: string, record: ApiRecord): void {
    const endpoint = this.endpointByKey(endpointKey);
    const id = this.recordId(record);

    if (!endpoint || !id) {
      this.smartNotice.set('No se pudo identificar el registro.');
      return;
    }

    if (!window.confirm('Eliminar este registro de forma permanente?')) {
      return;
    }

    this.api.remove(endpoint, id).subscribe({
      next: () => {
        this.patchState(endpoint.key, {
          records: this.recordsFor(endpoint.key).filter((item) => String(item['id']) !== String(id)),
        });
        this.smartNotice.set('Registro eliminado.');
      },
      error: (error) => this.smartNotice.set(this.extractError(error)),
    });
  }

  openDeviceEditor(device: SmartDeviceCard): void {
    const endpointKey = device.source === 'actuators' ? 'actuators' : device.source === 'sensors' ? 'sensors' : 'nodes';
    const record = this.recordsFor(endpointKey).find((item) => String(item['id']) === String(device.id));

    if (!record) {
      this.openDeviceDetails(device);
      return;
    }

    this.openAdminEdit(endpointKey, record);
  }

  deleteDevice(device: SmartDeviceCard): void {
    const endpointKey = device.source === 'actuators' ? 'actuators' : device.source === 'sensors' ? 'sensors' : 'nodes';
    const record = this.recordsFor(endpointKey).find((item) => String(item['id']) === String(device.id));

    if (!record) {
      this.smartNotice.set('Este dispositivo de demostracion no existe en la base de datos.');
      return;
    }

    this.deleteAdminRecord(endpointKey, record);
  }

  runAdminAction(action: string): void {
    this.smartNotice.set(`${action} solicitado correctamente.`);
  }

  toggleSystemResource(key: string): void {
    this.systemSelectedKey.set(this.systemSelectedKey() === key ? null : key);
  }

  criticalAlertCount(): number {
    return this.activeAlerts().filter((alert) =>
      ['critical', 'high'].includes(String(alert['severity_level'] ?? '').toLowerCase()),
    ).length;
  }

  selectSmartSection(section: SmartSection): void {
    if (!this.smartMenuItems().some((item) => item.key === section)) {
      this.smartNotice.set('Tu rol solo permite visualizar modulos autorizados.');
      return;
    }

    this.smartSection.set(section);
    this.smartNotice.set(null);
  }

  runSmartAction(action: string): void {
    if (!this.currentRoles().includes('operador') && !this.auth.isAdmin()) {
      this.smartNotice.set('Tu rol lector solo permite visualizar el sistema.');
      return;
    }

    this.smartNotice.set(`${action} solicitado correctamente.`);
  }

  selectDeviceFilter(filter: DeviceFilter): void {
    this.deviceFilter.set(filter);
  }

  selectHistoryFilter(filter: HistoryFilter): void {
    this.historyFilter.set(filter);
  }

  openDeviceDetails(device: SmartDeviceCard): void {
    this.selectedDevice.set(device);
  }

  closeDeviceDetails(): void {
    this.selectedDevice.set(null);
  }

  toggleDevice(device: SmartDeviceCard): void {
    if (!device.canToggle) {
      this.smartNotice.set('Este dispositivo solo permite ver detalles desde el panel.');
      return;
    }

    if (!this.currentRoles().includes('operador') && !this.auth.isAdmin()) {
      this.smartNotice.set('Tu rol lector puede ver dispositivos, pero no cambiar su estado.');
      return;
    }

    const nextStatus = device.statusValue === 'on' ? 'off' : 'on';

    this.persistOrStoreDeviceStatus(device, nextStatus, `${device.title} ${nextStatus === 'on' ? 'encendido' : 'apagado'}.`);
  }

  restartDevice(device: SmartDeviceCard): void {
    if (!this.currentRoles().includes('operador') && !this.auth.isAdmin()) {
      this.smartNotice.set('Tu rol lector no permite reiniciar dispositivos.');
      return;
    }

    this.smartNotice.set(`Reinicio solicitado para ${device.title}.`);
  }

  toggleAutomation(rule: { id?: string | number; active: boolean; title: string }): void {
    if (!this.currentRoles().includes('operador') && !this.auth.isAdmin()) {
      this.smartNotice.set('Tu rol lector no permite cambiar automatizaciones.');
      return;
    }

    const nextActive = !rule.active;

    if (rule.id) {
      const endpoint = this.endpointByKey('automation-settings');

      if (endpoint) {
        this.api.patch(endpoint, rule.id, { is_active: nextActive }).subscribe({
          next: (record) => {
            this.replaceRecord('automation-settings', rule.id as string | number, record);
            this.smartNotice.set(`${rule.title} ${nextActive ? 'activada' : 'desactivada'}.`);
          },
          error: (error) => this.smartNotice.set(this.extractError(error)),
        });
        return;
      }
    }

    this.localAutomationStates.set({
      ...this.localAutomationStates(),
      [rule.title]: nextActive,
    });
    this.smartNotice.set(`${rule.title} ${nextActive ? 'activada' : 'desactivada'}.`);
  }

  markAlertRead(alert: SmartAlertCard): void {
    if (alert.resolved) {
      this.smartNotice.set('Esta alerta ya esta marcada como leida.');
      return;
    }

    const endpoint = this.endpointByKey('system-alerts');

    if (endpoint && !String(alert.id).startsWith('local')) {
      this.api
        .patch(endpoint, alert.id, {
          is_resolved: true,
          resolution_timestamp: new Date().toISOString(),
        })
        .subscribe({
          next: (record) => {
            this.replaceRecord('system-alerts', alert.id, record);
            this.smartNotice.set('Alerta marcada como leida.');
          },
          error: (error) => this.smartNotice.set(this.extractError(error)),
        });
      return;
    }

    this.localAlertStates.set({
      ...this.localAlertStates(),
      [String(alert.id)]: true,
    });
    this.smartNotice.set('Alerta marcada como leida.');
  }

  markAllAlertsRead(): void {
    const pending = this.emergencyAlerts().filter((alert) => !alert.resolved);

    if (!pending.length) {
      this.smartNotice.set('No hay alertas pendientes.');
      return;
    }

    for (const alert of pending) {
      this.markAlertRead(alert);
    }
  }

  openProfileEditor(): void {
    const user = this.auth.user();

    this.profileForm = {
      full_name: user?.full_name ?? '',
      username: user?.username ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      password: '',
    };
    this.profileError = '';
    this.profileEditorVisible = true;
  }

  saveProfile(): void {
    this.profileError = '';
    const payload: Record<string, string> = {
      full_name: this.profileForm.full_name.trim(),
      username: this.profileForm.username.trim(),
      email: this.profileForm.email.trim(),
      phone: this.profileForm.phone.trim(),
    };

    if (this.profileForm.password.trim()) {
      payload['password'] = this.profileForm.password;
    }

    this.profileSaving = true;
    this.auth
      .updateProfile(payload)
      .pipe(finalize(() => (this.profileSaving = false)))
      .subscribe({
        next: () => {
          this.profileEditorVisible = false;
          this.smartNotice.set('Perfil actualizado correctamente.');
        },
        error: (error) => {
          this.profileError = this.extractError(error);
        },
      });
  }

  openSettingsPanel(panel: SettingsPanel): void {
    this.selectedSettingsPanel.set(panel);
  }

  toggleSetting(key: 'push' | 'sound' | 'vibration' | 'wifi' | 'biometric' | 'pin'): void {
    this.settingsState.set({
      ...this.settingsState(),
      [key]: !this.settingsState()[key],
    });
    this.smartNotice.set('Configuracion actualizada.');
  }

  setSettingValue(key: 'language' | 'theme', value: string): void {
    this.settingsState.set({ ...this.settingsState(), [key]: value });

    if (key === 'theme') {
      const map: Record<string, string> = { Oscuro: 'dark', Claro: 'light', Automatico: 'auto' };
      const themeKey = map[value] ?? 'dark';
      this.doc.documentElement.setAttribute('data-theme', themeKey);
      localStorage.setItem('iot_theme', themeKey);
    }

    if (key === 'language') {
      localStorage.setItem('iot_lang', value === 'Ingles' ? 'en' : 'es');
    }

    this.smartNotice.set('Configuracion actualizada.');
  }

  reconnectDevices(): void {
    this.smartNotice.set('Reconectando dispositivos cercanos...');
    this.loadAll();
  }

  setAllLights(status: 'on' | 'off'): void {
    const lights = this.smartDeviceCards().filter((device) => device.category === 'lighting' && device.canToggle);

    if (!lights.length) {
      this.smartNotice.set('No hay luces disponibles para controlar.');
      return;
    }

    for (const light of lights) {
      this.persistOrStoreDeviceStatus(light, status, '');
    }

    this.smartNotice.set(status === 'on' ? 'Luces encendidas.' : 'Luces apagadas.');
  }

  setAlarm(status: 'armed' | 'disarmed'): void {
    if (!this.currentRoles().includes('operador') && !this.auth.isAdmin()) {
      this.smartNotice.set('Tu rol lector no permite cambiar la alarma.');
      return;
    }

    const alarm = this.latestAlarm();
    const endpoint = this.endpointByKey('alarm-statuses');

    if (alarm && endpoint) {
      this.api
        .patch(endpoint, this.recordId(alarm), {
          status,
          reason: status === 'armed' ? 'Activacion desde panel de usuario' : 'Desactivacion desde panel de usuario',
          user: this.auth.user()?.id ?? null,
        })
        .subscribe({
          next: (record) => {
            this.replaceRecord('alarm-statuses', this.recordId(alarm), record);
            this.smartNotice.set(status === 'armed' ? 'Alarma activada.' : 'Alarma desactivada.');
          },
          error: (error) => this.smartNotice.set(this.extractError(error)),
        });
      return;
    }

    this.smartNotice.set(status === 'armed' ? 'Alarma activada.' : 'Alarma desactivada.');
  }

  smartSectionTitle(): string {
    return this.smartMenu.find((item) => item.key === this.smartSection())?.label ?? 'Inicio';
  }

  connectionLabel(): string {
    const total = this.recordsFor('nodes').length;

    if (!total) {
      return 'Conexion pendiente';
    }

    return `${this.connectedNodes().length}/${total} nodos en linea`;
  }

  elapsedFrom(value: unknown): string {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      return 'Sin fecha';
    }

    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));

    if (minutes < 1) {
      return 'Ahora';
    }

    if (minutes < 60) {
      return `Hace ${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `Hace ${hours} h`;
    }

    return `Hace ${Math.floor(hours / 24)} d`;
  }

  alarmLabel(value: unknown): string {
    const status = String(value ?? '').toLowerCase();
    const labels: Record<string, string> = {
      armed: 'Sistema armado',
      disarmed: 'Sistema desarmado',
      triggered: 'Alarma activada',
      silenced: 'Alarma silenciada',
    };

    return labels[status] ?? 'Sin estado de alarma';
  }

  eventGroupLabel(group: string): string {
    const labels: Record<string, string> = {
      today: 'Hoy',
      yesterday: 'Ayer',
      week: 'Esta semana',
    };

    return labels[group] ?? group;
  }

  homeMemberCount(): number {
    return Math.max(1, this.recordsFor('users').length);
  }

  displayCell(record: ApiRecord, column: string): string {
    const field = this.fieldForColumn(column);

    if (field?.relation) {
      return this.relatedLabel(field.relation, record[column]);
    }

    if (field?.type === 'select') {
      return this.optionLabel(field, String(record[column] ?? ''));
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

  resolveColumns(records: ApiRecord[]): string[] {
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
      if (!value) {
        return 'Sin asignar';
      }

      return endpointKey === 'users' ? 'Usuario asignado' : 'Objeto relacionado';
    }

    return this.objectLabel(endpointKey, record);
  }

  objectLabel(endpointKey: string, record: ApiRecord): string {
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
      } else if (field.key === 'barrio') {
        form[field.key] = neighborhoodsForCity(String(form['city'] || 'riohacha'))[0]?.value ?? '';
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

  recordsFor(key: string): ApiRecord[] {
    return this.states()[key]?.records ?? [];
  }

  private truthy(value: unknown): boolean {
    return value === true || String(value).toLowerCase() === 'true' || value === 1 || value === '1';
  }

  private latestByTime(records: ApiRecord[]): ApiRecord | null {
    return (
      [...records].sort((a, b) => {
        const first = this.pickTime(a);
        const second = this.pickTime(b);

        return (Date.parse(second ?? '') || 0) - (Date.parse(first ?? '') || 0);
      })[0] ?? null
    );
  }

  private latestSensorReading(sensorId: unknown): ApiRecord | null {
    const readings = this.recordsFor('sensor-readings').filter(
      (reading) => String(reading['sensor']) === String(sensorId),
    );

    return this.latestByTime(readings);
  }

  private buildDeviceCards(): SmartDeviceCard[] {
    const actuatorCards = this.recordsFor('actuators').map((actuator) => {
      const id = this.recordId(actuator);
      const status = this.localDeviceStatuses()[`actuators:${id}`] ?? String(actuator['current_status'] ?? 'off').toLowerCase();
      const category = this.deviceCategory(actuator['actuator_type']);
      return {
        id,
        source: 'actuators',
        title: this.displayValue(actuator['actuator_name'] || 'Actuador'),
        subtitle: this.displayValue(actuator['actuator_type'] || 'Dispositivo'),
        icon: this.deviceIcon(actuator['actuator_type']),
        tone: status === 'on' ? 'amber' : 'slate',
        status: status === 'on' ? 'Encendido' : status === 'error' ? 'Error' : 'Apagado',
        statusValue: status,
        detail: this.displayValue(actuator['operation_mode'] || 'Manual'),
        online: status !== 'error',
        category,
        canToggle: category === 'lighting' || category === 'security' || category === 'other',
      };
    });
    const sensorCards = this.recordsFor('sensors').map((sensor) => {
      const sensorId = this.recordId(sensor);
      const sensorType = String(sensor['sensor_type'] ?? '').toUpperCase();
      const reading = this.latestSensorReading(sensorId);
      const isActive = this.truthy(sensor['is_active']);

      let status = isActive ? 'Activo' : 'Inactivo';
      let statusValue = isActive ? 'on' : 'off';
      let tone = isActive ? 'green' : 'slate';
      let detail = sensor['measurement_unit'] ? `Unidad ${this.displayValue(sensor['measurement_unit'])}` : 'Monitoreo';

      if (reading && isActive) {
        if (sensorType === 'PIR') {
          const detected = String(reading['text_value'] ?? '') === 'movimiento_detectado';
          status = detected ? 'Movimiento detectado' : 'Sin movimiento';
          statusValue = detected ? 'on' : 'off';
          tone = detected ? 'amber' : 'green';
        } else if (sensorType === 'LDR') {
          const dark = String(reading['text_value'] ?? '') === 'oscuro';
          status = dark ? 'Oscuro' : 'Con luz';
          statusValue = dark ? 'on' : 'off';
          tone = dark ? 'violet' : 'yellow';
        }

        const time = this.pickTime(reading);
        detail = time ? `Ultima lectura ${this.elapsedFrom(time)}` : detail;
      }

      return {
        id: sensorId,
        source: 'sensors',
        title: this.displayValue(sensor['sensor_name'] || 'Sensor'),
        subtitle: this.displayValue(sensor['sensor_type'] || 'Sensor IoT'),
        icon: this.deviceIcon(sensor['sensor_type']),
        tone,
        status,
        statusValue,
        detail,
        online: isActive,
        category: this.deviceCategory(sensor['sensor_type']),
        canToggle: false,
      };
    });
    const nodeCards = this.recordsFor('nodes').map((node) => ({
      id: this.recordId(node),
      source: 'nodes',
      title: this.displayValue(node['node_name'] || 'Nodo IoT'),
      subtitle: this.displayValue(node['hardware_type'] || 'Controlador'),
      icon: 'pi pi-wifi',
      tone: String(node['connection_status'] ?? '').toLowerCase() === 'connected' ? 'blue' : 'red',
      status: this.displayValue(node['connection_status'] || 'Sin estado'),
      statusValue: String(node['connection_status'] ?? '').toLowerCase(),
      detail: this.displayValue(node['local_ip'] || node['mac_address']),
      online: String(node['connection_status'] ?? '').toLowerCase() === 'connected',
      category: 'other' as DeviceFilter,
      canToggle: false,
    }));
    const cards = [...actuatorCards, ...sensorCards, ...nodeCards];

    if (cards.length) {
      const hasLdrSensor = this.recordsFor('sensors').some(
        (s) => String(s['sensor_type']).toUpperCase() === 'LDR',
      );

      if (!hasLdrSensor) {
        const ldrCard: SmartDeviceCard = {
          id: 'local-ldr',
          source: 'local',
          title: 'Sensor LDR',
          subtitle: 'Exterior',
          icon: 'pi pi-sun',
          tone: 'yellow',
          status: 'Detectando luminosidad',
          statusValue: 'on',
          detail: 'Monitoreo de luz ambiente',
          online: true,
          category: 'lighting',
          canToggle: false,
        };
        return [...cards, ldrCard].slice(0, 12);
      }

      return cards.slice(0, 12);
    }

    const localLightStatus = this.localDeviceStatuses()['local:local-light'] ?? 'on';
    const localAlarmStatus = this.localDeviceStatuses()['local:local-alarm'] ?? 'off';

    return [
      {
        id: 'local-light',
        source: 'local',
        title: 'Luz Exterior',
        subtitle: 'Entrada principal',
        icon: 'pi pi-lightbulb',
        tone: localLightStatus === 'on' ? 'amber' : 'slate',
        status: localLightStatus === 'on' ? 'Encendida' : 'Apagada',
        statusValue: localLightStatus,
        detail: 'Manual',
        online: true,
        category: 'lighting',
        canToggle: true,
      },
      {
        id: 'local-pir',
        source: 'local',
        title: 'Sensor PIR',
        subtitle: 'Patio delantero',
        icon: 'pi pi-directions-run',
        tone: 'green',
        status: 'Activo',
        statusValue: 'on',
        detail: 'Ultima deteccion reciente',
        online: true,
        category: 'security',
        canToggle: false,
      },
      {
        id: 'local-ldr',
        source: 'local',
        title: 'Sensor LDR',
        subtitle: 'Exterior',
        icon: 'pi pi-sun',
        tone: 'yellow',
        status: 'Detectando oscuridad',
        statusValue: 'on',
        detail: 'Luminosidad baja',
        online: true,
        category: 'lighting',
        canToggle: false,
      },
      {
        id: 'local-alarm',
        source: 'local',
        title: 'Alarma',
        subtitle: 'Sistema principal',
        icon: 'pi pi-shield',
        tone: localAlarmStatus === 'on' ? 'red' : 'slate',
        status: localAlarmStatus === 'on' ? 'Activada' : 'Desactivada',
        statusValue: localAlarmStatus,
        detail: 'Intensidad sonora normal',
        online: true,
        category: 'security',
        canToggle: true,
      },
    ];
  }

  private buildAutomations() {
    const rules = this.recordsFor('automation-settings').map((rule) => ({
      id: this.recordId(rule),
      title: this.displayValue(rule['rule_name'] || 'Automatizacion'),
      detail: `${this.relatedLabel('sensors', rule['condition_sensor'])} ${this.displayValue(
        rule['condition_operator'],
      )} ${this.displayValue(rule['condition_value'])}`,
      icon: 'pi pi-sync',
      active: this.localAutomationStates()[String(this.recordId(rule))] ?? this.truthy(rule['is_active']),
      priority: this.displayValue(rule['priority'] ?? 'Media'),
      schedule: 'Ejecucion automatica',
    }));

    if (rules.length) {
      return rules;
    }

    return [
      {
        id: undefined,
        title: 'Luz exterior automatica',
        detail: 'Encender luz exterior cuando haya oscuridad y movimiento',
        icon: 'pi pi-lightbulb',
        active: this.localAutomationStates()['Luz exterior automatica'] ?? true,
        priority: 'Alta',
        schedule: 'Anochecer y amanecer',
      },
      {
        id: undefined,
        title: 'Modo noche',
        detail: 'Activarse a las 11 PM y encender luces exteriores',
        icon: 'pi pi-moon',
        active: this.localAutomationStates()['Modo noche'] ?? true,
        priority: 'Media',
        schedule: '11:00 PM',
      },
      {
        id: undefined,
        title: 'Activacion de alarma',
        detail: 'Si hay movimiento entre 12 AM y 5 AM, activar alarma y notificar',
        icon: 'pi pi-shield',
        active: this.localAutomationStates()['Activacion de alarma'] ?? false,
        priority: 'Critica',
        schedule: '12:00 AM - 5:00 AM',
      },
    ];
  }

  private buildHistory(): SmartHistoryEvent[] {
    const events = [
      ...this.recordsFor('motion-events').map((record) => ({
        title: 'Movimiento detectado',
        subtitle: this.relatedLabel('zones', record['zone']),
        icon: 'pi pi-directions-run',
        tone: 'green',
        time: this.pickTime(record),
        category: 'Seguridad',
        categoryKey: 'devices' as HistoryFilter,
      })),
      ...this.recordsFor('lighting-statuses').map((record) => ({
        title: String(record['status']).toLowerCase() === 'off' ? 'Luz apagada' : 'Luz encendida',
        subtitle: this.relatedLabel('zones', record['zone']),
        icon: 'pi pi-lightbulb',
        tone: 'amber',
        time: this.pickTime(record),
        category: 'Iluminacion',
        categoryKey: 'devices' as HistoryFilter,
      })),
      ...this.recordsFor('alarm-statuses').map((record) => ({
        title: this.alarmLabel(record['status']),
        subtitle: this.displayValue(record['reason'] || 'Sistema de alarma'),
        icon: 'pi pi-shield',
        tone: 'red',
        time: this.pickTime(record),
        category: 'Seguridad',
        categoryKey: 'alerts' as HistoryFilter,
      })),
      ...this.recordsFor('system-alerts').map((record) => ({
        title: this.displayValue(record['alert_type'] || 'Alerta'),
        subtitle: this.displayValue(record['description'] || record['severity_level']),
        icon: 'pi pi-exclamation-triangle',
        tone: this.alertTone(record),
        time: this.pickTime(record),
        category: 'Alertas',
        categoryKey: 'alerts' as HistoryFilter,
      })),
      ...this.recordsFor('automation-settings').map((record) => ({
        title: this.displayValue(record['rule_name'] || 'Automatizacion'),
        subtitle: this.truthy(record['is_active']) ? 'Regla activa' : 'Regla inactiva',
        icon: 'pi pi-sync',
        tone: this.truthy(record['is_active']) ? 'blue' : 'slate',
        time: null,
        category: 'Automatizaciones',
        categoryKey: 'automations' as HistoryFilter,
      })),
    ].sort((a, b) => (Date.parse(b.time ?? '') || 0) - (Date.parse(a.time ?? '') || 0));

    const fallback = [
      {
        title: 'Movimiento detectado',
        subtitle: 'Patio delantero',
        icon: 'pi pi-directions-run',
        tone: 'green',
        time: new Date().toISOString(),
        category: 'Seguridad',
        categoryKey: 'devices' as HistoryFilter,
      },
      {
        title: 'Luz exterior encendida',
        subtitle: 'Automatico',
        icon: 'pi pi-lightbulb',
        tone: 'amber',
        time: new Date(Date.now() - 120000).toISOString(),
        category: 'Iluminacion',
        categoryKey: 'devices' as HistoryFilter,
      },
      {
        title: 'Modo noche activado',
        subtitle: 'Automatico',
        icon: 'pi pi-moon',
        tone: 'blue',
        time: new Date(Date.now() - 86400000).toISOString(),
        category: 'Automatizaciones',
        categoryKey: 'automations' as HistoryFilter,
      },
    ];

    return (events.length ? events : fallback).slice(0, 12).map((event) => ({
      ...event,
      group: this.eventGroup(event.time),
    }));
  }

  private buildEmergencyAlerts(): SmartAlertCard[] {
    const alerts = this.recordsFor('system-alerts').map((alert) => ({
      id: this.recordId(alert),
      title: this.displayValue(alert['alert_type'] || 'Alerta'),
      detail: this.displayValue(alert['description'] || alert['severity_level']),
      icon: 'pi pi-exclamation-triangle',
      tone: this.alertTone(alert),
      time: this.pickTime(alert),
      zone: this.relatedLabel('homes', alert['home']),
      resolved: this.localAlertStates()[String(this.recordId(alert))] ?? this.truthy(alert['is_resolved']),
    }));

    if (alerts.length) {
      return alerts;
    }

    return [
      {
        id: 'local-motion',
        title: 'Movimiento detectado',
        detail: 'Entrada principal',
        icon: 'pi pi-directions-run',
        tone: 'red',
        time: new Date().toISOString(),
        zone: 'Entrada',
        resolved: this.localAlertStates()['local-motion'] ?? false,
      },
      {
        id: 'local-light',
        title: 'Luz exterior encendida',
        detail: 'Automatico',
        icon: 'pi pi-lightbulb',
        tone: 'amber',
        time: new Date(Date.now() - 120000).toISOString(),
        zone: 'Patio',
        resolved: this.localAlertStates()['local-light'] ?? true,
      },
    ];
  }

  private eventGroup(value: string | null): string {
    const date = value ? new Date(value) : new Date();
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startYesterday = startToday - 86400000;
    const time = date.getTime();

    if (time >= startToday) {
      return 'today';
    }

    if (time >= startYesterday) {
      return 'yesterday';
    }

    return 'week';
  }

  private alertTone(record: ApiRecord): string {
    if (this.truthy(record['is_resolved'])) {
      return 'green';
    }

    const severity = String(record['severity_level'] ?? '').toLowerCase();
    return ['critical', 'high'].includes(severity) ? 'red' : 'amber';
  }

  private deviceIcon(value: unknown): string {
    const text = String(value ?? '').toLowerCase();

    if (text.includes('ldr') || text.includes('light') || text.includes('led')) {
      return 'pi pi-lightbulb';
    }

    if (text.includes('pir') || text.includes('motion')) {
      return 'pi pi-directions-run';
    }

    if (text.includes('buzzer') || text.includes('alarm')) {
      return 'pi pi-shield';
    }

    return 'pi pi-microchip';
  }

  private deviceCategory(value: unknown): DeviceFilter {
    const text = String(value ?? '').toLowerCase();

    if (text.includes('led') || text.includes('ldr') || text.includes('light') || text.includes('luz')) {
      return 'lighting';
    }

    if (
      text.includes('pir') ||
      text.includes('motion') ||
      text.includes('alarm') ||
      text.includes('buzzer') ||
      text.includes('mq2')
    ) {
      return 'security';
    }

    return 'other';
  }

  endpointByKey(key: string): EndpointDefinition | undefined {
    return ENDPOINTS.find((endpoint) => endpoint.key === key);
  }

  private replaceRecord(endpointKey: string, id: string | number, record: ApiRecord): void {
    const state = this.states()[endpointKey];

    if (!state) {
      return;
    }

    this.patchState(endpointKey, {
      records: state.records.map((item) => (String(item['id']) === String(id) ? record : item)),
    });
  }

  private persistOrStoreDeviceStatus(device: SmartDeviceCard, status: string, successMessage: string): void {
    const key = `${device.source}:${device.id}`;

    if (device.source === 'actuators') {
      const endpoint = this.endpointByKey('actuators');

      if (endpoint) {
        this.api.patch(endpoint, device.id, { current_status: status }).subscribe({
          next: (record) => {
            this.replaceRecord('actuators', device.id, record);
            this.smartNotice.set(successMessage || `${device.title} actualizado.`);
          },
          error: (error) => this.smartNotice.set(this.extractError(error)),
        });
        return;
      }
    }

    this.localDeviceStatuses.set({
      ...this.localDeviceStatuses(),
      [key]: status,
    });

    if (successMessage) {
      this.smartNotice.set(successMessage);
    }
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

  private ensureSelectedEndpoint(): void {
    if (this.visibleEndpoints().some((endpoint) => endpoint.key === this.selectedKey())) {
      return;
    }

    const firstEndpoint = this.visibleEndpoints()[0];

    if (firstEndpoint) {
      this.selectedKey.set(firstEndpoint.key);
    }
  }

  private currentRoles(): string[] {
    return this.auth.user()?.roles?.map((role) => role.toLowerCase()) ?? [];
  }
}
