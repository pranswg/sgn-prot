import type { Account, AccountRole, Permission } from '@/core/types/auth'

export const PERMISSION_DEFINITIONS: {
  id: Permission
  label: string
  module: string
}[] = [
  { id: 'view-dashboard', label: 'View Dashboard', module: 'Overview' },
  { id: 'view-master-list', label: 'View Master List', module: 'Choir Management' },
  { id: 'add-members', label: 'Add Members', module: 'Choir Management' },
  { id: 'edit-members', label: 'Edit Members', module: 'Choir Management' },
  { id: 'delete-members', label: 'Delete Members', module: 'Choir Management' },
  { id: 'manage-trainees', label: 'Manage Trainees', module: 'Choir Management' },
  { id: 'manage-membership-history', label: 'Manage Members History', module: 'Choir Management' },
  { id: 'view-suguan', label: 'View Suguan History', module: 'Suguan' },
  { id: 'create-suguan', label: 'Create Suguan', module: 'Suguan' },
  { id: 'edit-suguan', label: 'Edit Suguan', module: 'Suguan' },
  { id: 'assign-members', label: 'Assign Members', module: 'Suguan' },
  { id: 'delete-suguan', label: 'Delete Suguan', module: 'Suguan' },
  { id: 'export-documents', label: 'Export Documents', module: 'Suguan' },
  { id: 'manage-users', label: 'Manage Users', module: 'Administration' },
  { id: 'manage-roles', label: 'Manage Roles', module: 'Administration' },
  { id: 'view-audit-logs', label: 'View Audit Logs', module: 'Security' },
  { id: 'change-settings', label: 'Change Settings', module: 'System' },
  { id: 'restore-data', label: 'Restore Data', module: 'System' },
  { id: 'view-login-history', label: 'View Login History', module: 'Security' },
  { id: 'manage-sessions', label: 'Manage Active Sessions', module: 'Security' },
]

export const ADMIN_ONLY_PERMISSIONS: Permission[] = [
  'manage-users',
  'manage-roles',
  'view-audit-logs',
  'change-settings',
  'restore-data',
  'view-login-history',
  'manage-sessions',
  'manage-membership-history',
]

export const ACCOUNT_ROLES: {
  id: AccountRole
  label: string
  description: string
}[] = [
  { id: 'admin', label: 'Admin', description: 'Super Admin with full system access.' },
  {
    id: 'suguan-manager',
    label: 'Suguan Manager',
    description: 'Manages schedules, assignments, and exports.',
  },
  {
    id: 'choir-manager',
    label: 'Choir Manager',
    description: 'Manages the Master List and trainees.',
  },
  { id: 'viewer', label: 'Viewer', description: 'Read-only access to permitted pages.' },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<AccountRole, Permission[]> = {
  admin: PERMISSION_DEFINITIONS.map((permission) => permission.id),
  'suguan-manager': [
    'view-dashboard',
    'view-suguan',
    'create-suguan',
    'edit-suguan',
    'assign-members',
    'export-documents',
  ],
  'choir-manager': [
    'view-dashboard',
    'view-master-list',
    'add-members',
    'edit-members',
    'manage-trainees',
  ],
  viewer: ['view-dashboard', 'view-master-list', 'view-suguan'],
}

export function isAccountRole(value: unknown): value is AccountRole {
  return ACCOUNT_ROLES.some((role) => role.id === value)
}

export function effectivePermissions(
  account: Pick<Account, 'role' | 'customPermissions'>,
  rolePermissions: Partial<Record<AccountRole, Permission[]>>,
): Permission[] {
  if (account.role === 'admin') return DEFAULT_ROLE_PERMISSIONS.admin
  return (account.customPermissions ??
    rolePermissions[account.role] ??
    DEFAULT_ROLE_PERMISSIONS[account.role]).filter(
    (permission) => !ADMIN_ONLY_PERMISSIONS.includes(permission),
  )
}

export function hasPermission(
  account: Pick<Account, 'role' | 'customPermissions'> | null | undefined,
  permission: Permission,
  rolePermissions: Partial<Record<AccountRole, Permission[]>>,
): boolean {
  if (!account) return false
  return effectivePermissions(account, rolePermissions).includes(permission)
}

export function canAccessPage(
  page: string,
  account: Pick<Account, 'role' | 'customPermissions'> | null | undefined,
  rolePermissions: Partial<Record<AccountRole, Permission[]>>,
): boolean {
  if (page === 'settings' || page === 'administration') {
    return account?.role === 'admin'
  }
  if (page === 'suguan-builder') {
    return (
      hasPermission(account, 'create-suguan', rolePermissions) ||
      hasPermission(account, 'edit-suguan', rolePermissions)
    )
  }
  const pagePermission: Record<string, Permission> = {
    dashboard: 'view-dashboard',
    'master-list': 'view-master-list',
    'members-history': 'view-master-list',
    trainees: 'manage-trainees',
    'koro-maker': 'edit-members',
    'organista-suguan-maker': 'create-suguan',

    'suguan-history': 'view-suguan',
    'suguan-detail': 'view-suguan',
    'admin-users': 'manage-users',
    'admin-roles': 'manage-roles',
    'admin-audit': 'view-audit-logs',
    'admin-login-history': 'view-login-history',
    'admin-sessions': 'manage-sessions',
  }
  const required = pagePermission[page]
  return !required || hasPermission(account, required, rolePermissions)
}
