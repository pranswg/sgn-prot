import type { AccountRole } from '@/core/types/auth'

/**
 * Shapes for the Administration screens. These name the client-side mirror that
 * `adminStore` rebuilds from the server (`roles`, `role_permissions`,
 * `audit_logs`, `login_events`, and the session RPC); the SQL rows are mapped
 * into them by `src/lib/accountMapping.ts`.
 */

export interface ManagedRole {
  id: AccountRole
  label: string
  description: string
}

export interface AuditLogEntry {
  id: string
  actorId: string | null
  actorName: string
  actorUsername: string
  action: string
  module: string
  affectedUserId?: string
  affectedUserName?: string
  details?: string
  createdAt: string
}

export interface LoginHistoryEntry {
  id: string
  userId?: string
  userName: string
  username: string
  device: string
  locationIp: string
  status: 'successful' | 'failed'
  createdAt: string
}

export interface ActiveSession {
  id: string
  userId: string
  userName: string
  username: string
  device: string
  platform: string
  locationIp: string
  startedAt: string
  lastActiveAt: string
}
