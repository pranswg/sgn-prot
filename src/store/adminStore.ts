import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { AccountRole, Permission } from '@/core/types/auth'
import {
  ADMIN_ONLY_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/lib/rbac'

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

interface AdminState {
  auditLogs: AuditLogEntry[]
  loginHistory: LoginHistoryEntry[]
  activeSessions: ActiveSession[]
  rolePermissions: Partial<Record<AccountRole, Permission[]>>
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => void
  recordLogin: (entry: Omit<LoginHistoryEntry, 'id' | 'createdAt'>) => void
  startSession: (entry: Omit<ActiveSession, 'id' | 'startedAt' | 'lastActiveAt'>) => string
  endSession: (id: string) => void
  endUserSessions: (userId: string) => void
  updateRolePermissions: (role: AccountRole, permissions: Permission[]) => void
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      auditLogs: [],
      loginHistory: [],
      activeSessions: [],
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      addAuditLog: (entry) =>
        set((state) => ({
          auditLogs: [
            { ...entry, id: nanoid(), createdAt: new Date().toISOString() },
            ...state.auditLogs,
          ],
        })),
      recordLogin: (entry) =>
        set((state) => ({
          loginHistory: [
            { ...entry, id: nanoid(), createdAt: new Date().toISOString() },
            ...state.loginHistory,
          ].slice(0, 5000),
        })),
      startSession: (entry) => {
        const id = nanoid()
        const now = new Date().toISOString()
        set((state) => ({
          activeSessions: [
            ...state.activeSessions.filter((session) => session.userId !== entry.userId),
            { ...entry, id, startedAt: now, lastActiveAt: now },
          ],
        }))
        return id
      },
      endSession: (id) =>
        set((state) => ({
          activeSessions: state.activeSessions.filter((session) => session.id !== id),
        })),
      endUserSessions: (userId) =>
        set((state) => ({
          activeSessions: state.activeSessions.filter(
            (session) => session.userId !== userId,
          ),
        })),
      updateRolePermissions: (role, permissions) =>
        set((state) => ({
          rolePermissions: {
            ...state.rolePermissions,
            [role]:
              role === 'admin'
                ? DEFAULT_ROLE_PERMISSIONS.admin
                : [...new Set(permissions)].filter(
                    (permission) => !ADMIN_ONLY_PERMISSIONS.includes(permission),
                  ),
          },
        })),
    }),
    {
      name: 'choir-admin-security',
      version: 1,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<AdminState>
        return {
          auditLogs: Array.isArray(state.auditLogs) ? state.auditLogs : [],
          loginHistory: Array.isArray(state.loginHistory)
            ? state.loginHistory
            : [],
          activeSessions: Array.isArray(state.activeSessions)
            ? state.activeSessions
            : [],
          rolePermissions: {
            ...DEFAULT_ROLE_PERMISSIONS,
            ...(state.rolePermissions ?? {}),
            admin: DEFAULT_ROLE_PERMISSIONS.admin,
            ...Object.fromEntries(
              (['suguan-manager', 'choir-manager', 'viewer'] as const).map(
                (role) => [
                  role,
                  (
                    state.rolePermissions?.[role] ??
                    DEFAULT_ROLE_PERMISSIONS[role]
                  ).filter(
                    (permission) =>
                      !ADMIN_ONLY_PERMISSIONS.includes(permission),
                  ),
                ],
              ),
            ),
          },
        }
      },
    },
  ),
)
