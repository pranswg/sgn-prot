import type { AuditLogRow, LoginHistoryRow } from '@/api/admin'
import type { AuditLogEntry, LoginHistoryEntry } from '@/store/adminStore'

/**
 * Phase 5d: pure row -> store-entry mapping for the server-backed audit trail.
 * Kept out of the store so the shape conversion is unit-testable in node.
 */
export function auditLogFromRow(row: AuditLogRow): AuditLogEntry {
  return {
    id: String(row.id),
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

export function loginHistoryFromRow(row: LoginHistoryRow): LoginHistoryEntry {
  return {
    id: String(row.id),
    userId: row.user_id ?? undefined,
    userName: row.user_name,
    username: row.username,
    device: row.device,
    locationIp: row.client_ip ?? '',
    status: row.status,
    createdAt: row.created_at,
  }
}
