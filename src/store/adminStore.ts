import { create } from 'zustand'
import type { AccountRole, Permission } from '@/core/types/auth'
import type {
  ActiveSession,
  AuditLogEntry,
  LoginHistoryEntry,
  ManagedRole,
} from '@/core/types/admin'
import {
  auditLogToEntry,
  groupRolePermissions,
  loginEventToEntry,
  roleToManagedRole,
  sessionRowToActiveSession,
} from '@/lib/accountMapping'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

export type { ActiveSession, AuditLogEntry, LoginHistoryEntry, ManagedRole }

interface AdminState {
  auditLogs: AuditLogEntry[]
  loginHistory: LoginHistoryEntry[]
  activeSessions: ActiveSession[]
  customRoles: ManagedRole[]
  removedRoleIds: AccountRole[]
  rolePermissions: Partial<Record<AccountRole, Permission[]>>
  /** Rebuilds the mirror from Supabase. No-op when unconfigured (tests). */
  refresh: () => Promise<void>
  /** Writes an audit entry server-side. Fire-and-forget. */
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => void
  clear: () => void
}

/**
 * A synchronous read mirror over the `roles`, `role_permissions`, `audit_logs`,
 * `login_events`, and `admin_list_sessions()` data. Many components read it
 * synchronously (RBAC, the Administration tables), so the store keeps the same
 * shape the old local store had and is refreshed after each mutation.
 */
export const useAdminStore = create<AdminState>()((set) => ({
  auditLogs: [],
  loginHistory: [],
  activeSessions: [],
  customRoles: [],
  removedRoleIds: [],
  rolePermissions: {},

  refresh: async () => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    const [rolesResult, permissionsResult, auditResult, loginResult] =
      await Promise.all([
        supabase.from('roles').select('*').order('created_at', { ascending: true }),
        supabase.from('role_permissions').select('*'),
        supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('login_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500),
      ])

    const customRoles = (rolesResult.data ?? [])
      .filter((role) => !role.is_system && role.id !== 'admin')
      .map(roleToManagedRole)

    set({
      customRoles,
      rolePermissions: groupRolePermissions(permissionsResult.data ?? []),
      removedRoleIds: [],
      auditLogs: (auditResult.data ?? []).map(auditLogToEntry),
      loginHistory: (loginResult.data ?? []).map(loginEventToEntry),
    })

    // RLS raises for non-admins; treat an error as "no visible sessions".
    const { data: sessionRows, error: sessionError } =
      await supabase.rpc('admin_list_sessions')
    set({
      activeSessions: sessionError
        ? []
        : (sessionRows ?? []).map(sessionRowToActiveSession),
    })
  },

  addAuditLog: (entry) => {
    if (!isSupabaseConfigured) return
    void getSupabase()
      .rpc('log_audit', {
        p_action: entry.action,
        p_module: entry.module,
        p_details: entry.details ?? undefined,
        p_affected_user_id: entry.affectedUserId ?? undefined,
        p_affected_user_name: entry.affectedUserName ?? undefined,
      })
      .then(({ error }) => {
        if (error) console.error('Could not write audit log:', error.message)
      })
  },

  clear: () =>
    set({
      auditLogs: [],
      loginHistory: [],
      activeSessions: [],
      customRoles: [],
      removedRoleIds: [],
      rolePermissions: {},
    }),
}))
