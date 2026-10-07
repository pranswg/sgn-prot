import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  Account,
  AccountRole,
  AccountStatus,
  NewAccountInput,
  Permission,
} from '@/core/types/auth'
import { DEFAULT_ROLE_PERMISSIONS } from '@/lib/rbac'
import {
  findAccountByUsername,
  hasActiveAdmin,
  hashPassword,
  isUsernameTaken,
  normalizeUsername,
  validateFullName,
  validatePassword,
  validateRegistration,
  verifyPassword,
  type FieldProblem,
} from '@/lib/credentials'
import { useAdminStore, type ActiveSession } from '@/store/adminStore'

/**
 * Default credentials for the seeded Admin. A fresh browser always has this
 * account, recreated on startup whenever no active Admin exists, so a choir
 * leader can always get into the Administration screens. Like the seed itself,
 * these are a known-backstop default, not a secret: change the password from
 * the Settings → Administration → Users screen after first sign-in.
 */
const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_PASSWORD = 'admin1234'
const DEFAULT_ADMIN_NAME = 'Choir Administrator'

export interface CreateManagedAccountInput {
  firstName: string
  lastName: string
  email: string
  username: string
  password: string
  role: AccountRole
  customPermissions: Permission[] | null
}

function browserContext() {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
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
  return {
    device: `${browser} / ${platform}`,
    platform,
    locationIp: 'Local browser · IP unavailable',
  }
}

function nameParts(
  account: Pick<Account, 'fullName'> & Partial<Pick<Account, 'firstName' | 'lastName'>>,
) {
  const firstName = account.firstName?.trim()
  const lastName = account.lastName?.trim()
  if (firstName || lastName) {
    return {
      firstName: firstName ?? '',
      lastName: lastName ?? '',
    }
  }
  const parts = account.fullName.trim().split(/\s+/)
  return {
    firstName: parts.slice(0, -1).join(' ') || parts[0] || '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
  }
}

interface AuthState {
  accounts: Account[]
  currentAccountId: string | null
  activeSessionId: string | null
  register: (
    input: NewAccountInput,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  createManagedAccount: (
    actorId: string,
    input: CreateManagedAccountInput,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  updateManagedAccount: (
    actorId: string,
    id: string,
    patch: Partial<
      Pick<
        Account,
        | 'firstName'
        | 'lastName'
        | 'fullName'
        | 'email'
        | 'role'
        | 'status'
        | 'customPermissions'
        | 'statusReason'
      >
    >,
  ) => { account: Account } | { problems: FieldProblem[] }
  resetManagedPassword: (
    actorId: string,
    id: string,
    password: string,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  updateManagedRolePermissions: (
    actorId: string,
    role: AccountRole,
    permissions: Permission[],
  ) => { permissions: Permission[] } | { problems: FieldProblem[] }
  terminateManagedSession: (
    actorId: string,
    sessionId: string,
  ) => { session: ActiveSession } | { problems: FieldProblem[] }
  signIn: (
    username: string,
    password: string,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  signOut: () => void
  currentAccount: () => Account | null
  clear: () => void
  seedDefaultAdmin: () => Promise<Account | null>
}

/**
 * Memoised at module scope so the startup seed never races itself (React
 * StrictMode mounts twice in dev). Duplicate `admin` accounts would otherwise
 * collide on the login key.
 */
let defaultAdminSeed: Promise<Account | null> | null = null

const authorizationProblem: FieldProblem[] = [
  { field: 'form', message: 'You are not authorized to manage system users.' },
]

function isActiveAdmin(account: Account | undefined): account is Account {
  return account?.role === 'admin' && (account.status ?? 'active') === 'active'
}

function actorAccount(
  accounts: Account[],
  actorId: string,
  currentAccountId: string | null,
) {
  if (actorId !== currentAccountId) return undefined
  return accounts.find((account) => account.id === actorId)
}

function addAudit(
  actor: Account | undefined,
  action: string,
  affected?: Account,
  details?: string,
) {
  useAdminStore.getState().addAuditLog({
    actorId: actor?.id ?? null,
    actorName: actor?.fullName ?? 'System Setup',
    actorUsername: actor?.username ?? 'system',
    action,
    module: 'User Management',
    affectedUserId: affected?.id,
    affectedUserName: affected?.fullName,
    details,
  })
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccountId: null,
      activeSessionId: null,

      register: async (input) => {
        const { accounts } = get()
        if (accounts.length > 0) {
          return {
            problems: [
              {
                field: 'form',
                message: 'Ask an administrator to create your system account.',
              },
            ],
          }
        }
        const problems = validateRegistration(input)
        if (problems.length > 0) return { problems }
        const { passwordHash, passwordSalt, hashAlgo } = await hashPassword(
          input.password,
        )
        const account: Account = {
          id: nanoid(),
          username: normalizeUsername(input.username),
          fullName: input.fullName.trim(),
          ...nameParts({ fullName: input.fullName }),
          passwordHash,
          passwordSalt,
          hashAlgo,
          role: 'admin',
          status: 'active',
          createdAt: new Date().toISOString(),
        }
        set({ accounts: [account], currentAccountId: account.id })
        addAudit(undefined, 'Created initial Admin account', account)
        return { account }
      },

      createManagedAccount: async (actorId, input) => {
        const actor = actorAccount(
          get().accounts,
          actorId,
          get().currentAccountId,
        )
        if (!isActiveAdmin(actor)) return { problems: authorizationProblem }

        const firstName = input.firstName.trim()
        const lastName = input.lastName.trim()
        const fullName = `${firstName} ${lastName}`.trim()
        const problems: FieldProblem[] = []
        const nameProblem = validateFullName(fullName)
        if (nameProblem) problems.push({ field: 'fullName', message: nameProblem })
        if (!firstName || !lastName) {
          problems.push({
            field: 'fullName',
            message: 'Enter both a first name and a last name.',
          })
        }
        if (
          input.email.trim() &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
        ) {
          problems.push({
            field: 'form',
            message: 'Enter a valid email address or leave it blank.',
          })
        }
        const registrationProblems = validateRegistration({
          username: input.username,
          fullName,
          password: input.password,
          confirmPassword: input.password,
        })
        problems.push(...registrationProblems.filter((problem) => problem.field !== 'fullName'))
        if (isUsernameTaken(get().accounts, input.username)) {
          problems.push({
            field: 'username',
            message: 'That username is already taken.',
          })
        }
        if (problems.length) return { problems }

        const { passwordHash, passwordSalt, hashAlgo } = await hashPassword(
          input.password,
        )
        const account: Account = {
          id: nanoid(),
          firstName,
          lastName,
          fullName,
          email: input.email.trim(),
          username: normalizeUsername(input.username),
          passwordHash,
          passwordSalt,
          hashAlgo,
          role: input.role,
          status: 'active',
          customPermissions: input.customPermissions,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ accounts: [...state.accounts, account] }))
        addAudit(actor, 'Created System User', account, `Role: ${account.role}`)
        return { account }
      },

      updateManagedAccount: (actorId, id, patch) => {
        const actor = actorAccount(
          get().accounts,
          actorId,
          get().currentAccountId,
        )
        if (!isActiveAdmin(actor)) return { problems: authorizationProblem }
        const account = get().accounts.find((candidate) => candidate.id === id)
        if (!account) {
          return {
            problems: [{ field: 'form', message: 'The selected account no longer exists.' }],
          }
        }

        const nextRole = patch.role ?? account.role
        const nextStatus = patch.status ?? account.status ?? 'active'
        if (
          nextStatus !== 'active' &&
          nextStatus !== (account.status ?? 'active') &&
          !patch.statusReason?.trim()
        ) {
          return {
            problems: [
              {
                field: 'form',
                message: 'Provide a reason when disabling or suspending an account.',
              },
            ],
          }
        }
        const removesAdminAccess =
          account.role === 'admin' &&
          account.status !== 'disabled' &&
          account.status !== 'suspended' &&
          (nextRole !== 'admin' || nextStatus !== 'active')
        const activeAdminCount = get().accounts.filter(
          (candidate) =>
            candidate.role === 'admin' &&
            (candidate.status ?? 'active') === 'active',
        ).length
        if (removesAdminAccess && activeAdminCount <= 1) {
          return {
            problems: [
              {
                field: 'form',
                message: 'At least one active Admin account must remain.',
              },
            ],
          }
        }
        const firstName = patch.firstName?.trim() ?? account.firstName ?? ''
        const lastName = patch.lastName?.trim() ?? account.lastName ?? ''
        if (
          (patch.firstName !== undefined || patch.lastName !== undefined) &&
          (!firstName || !lastName)
        ) {
          return {
            problems: [
              { field: 'fullName', message: 'Enter both a first name and a last name.' },
            ],
          }
        }
        if (
          patch.email !== undefined &&
          patch.email.trim() &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email.trim())
        ) {
          return {
            problems: [{ field: 'form', message: 'Enter a valid email address or leave it blank.' }],
          }
        }
        const fullName =
          patch.fullName?.trim() ||
          `${firstName} ${lastName}`.trim() ||
          account.fullName
        const updated: Account = {
          ...account,
          ...patch,
          firstName,
          lastName,
          fullName,
          status: nextStatus,
          email: patch.email?.trim() ?? account.email,
        }
        set((state) => ({
          accounts: state.accounts.map((candidate) =>
            candidate.id === id ? updated : candidate,
          ),
          ...(id === state.currentAccountId && nextStatus !== 'active'
            ? { currentAccountId: null, activeSessionId: null }
            : {}),
        }))
        if (nextStatus !== 'active') {
          useAdminStore.getState().endUserSessions(id)
        }
        const changed = Object.keys(patch).join(', ')
        const oldValues = Object.keys(patch)
          .map((key) => `${key}=${JSON.stringify(Reflect.get(account, key) ?? null)}`)
          .join(', ')
        const newValues = Object.keys(patch)
          .map((key) => `${key}=${JSON.stringify(Reflect.get(updated, key) ?? null)}`)
          .join(', ')
        const oldPermissions =
          account.customPermissions ??
          useAdminStore.getState().rolePermissions[account.role] ??
          DEFAULT_ROLE_PERMISSIONS[account.role]
        const newPermissions =
          updated.customPermissions ??
          useAdminStore.getState().rolePermissions[updated.role] ??
          DEFAULT_ROLE_PERMISSIONS[updated.role]
        const permissionChanges =
          patch.customPermissions === undefined && patch.role === undefined
            ? ''
            : `; permissions added: ${
                newPermissions
                  .filter((permission) => !oldPermissions.includes(permission))
                  .join(', ') || 'none'
              }; permissions removed: ${
                oldPermissions
                  .filter((permission) => !newPermissions.includes(permission))
                  .join(', ') || 'none'
              }`
        addAudit(
          actor,
          patch.status && patch.status !== account.status
            ? patch.status === 'active'
              ? 'Reactivated User Account'
              : 'Disabled User Account'
            : 'Updated System User',
          updated,
          `Changed: ${changed}; old: ${oldValues}; new: ${newValues}${patch.statusReason ? `; reason: ${patch.statusReason}` : ''}${permissionChanges}`,
        )
        return { account: updated }
      },

      resetManagedPassword: async (actorId, id, password) => {
        const actor = actorAccount(
          get().accounts,
          actorId,
          get().currentAccountId,
        )
        if (!isActiveAdmin(actor)) return { problems: authorizationProblem }
        const passwordProblem = validatePassword(password)
        if (passwordProblem) {
          return { problems: [{ field: 'password', message: passwordProblem }] }
        }
        const account = get().accounts.find((candidate) => candidate.id === id)
        if (!account) {
          return {
            problems: [{ field: 'form', message: 'The selected account no longer exists.' }],
          }
        }
        const { passwordHash, passwordSalt, hashAlgo } = await hashPassword(password)
        const updated = { ...account, passwordHash, passwordSalt, hashAlgo }
        set((state) => ({
          accounts: state.accounts.map((candidate) =>
            candidate.id === id ? updated : candidate,
          ),
          ...(id === state.currentAccountId
            ? { currentAccountId: null, activeSessionId: null }
            : {}),
        }))
        useAdminStore.getState().endUserSessions(id)
        addAudit(actor, 'Reset User Password', updated)
        return { account: updated }
      },

      updateManagedRolePermissions: (actorId, role, permissions) => {
        const actor = actorAccount(
          get().accounts,
          actorId,
          get().currentAccountId,
        )
        if (!isActiveAdmin(actor)) return { problems: authorizationProblem }
        if (role === 'admin') {
          return {
            problems: [
              {
                field: 'form',
                message: 'Admin permissions are fixed and cannot be restricted.',
              },
            ],
          }
        }
        const previous =
          useAdminStore.getState().rolePermissions[role] ??
          DEFAULT_ROLE_PERMISSIONS[role]
        useAdminStore.getState().updateRolePermissions(role, permissions)
        const next =
          useAdminStore.getState().rolePermissions[role] ??
          DEFAULT_ROLE_PERMISSIONS[role]
        const added = next.filter((permission) => !previous.includes(permission))
        const removed = previous.filter((permission) => !next.includes(permission))
        useAdminStore.getState().addAuditLog({
          actorId: actor.id,
          actorName: actor.fullName,
          actorUsername: actor.username,
          action: 'Updated Role Permissions',
          module: 'Roles & Permissions',
          details: `${role}: added ${added.join(', ') || 'none'}; removed ${
            removed.join(', ') || 'none'
          }`,
        })
        return { permissions: next }
      },

      terminateManagedSession: (actorId, sessionId) => {
        const actor = actorAccount(
          get().accounts,
          actorId,
          get().currentAccountId,
        )
        if (!isActiveAdmin(actor)) return { problems: authorizationProblem }
        const session = useAdminStore
          .getState()
          .activeSessions.find((item) => item.id === sessionId)
        if (!session) {
          return {
            problems: [
              { field: 'form', message: 'The selected session is no longer active.' },
            ],
          }
        }
        useAdminStore.getState().endSession(sessionId)
        useAdminStore.getState().addAuditLog({
          actorId: actor.id,
          actorName: actor.fullName,
          actorUsername: actor.username,
          action: 'Terminated Active Session',
          module: 'Security',
          affectedUserId: session.userId,
          affectedUserName: session.userName,
          details: session.device,
        })
        if (sessionId === get().activeSessionId) {
          set({ currentAccountId: null, activeSessionId: null })
        }
        return { session }
      },

      signIn: async (username, password) => {
        const account = findAccountByUsername(get().accounts, username)
        const browser = browserContext()
        const validPassword = account
          ? await verifyPassword(password, account)
          : (await hashPassword(password), false)
        if (
          !account ||
          !validPassword ||
          (account.status ?? 'active') !== 'active'
        ) {
          useAdminStore.getState().recordLogin({
            userId: account?.id,
            userName: account?.fullName ?? 'Unknown user',
            username: normalizeUsername(username),
            ...browser,
            status: 'failed',
          })
          return {
            problems: [
              {
                field: 'form',
                message: 'That username and password do not match.',
              },
            ],
          }
        }

        const now = new Date().toISOString()
        const sessionId = useAdminStore.getState().startSession({
          userId: account.id,
          userName: account.fullName,
          username: account.username,
          device: browser.device,
          platform: browser.platform,
          locationIp: browser.locationIp,
        })
        useAdminStore.getState().recordLogin({
          userId: account.id,
          userName: account.fullName,
          username: account.username,
          ...browser,
          status: 'successful',
        })
        set((state) => ({
          accounts: state.accounts.map((candidate) =>
            candidate.id === account.id
              ? { ...candidate, lastLoginAt: now }
              : candidate,
          ),
          currentAccountId: account.id,
          activeSessionId: sessionId,
        }))
        return { account: { ...account, lastLoginAt: now } }
      },

      signOut: () => {
        const sessionId = get().activeSessionId
        if (sessionId) useAdminStore.getState().endSession(sessionId)
        set({ currentAccountId: null, activeSessionId: null })
      },

      currentAccount: () => {
        const { accounts, currentAccountId } = get()
        if (!currentAccountId) return null
        const account = accounts.find((candidate) => candidate.id === currentAccountId)
        return account && (account.status ?? 'active') === 'active'
          ? account
          : null
      },

      clear: () =>
        set({ accounts: [], currentAccountId: null, activeSessionId: null }),

      seedDefaultAdmin: () => {
        if (hasActiveAdmin(get().accounts)) return Promise.resolve(null)
        defaultAdminSeed ??= (async () => {
          if (
            hasActiveAdmin(get().accounts) ||
            isUsernameTaken(get().accounts, DEFAULT_ADMIN_USERNAME)
          ) {
            return null
          }
          const { passwordHash, passwordSalt, hashAlgo } =
            await hashPassword(DEFAULT_ADMIN_PASSWORD)
          if (
            hasActiveAdmin(get().accounts) ||
            isUsernameTaken(get().accounts, DEFAULT_ADMIN_USERNAME)
          ) {
            return null
          }
          const account: Account = {
            id: nanoid(),
            username: normalizeUsername(DEFAULT_ADMIN_USERNAME),
            fullName: DEFAULT_ADMIN_NAME,
            ...nameParts({ fullName: DEFAULT_ADMIN_NAME }),
            passwordHash,
            passwordSalt,
            hashAlgo,
            role: 'admin',
            status: 'active',
            createdAt: new Date().toISOString(),
          }
          set((state) => ({ accounts: [...state.accounts, account] }))
          addAudit(undefined, 'Created Default Admin', account)
          return account
        })()
        return defaultAdminSeed
      },
    }),
    {
      name: 'choir-auth',
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          accounts?: (Omit<Account, 'role'> & {
            role: AccountRole | 'member'
          })[]
          currentAccountId?: string | null
          activeSessionId?: string | null
        }
        return {
          ...state,
          accounts: Array.isArray(state.accounts)
            ? state.accounts.map((account) => ({
                ...account,
                role: account.role === 'member' ? 'viewer' : account.role,
                status: account.status ?? ('active' satisfies AccountStatus),
                ...nameParts(account),
              }))
            : [],
          currentAccountId: state.currentAccountId ?? null,
          activeSessionId: state.activeSessionId ?? null,
        }
      },
    },
  ),
)
