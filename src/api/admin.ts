import { getSupabase } from '@/lib/supabase'
import type { AccountRole, AccountStatus, Permission } from '@/core/types/auth'

/**
 * Phase 5c: the single client entry point for server-backed administration.
 *
 * Two transports, one surface:
 * - role/permission and profile-metadata writes go through the SQL SECURITY
 *   DEFINER RPCs in `0010_admin_rpc.sql`;
 * - the three GoTrue-only operations (create user, reset password, ban/unban)
 *   go through the `admin` Edge Function, which holds the service-role key.
 *
 * Everything throws an `AdminError` with a message already safe to show the
 * user; the auth store turns it into `FieldProblem[]`.
 */

export interface AdminRoleRow {
  id: AccountRole
  label: string
  description: string
  builtin: boolean
}

export interface RolePermissionRow {
  role_id: AccountRole
  permission: Permission
}

export class AdminError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'AdminError'
    this.code = code
  }
}

interface FunctionPayload<T> {
  data?: T
  error?: { code?: string; message?: string }
}

async function invokeAdmin<T>(
  action: string,
  input: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<FunctionPayload<T>>(
    'admin',
    { body: { action, input } },
  )
  if (error) throw new AdminError(error.message)
  if (data?.error) {
    throw new AdminError(data.error.message ?? 'The request failed.', data.error.code)
  }
  return (data?.data ?? ({} as T))
}

async function callRpc<T>(
  name: string,
  params: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, params)
  if (error) throw new AdminError(error.message, error.code)
  return data as T
}

export async function fetchRoles(): Promise<{
  roles: AdminRoleRow[]
  permissions: RolePermissionRow[]
}> {
  const client = getSupabase()
  const [roles, permissions] = await Promise.all([
    client.from('roles').select('id, label, description, builtin'),
    client.from('role_permissions').select('role_id, permission'),
  ])
  if (roles.error) throw new AdminError(roles.error.message)
  if (permissions.error) throw new AdminError(permissions.error.message)
  return {
    roles: (roles.data ?? []) as AdminRoleRow[],
    permissions: (permissions.data ?? []) as RolePermissionRow[],
  }
}

export function createRole(
  label: string,
  description: string,
  permissions: Permission[],
): Promise<AdminRoleRow> {
  return callRpc<AdminRoleRow>('admin_create_role', {
    p_label: label,
    p_description: description,
    p_permissions: permissions,
  })
}

export function updateRole(
  roleId: AccountRole,
  label: string,
  description: string,
): Promise<AdminRoleRow> {
  return callRpc<AdminRoleRow>('admin_update_role', {
    p_role_id: roleId,
    p_label: label,
    p_description: description,
  })
}

export function deleteRole(roleId: AccountRole): Promise<void> {
  return callRpc<void>('admin_delete_role', { p_role_id: roleId })
}

export function setRolePermissions(
  roleId: AccountRole,
  permissions: Permission[],
): Promise<Permission[]> {
  return callRpc<Permission[]>('admin_set_role_permissions', {
    p_role_id: roleId,
    p_permissions: permissions,
  })
}

export function updateAccountMetadata(input: {
  userId: string
  fullName: string
  email: string
  role: AccountRole
  customPermissions: Permission[] | null
}): Promise<void> {
  return callRpc<void>('admin_update_account_metadata', {
    p_user_id: input.userId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_role: input.role,
    p_custom_permissions: input.customPermissions,
  })
}

export interface CreateUserRequest {
  username: string
  firstName: string
  lastName: string
  email: string
  password: string
  role: AccountRole
  customPermissions: Permission[] | null
}

export function createUser(
  input: CreateUserRequest,
): Promise<{ accountId: string }> {
  return invokeAdmin<{ accountId: string }>('createUser', { ...input })
}

export function resetUserPassword(
  userId: string,
  password: string,
  mustChangePassword: boolean,
): Promise<void> {
  return invokeAdmin<void>('resetPassword', {
    userId,
    password,
    mustChangePassword,
  })
}

export function setAccountStatus(
  userId: string,
  status: AccountStatus,
  statusReason: string,
): Promise<void> {
  return invokeAdmin<void>('setAccountStatus', { userId, status, statusReason })
}

export interface AuditLogRow {
  id: number
  actor_id: string | null
  actor_name: string
  actor_username: string
  action: string
  module: string
  affected_user_id: string | null
  affected_user_name: string | null
  details: string | null
  created_at: string
}

export interface LoginHistoryRow {
  id: number
  user_id: string | null
  user_name: string
  username: string
  device: string
  client_ip: string | null
  status: 'successful' | 'failed'
  created_at: string
}

export async function fetchAuditLogs(): Promise<AuditLogRow[]> {
  const { data, error } = await getSupabase()
    .from('audit_logs')
    .select(
      'id, actor_id, actor_name, actor_username, action, module, affected_user_id, affected_user_name, details, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw new AdminError(error.message)
  return (data ?? []) as AuditLogRow[]
}

export async function fetchLoginHistory(): Promise<LoginHistoryRow[]> {
  const { data, error } = await getSupabase()
    .from('login_history')
    .select('id, user_id, user_name, username, device, client_ip, status, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw new AdminError(error.message)
  return (data ?? []) as LoginHistoryRow[]
}

export function logAudit(input: {
  action: string
  module: string
  affectedUserId?: string
  affectedUserName?: string
  details?: string
}): Promise<void> {
  return callRpc<void>('log_audit', {
    p_action: input.action,
    p_module: input.module,
    p_affected_user_id: input.affectedUserId ?? null,
    p_affected_user_name: input.affectedUserName ?? null,
    p_details: input.details ?? null,
  })
}

export function logLogin(
  status: 'successful' | 'failed',
  device: string,
): Promise<void> {
  return callRpc<void>('log_login', { p_status: status, p_device: device })
}
