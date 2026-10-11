import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { AccountRole, Permission } from '@/core/types/auth'
import { fetchRoles } from '@/api/admin'
import {
  ADMIN_ONLY_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
} from '@/lib/rbac'

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

/**
 * Roles and their permissions are read from the server (`public.roles` +
 * `public.role_permissions`) and cached here so `usePermissions` stays
 * synchronous. Writes go through the Phase 5 RPCs; after a write the caller
 * re-runs `refreshRoles`. Audit logs, login history, and sessions stay local
 * (Phase 5d).
 */
interface AdminState {
  auditLogs: AuditLogEntry[]
  loginHistory: LoginHistoryEntry[]
  activeSessions: ActiveSession[]
  customRoles: ManagedRole[]
  rolePermissions: Partial<Record<AccountRole, Permission[]>>
  rolesLoaded: boolean
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => void
  recordLogin: (entry: Omit<LoginHistoryEntry, 'id' | 'createdAt'>) => void
  startSession: (entry: Omit<ActiveSession, 'id' | 'startedAt' | 'lastActiveAt'>) => string
  endSession: (id: string) => void
  endUserSessions: (userId: string) => void
  refreshRoles: () => Promise<void>
}

const KNOWN_PERMISSIONS = new Set<Permission>(
  PERMISSION_DEFINITIONS.map((permission) => permission.id),
)

function sanitizePermissions(permissions: Permission[]): Permission[] {
  return [...new Set(permissions)].filter(
    (permission) =>
      KNOWN_PERMISSIONS.has(permission) &&
      !ADMIN_ONLY_PERMISSIONS.includes(permission),
  )
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      auditLogs: [],
      loginHistory: [],
      activeSessions: [],
      customRoles: [],
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      rolesLoaded: false,
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
      refreshRoles: async () => {
        const { roles, permissions } = await fetchRoles()
        const customRoles = roles
          .filter((role) => !role.builtin && role.id !== 'admin')
          .map((role) => ({
            id: role.id,
            label: role.label,
            description: role.description,
          }))
        const rolePermissions: Partial<Record<AccountRole, Permission[]>> = {
          admin: DEFAULT_ROLE_PERMISSIONS.admin,
        }
        for (const role of roles) {
          if (role.id === 'admin') continue
          rolePermissions[role.id] = sanitizePermissions(
            permissions
              .filter((row) => row.role_id === role.id)
              .map((row) => row.permission),
          )
        }
        set({ customRoles, rolePermissions, rolesLoaded: true })
      },
    }),
    {
      name: 'choir-admin-security',
      version: 5,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Partial<AdminState>
        const customRoles = Array.isArray(state.customRoles)
          ? state.customRoles.filter(
              (role) =>
                typeof role.id === 'string' &&
                role.id.startsWith('custom-') &&
                typeof role.label === 'string' &&
                typeof role.description === 'string',
            )
          : []
        const permissions: Partial<Record<AccountRole, Permission[]>> = {
          ...(state.rolePermissions ?? {}),
          admin: DEFAULT_ROLE_PERMISSIONS.admin,
        }
        for (const role of Object.keys(permissions)) {
          if (role !== 'admin' && !customRoles.some((item) => item.id === role)) {
            delete permissions[role]
          } else if (role !== 'admin') {
            permissions[role] = sanitizePermissions(permissions[role] ?? [])
          }
        }
        return {
          auditLogs: Array.isArray(state.auditLogs) ? state.auditLogs : [],
          loginHistory: Array.isArray(state.loginHistory)
            ? state.loginHistory
            : [],
          activeSessions: Array.isArray(state.activeSessions)
            ? state.activeSessions
            : [],
          customRoles,
          rolePermissions: permissions,
          rolesLoaded: false,
        }
      },
    },
  ),
)
