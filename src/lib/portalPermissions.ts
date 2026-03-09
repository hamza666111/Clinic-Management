import { UserRole } from './types';

export type PermissionKey =
  | 'view_dashboard'
  | 'manage_patients'
  | 'manage_appointments'
  | 'manage_prescriptions'
  | 'manage_billing'
  | 'manage_services'
  | 'manage_medicines'
  | 'manage_users'
  | 'manage_staff_roles'
  | 'manage_clinics'
  | 'view_revenue';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  desc: string;
  sidebarPath?: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'view_dashboard',
    label: 'Dashboard',
    desc: 'Can open dashboard and summary widgets',
    sidebarPath: '/portal',
  },
  {
    key: 'manage_patients',
    label: 'Patients',
    desc: 'Can view patient records from the sidebar page',
    sidebarPath: '/portal/patients',
  },
  {
    key: 'manage_appointments',
    label: 'Appointments',
    desc: 'Can view and manage appointments page',
    sidebarPath: '/portal/appointments',
  },
  {
    key: 'manage_prescriptions',
    label: 'Prescriptions',
    desc: 'Can open prescriptions page',
    sidebarPath: '/portal/prescriptions',
  },
  {
    key: 'manage_billing',
    label: 'Billing',
    desc: 'Can open billing and invoices page',
    sidebarPath: '/portal/billing',
  },
  {
    key: 'manage_services',
    label: 'Services',
    desc: 'Can open services page',
    sidebarPath: '/portal/services',
  },
  {
    key: 'manage_medicines',
    label: 'Medicines',
    desc: 'Can open medicines page',
    sidebarPath: '/portal/medicines',
  },
  {
    key: 'manage_users',
    label: 'Users',
    desc: 'Can open user management page',
    sidebarPath: '/portal/users',
  },
  {
    key: 'manage_staff_roles',
    label: 'Staff Roles',
    desc: 'Can open team and roles permissions page',
    sidebarPath: '/portal/staff-roles',
  },
  {
    key: 'manage_clinics',
    label: 'Clinics',
    desc: 'Can open clinics page',
    sidebarPath: '/portal/clinics',
  },
  {
    key: 'view_revenue',
    label: 'Revenue Widget',
    desc: 'Can see revenue cards and charts on dashboard',
  },
];

export const SIDEBAR_PERMISSIONS = PERMISSION_DEFINITIONS.filter((item) => Boolean(item.sidebarPath));

export const PERMISSION_KEYS: PermissionKey[] = PERMISSION_DEFINITIONS.map((item) => item.key);

export const LEGACY_PERMISSION_KEY_MAP: Record<PermissionKey, string[]> = {
  view_dashboard: ['view_dashboard', 'dashboard'],
  manage_patients: ['manage_patients', 'patients'],
  manage_appointments: ['manage_appointments', 'appointments'],
  manage_prescriptions: ['manage_prescriptions', 'prescriptions'],
  manage_billing: ['manage_billing', 'billing', 'invoices'],
  manage_services: ['manage_services', 'services'],
  manage_medicines: ['manage_medicines', 'medicines'],
  manage_users: ['manage_users', 'users', 'manage_staff', 'staff', 'staff_management'],
  manage_staff_roles: ['manage_staff_roles', 'staff_roles', 'roles_permissions', 'roles_and_permissions', 'manage_staff'],
  manage_clinics: ['manage_clinics', 'clinics'],
  view_revenue: ['view_revenue', 'revenue', 'can_view_total_revenue'],
};

const EMPTY_PERMISSIONS: Record<PermissionKey, boolean> = {
  view_dashboard: false,
  manage_patients: false,
  manage_appointments: false,
  manage_prescriptions: false,
  manage_billing: false,
  manage_services: false,
  manage_medicines: false,
  manage_users: false,
  manage_staff_roles: false,
  manage_clinics: false,
  view_revenue: false,
};

const DEFAULT_ROLE_PERMISSION_MAP: Record<UserRole, Record<PermissionKey, boolean>> = {
  admin: {
    view_dashboard: true,
    manage_patients: true,
    manage_appointments: true,
    manage_prescriptions: true,
    manage_billing: true,
    manage_services: true,
    manage_medicines: true,
    manage_users: true,
    manage_staff_roles: true,
    manage_clinics: true,
    view_revenue: true,
  },
  clinic_admin: {
    view_dashboard: true,
    manage_patients: true,
    manage_appointments: true,
    manage_prescriptions: true,
    manage_billing: true,
    manage_services: true,
    manage_medicines: true,
    manage_users: true,
    manage_staff_roles: true,
    manage_clinics: false,
    view_revenue: true,
  },
  doctor: {
    view_dashboard: true,
    manage_patients: true,
    manage_appointments: true,
    manage_prescriptions: true,
    manage_billing: true,
    manage_services: true,
    manage_medicines: true,
    manage_users: false,
    manage_staff_roles: false,
    manage_clinics: false,
    view_revenue: false,
  },
  assistant: {
    view_dashboard: true,
    manage_patients: true,
    manage_appointments: true,
    manage_prescriptions: false,
    manage_billing: false,
    manage_services: false,
    manage_medicines: true,
    manage_users: false,
    manage_staff_roles: false,
    manage_clinics: false,
    view_revenue: false,
  },
  receptionist: {
    view_dashboard: true,
    manage_patients: true,
    manage_appointments: true,
    manage_prescriptions: false,
    manage_billing: true,
    manage_services: true,
    manage_medicines: true,
    manage_users: false,
    manage_staff_roles: false,
    manage_clinics: false,
    view_revenue: false,
  },
};

const isKnownRole = (role?: string): role is UserRole => {
  return role === 'admin' || role === 'clinic_admin' || role === 'doctor' || role === 'assistant' || role === 'receptionist';
};

export function getDefaultPermissionsForRole(role?: string): Record<PermissionKey, boolean> {
  if (isKnownRole(role)) {
    return { ...DEFAULT_ROLE_PERMISSION_MAP[role] };
  }

  return {
    ...EMPTY_PERMISSIONS,
    view_dashboard: true,
  };
}

export function resolvePermissionKeys(rawKey: string): PermissionKey[] {
  const normalized = rawKey.trim().toLowerCase();
  return PERMISSION_KEYS.filter((key) => (LEGACY_PERMISSION_KEY_MAP[key] || [key]).includes(normalized));
}

export function mergePermissionsWithDefaults(
  role: string | undefined,
  permissionOverrides: Record<string, boolean>
): Record<string, boolean> {
  const result: Record<string, boolean> = { ...getDefaultPermissionsForRole(role) };

  for (const [key, value] of Object.entries(permissionOverrides)) {
    result[key] = Boolean(value);
  }

  return result;
}
