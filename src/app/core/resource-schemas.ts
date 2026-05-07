import { CITY_OPTIONS } from './location-options';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'date'
  | 'datetime-local'
  | 'checkbox'
  | 'textarea'
  | 'select'
  | 'json';

export interface FormFieldDefinition {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  relation?: string;
  options?: string[];
  createOnly?: boolean;
  full?: boolean;
}

export const RESOURCE_FIELDS: Record<string, FormFieldDefinition[]> = {
  homes: [
    { key: 'owner', label: 'Dueno', type: 'select', relation: 'users' },
    { key: 'home_name', label: 'Nombre', type: 'text', required: true },
    { key: 'address', label: 'Direccion', type: 'text', required: true },
    {
      key: 'city',
      label: 'Ciudad',
      type: 'select',
      required: true,
      options: CITY_OPTIONS.map((option) => option.value),
    },
    { key: 'barrio', label: 'Barrio', type: 'select', required: true },
    { key: 'is_active', label: 'Activo', type: 'checkbox' },
  ],
  zones: [
    { key: 'home', label: 'Hogar', type: 'select', relation: 'homes', required: true },
    { key: 'zone_name', label: 'Zona', type: 'text', required: true },
    { key: 'description', label: 'Descripcion', type: 'textarea', full: true },
    { key: 'floor_number', label: 'Piso', type: 'number' },
  ],
  'sensor-readings': [
    { key: 'sensor', label: 'Sensor', type: 'select', relation: 'sensors', required: true },
    { key: 'value', label: 'Valor', type: 'number', required: true },
    { key: 'text_value', label: 'Valor textual', type: 'text' },
    { key: 'signal_quality', label: 'Calidad de senal', type: 'number' },
  ],
  'motion-events': [
    { key: 'sensor', label: 'Sensor', type: 'select', relation: 'sensors', required: true },
    { key: 'zone', label: 'Zona', type: 'select', relation: 'zones', required: true },
    { key: 'duration_seconds', label: 'Duracion', type: 'number' },
    { key: 'confidence_level', label: 'Confianza', type: 'number' },
    { key: 'is_processed', label: 'Procesado', type: 'checkbox' },
  ],
  'system-alerts': [
    { key: 'home', label: 'Hogar', type: 'select', relation: 'homes', required: true },
    { key: 'sensor', label: 'Sensor', type: 'select', relation: 'sensors' },
    {
      key: 'alert_type',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: ['motion', 'luminosity', 'connection', 'hardware', 'security'],
    },
    {
      key: 'severity_level',
      label: 'Severidad',
      type: 'select',
      required: true,
      options: ['low', 'medium', 'high', 'critical'],
    },
    { key: 'description', label: 'Descripcion', type: 'textarea', required: true, full: true },
    { key: 'is_resolved', label: 'Resuelta', type: 'checkbox' },
    { key: 'resolution_timestamp', label: 'Fecha resolucion', type: 'datetime-local' },
    { key: 'resolved_by', label: 'Resuelta por', type: 'select', relation: 'users' },
  ],
  nodes: [
    { key: 'zone', label: 'Zona', type: 'select', relation: 'zones', required: true },
    { key: 'node_name', label: 'Nodo', type: 'text', required: true },
    { key: 'hardware_type', label: 'Hardware', type: 'text', required: true },
    { key: 'mac_address', label: 'MAC', type: 'text', required: true },
    { key: 'local_ip', label: 'IP local', type: 'text' },
    { key: 'firmware_version', label: 'Firmware', type: 'text' },
    {
      key: 'connection_status',
      label: 'Conexion',
      type: 'select',
      options: ['connected', 'disconnected', 'error'],
    },
    { key: 'last_connection', label: 'Ultima conexion', type: 'datetime-local' },
    { key: 'installation_date', label: 'Instalacion', type: 'date', required: true },
  ],
  sensors: [
    { key: 'node', label: 'Nodo', type: 'select', relation: 'nodes', required: true },
    {
      key: 'sensor_type',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: ['LDR', 'PIR', 'DHT11', 'MQ2', 'ultrasonic', 'other'],
    },
    { key: 'sensor_name', label: 'Sensor', type: 'text', required: true },
    { key: 'gpio_pin', label: 'GPIO', type: 'text' },
    { key: 'measurement_unit', label: 'Unidad', type: 'text' },
    { key: 'minimum_threshold', label: 'Umbral minimo', type: 'number' },
    { key: 'maximum_threshold', label: 'Umbral maximo', type: 'number' },
    { key: 'is_active', label: 'Activo', type: 'checkbox' },
  ],
  actuators: [
    { key: 'node', label: 'Nodo', type: 'select', relation: 'nodes', required: true },
    {
      key: 'actuator_type',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: ['LED', 'buzzer', 'relay', 'motor', 'other'],
    },
    { key: 'actuator_name', label: 'Actuador', type: 'text', required: true },
    { key: 'gpio_pin', label: 'GPIO', type: 'text' },
    { key: 'current_status', label: 'Estado', type: 'select', options: ['on', 'off', 'error'] },
    { key: 'operation_mode', label: 'Modo', type: 'select', options: ['manual', 'automatic'] },
    { key: 'is_active', label: 'Activo', type: 'checkbox' },
  ],
  'automation-settings': [
    { key: 'home', label: 'Hogar', type: 'select', relation: 'homes', required: true },
    { key: 'rule_name', label: 'Regla', type: 'text', required: true },
    {
      key: 'condition_sensor',
      label: 'Sensor condicion',
      type: 'select',
      relation: 'sensors',
      required: true,
    },
    {
      key: 'condition_operator',
      label: 'Operador',
      type: 'select',
      required: true,
      options: ['<', '>', '=', '>=', '<='],
    },
    { key: 'condition_value', label: 'Valor condicion', type: 'number', required: true },
    {
      key: 'action_actuator',
      label: 'Actuador accion',
      type: 'select',
      relation: 'actuators',
      required: true,
    },
    { key: 'action', label: 'Accion', type: 'select', options: ['turn_on', 'turn_off', 'toggle'] },
    { key: 'is_active', label: 'Activa', type: 'checkbox' },
    { key: 'priority', label: 'Prioridad', type: 'number' },
  ],
  'lighting-statuses': [
    { key: 'actuator', label: 'Actuador', type: 'select', relation: 'actuators', required: true },
    { key: 'zone', label: 'Zona', type: 'select', relation: 'zones', required: true },
    { key: 'status', label: 'Estado', type: 'select', options: ['on', 'off', 'dimmed'] },
    { key: 'intensity_percentage', label: 'Intensidad', type: 'number' },
    {
      key: 'change_source',
      label: 'Origen',
      type: 'select',
      options: ['automatic', 'manual', 'scheduled'],
    },
    { key: 'user', label: 'Usuario', type: 'select', relation: 'users' },
  ],
  'alarm-statuses': [
    { key: 'home', label: 'Hogar', type: 'select', relation: 'homes', required: true },
    {
      key: 'status',
      label: 'Estado',
      type: 'select',
      options: ['armed', 'disarmed', 'triggered', 'silenced'],
    },
    { key: 'user', label: 'Usuario', type: 'select', relation: 'users' },
    { key: 'reason', label: 'Motivo', type: 'text' },
    { key: 'access_code_hash', label: 'Codigo acceso', type: 'password' },
  ],
  'remote-commands': [
    { key: 'user', label: 'Usuario', type: 'select', relation: 'users', required: true },
    { key: 'actuator', label: 'Actuador', type: 'select', relation: 'actuators', required: true },
    { key: 'command_type', label: 'Comando', type: 'text', required: true },
    { key: 'json_parameters', label: 'Parametros', type: 'json', full: true },
    {
      key: 'sending_channel',
      label: 'Canal',
      type: 'select',
      options: ['REST_API', 'MQTT', 'mobile_app'],
    },
    { key: 'sending_status', label: 'Estado envio', type: 'select', options: ['pending', 'sent', 'failed'] },
  ],
  'command-responses': [
    { key: 'command', label: 'Comando', type: 'select', relation: 'remote-commands', required: true },
    { key: 'was_successful', label: 'Exitosa', type: 'checkbox' },
    { key: 'response_message', label: 'Mensaje', type: 'text' },
    { key: 'resulting_actuator_status', label: 'Estado resultante', type: 'text' },
  ],
  users: [
    { key: 'full_name', label: 'Nombre completo', type: 'text', required: true },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'email', label: 'Correo', type: 'email', required: true },
    { key: 'password', label: 'Contrasena', type: 'password', required: true },
    { key: 'phone', label: 'Telefono', type: 'text' },
    { key: 'role', label: 'Rol', type: 'select', required: true, options: ['admin', 'operador', 'lector'] },
    { key: 'is_active', label: 'Activo', type: 'checkbox' },
  ],
  roles: [
    { key: 'role_name', label: 'Rol', type: 'text', required: true },
    { key: 'description', label: 'Descripcion', type: 'textarea', full: true },
    { key: 'access_level', label: 'Nivel', type: 'number', required: true },
  ],
  'user-roles': [
    { key: 'user', label: 'Usuario', type: 'select', relation: 'users', required: true },
    { key: 'role', label: 'Rol', type: 'select', relation: 'roles', required: true },
    { key: 'assigned_by', label: 'Asignado por', type: 'select', relation: 'users' },
  ],
  notifications: [
    { key: 'user', label: 'Usuario', type: 'select', relation: 'users', required: true },
    {
      key: 'notification_type',
      label: 'Tipo',
      type: 'select',
      options: ['alert', 'informative', 'system'],
    },
    { key: 'title', label: 'Titulo', type: 'text', required: true },
    { key: 'message', label: 'Mensaje', type: 'textarea', full: true },
    { key: 'channel', label: 'Canal', type: 'select', options: ['push', 'email', 'SMS', 'in_app'] },
    { key: 'is_read', label: 'Leida', type: 'checkbox' },
    { key: 'read_timestamp', label: 'Fecha lectura', type: 'datetime-local' },
  ],
  'system-audits': [
    { key: 'user', label: 'Usuario', type: 'select', relation: 'users' },
    { key: 'action', label: 'Accion', type: 'text', required: true },
    { key: 'affected_entity', label: 'Entidad', type: 'text', required: true },
    { key: 'affected_entity_id', label: 'ID entidad', type: 'number' },
    { key: 'previous_value', label: 'Valor anterior', type: 'json', full: true },
    { key: 'new_value', label: 'Valor nuevo', type: 'json', full: true },
    { key: 'source_ip', label: 'IP origen', type: 'text' },
    { key: 'result', label: 'Resultado', type: 'select', options: ['successful', 'failed'] },
  ],
};
