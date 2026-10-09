import type { Database } from '@/lib/database.types'
import type {
  Account,
  AccountStatus,
  Permission,
} from '@/core/types/auth'
import type {
  ActiveSession,
  AuditLogEntry,
  LoginHistoryEntry,
  ManagedRole,
} from '@/core/types/admin'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type RoleRow = Database['public']['Tables']['roles']['Row']
type RolePermissionRow = Database['public']['Tables']['role_permissions']['Row']
type AuditLogRow = Database['public']['Tables']['audit_logs']['Row']
type LoginEventRow = Database['public']['Tables']['login_events']['Row']
type SessionRow = Database['public']['Functions']['admin_list_sessions']['Returns'][number]

const FALLBACK_EMAIL_DOMAIN = 'choir.internal'

/**
 * Users sign in with a username, but Supabase Auth keys on an email. Every
 * account therefore gets a synthetic `<username>@choir.internal` address, so a
 * real inbox is never required and can never collide with a user's own email.
 */
export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${FALLBACK_EMAIL_DOMAIN}`
}

export function emailToUsername(email: string | null | undefined): string {
  if (!email) return ''
  return email.endsWith(`@${FALLBACK_EMAIL_DOMAIN}`)
    ? email.slice(0, -(`@${FALLBACK_EMAIL_DOMAIN}`.length))
    : email
}

/**
 * Best-effort label for a user agent string, used by the login-history and
 * active-session tables. Pure so it can be unit tested; never authoritative.
 */
export function describeUserAgent(agent: string): {
  device: string
  platform: string
} {
  const browser = /Edg\//.test(agent)
    ? 'Microsoft Edge'
    : /Chrome\//.test(agent)
      ? 'Chrome'
      : /Firefox\//.test(agent)
        ? 'Firefox'
        : /Safari\//.test(agent)
          ? 'Safari'
          : 'Browser'
  const platform = /Windows/i.test(agent)
    ? 'Windows'
    : /Mac OS/i.test(agent)
      ? 'macOS'
      : /Android/i.test(agent)
        ? 'Android'
        : /iPhone|iPad/i.test(agent)
          ? 'iOS'
          : /Linux/i.test(agent)
            ? 'Linux'
            : 'Unknown device'
  return { device: `${browser} / ${platform}`, platform }
}

export function currentUserAgent(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent
}

/** Maps a `profiles` row onto the client `Account` shape. */
export function profileToAccount(row: ProfileRow): Account {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role_id,
    status: row.status as AccountStatus,
    customPermissions: (row.custom_permissions as Permission[] | null) ?? null,
    mustChangePassword: row.must_change_password,
    statusReason: row.status_reason ?? undefined,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? undefined,
  }
}

export function roleToManagedRole(row: RoleRow): ManagedRole {
  return { id: row.id, label: row.label, description: row.description }
}

export function groupRolePermissions(
  rows: RolePermissionRow[],
): Partial<Record<string, Permission[]>> {
  const grouped: Partial<Record<string, Permission[]>> = {}
  for (const row of rows) {
    const existing = grouped[row.role_id] ?? []
    existing.push(row.permission as Permission)
    grouped[row.role_id] = existing
  }
  return grouped
}

export function auditLogToEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorUsername: row.actor_username,
    action: row.action,
    module: row.module,
    affectedUserId: row.affected_user_id ?? undefined,
    affectedUserName: row.affected_user_name ?? undefined,
    details: row.details ?? undefined,
    createdAt: row.created_at,
  }
}

export function loginEventToEntry(row: LoginEventRow): LoginHistoryEntry {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    userName: row.full_name,
    username: row.username,
    device: row.device,
    locationIp: 'Unknown',
    status: row.status === 'success' ? 'successful' : 'failed',
    createdAt: row.created_at,
  }
}

export function sessionRowToActiveSession(row: SessionRow): ActiveSession {
  const { device, platform } = describeUserAgent(row.user_agent ?? '')
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.full_name || row.username || 'Unknown user',
    username: row.username,
    device,
    platform,
    locationIp: row.ip || 'Unknown',
    startedAt: row.created_at,
    lastActiveAt: row.updated_at,
  }
}
