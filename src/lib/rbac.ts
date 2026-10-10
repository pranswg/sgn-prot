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
  { id: 'manage-koro', label: 'Access Koro Maker', module: 'Koro' },
  { id: 'manage-users', label: 'Manage Users', module: 'Administration' },
  { id: 'manage-roles', label: 'Manage Roles', module: 'Administration' },
  { id: 'view-audit-logs', label: 'View Audit Logs', module: 'Security' },
  { id: 'change-settings', label: 'Change Settings', module: 'System' },
  { id: 'restore-data', label: 'Restore Data', module: 'System' },
  { id: 'view-login-history', label: 'View Login History', module: 'Security' },
  { id: 'manage-sessions', label: 'Manage Active Sessions', module: 'Security' },
]

export const ACCOUNT_ROLES: {
  id: AccountRole
  label: string
  description: string
}[] = [
  { id: 'admin', label: 'Admin', description: 'Super Admin with full system access.' },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: PERMISSION_DEFINITIONS.map((permission) => permission.id),
}

/**
 * Permissions that make the Administration page worth opening. Any one of them
 * grants entry; the page's sections are further gated by RLS server-side.
 */
export const ADMIN_SECTION_PERMISSIONS: Permission[] = [
  'manage-users',
  'manage-roles',
  'view-audit-logs',
  'view-login-history',
  'manage-sessions',
]

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === 'string' && value.trim().length > 0
}

export function rolePermissionsFor(
  role: AccountRole,
  rolePermissions: Partial<Record<AccountRole, Permission[]>>,
): Permission[] {
  return (
    rolePermissions[role] ??
    DEFAULT_ROLE_PERMISSIONS[role] ??
    []
  )
}

export function effectivePermissions(
  account: Pick<Account, 'role' | 'customPermissions'>,
  rolePermissions: Partial<Record<AccountRole, Permission[]>>,
): Permission[] {
  if (account.role === 'admin') return DEFAULT_ROLE_PERMISSIONS.admin
  return (
    account.customPermissions ??
    rolePermissionsFor(account.role, rolePermissions)
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
  if (page === 'settings') {
    return (
      hasPermission(account, 'change-settings', rolePermissions) ||
      hasPermission(account, 'restore-data', rolePermissions)
    )
  }
  if (page === 'administration') {
    return ADMIN_SECTION_PERMISSIONS.some((permission) =>
      hasPermission(account, permission, rolePermissions),
    )
  }
  if (page === 'suguan-builder') {
    return (
      hasPermission(account, 'create-suguan', rolePermissions) ||
      hasPermission(account, 'edit-suguan', rolePermissions)
    )
  }
  if (page === 'koro-maker') {
    return hasPermission(account, 'manage-koro', rolePermissions)
  }
  const pagePermission: Record<string, Permission> = {
    dashboard: 'view-dashboard',
    'master-list': 'view-master-list',
    'members-history': 'view-master-list',
    trainees: 'manage-trainees',
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
