export type ApiRecord = Record<string, unknown>;

export interface AppUser {
  id: number;
  home: number;
  full_name: string;
  username: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  registration_date?: string;
  last_access?: string | null;
  roles: string[];
}

export interface LoginPayload {
  username?: string;
  email?: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AppUser;
}

export interface EndpointDefinition {
  key: string;
  label: string;
  group: 'core' | 'devices' | 'automation' | 'users';
  path: string;
  icon: string;
  accent: string;
  description: string;
  allowedRoles: string[];
}

export interface EndpointState {
  definition: EndpointDefinition;
  records: ApiRecord[];
  loading: boolean;
  error: string | null;
}

export interface MetricCard {
  label: string;
  value: number;
  icon: string;
  tone: string;
  hint: string;
}
