import { create } from 'zustand'
import type { Account, AccountRole, Permission } from '@/core/types/auth'
import {
  normalizeUsername,
  validateFullName,
  validatePassword,
  validateUsername,
  type FieldProblem,
} from '@/lib/credentials'
import { profileToAccount, resolveSignInAddress, type ProfileRow } from '@/lib/authIdentity'
import { getSupabase } from '@/lib/supabase'
import {
  createRole,
  createUser,
  deleteRole,
  resetUserPassword,
  setAccountStatus,
  setRolePermissions,
  updateAccountMetadata,
  updateRole,
} from '@/api/admin'
import { useAdminStore, type ActiveSession } from '@/store/adminStore'
import type { ManagedRole } from '@/store/adminStore'

/**
 * Sign-in is backed by Supabase Auth. This store keeps a read-only cache of the
 * `public.profiles` rows (`accounts`) so the rest of the app can resolve the
 * current account and its permissions synchronously, exactly as it did when the
 * accounts lived in `localStorage`.
 *
 * Admin account/role mutations are intentionally deferred: creating or resetting
 * another user's password requires the service-role Admin API, which ships with
 * the Phase 5 write path. The method signatures are kept so the Administration
 * screens compile while they render read-only.
 */

const PROFILE_COLUMNS =
  'id, username, full_name, email, role, custom_permissions, status, must_change_password, created_at'

export interface CreateManagedAccountInput {
  firstName: string
  lastName: string
  email: string
  username: string
  password: string
  role: AccountRole
  customPermissions: Permission[] | null
}

export interface CreateManagedRoleInput {
  label: string
  description: string
  permissions: Permission[]
}

/**
 * Sessions stay a client-only map in Phase 5c; terminating them server-side
 * needs the session registry, which is deferred to Phase 5d.
 */
const sessionsDeferredProblem: FieldProblem[] = [
  {
    field: 'form',
    message:
      'Ending another device’s session is coming in a later update. The sessions listed here are local to this browser.',
  },
]

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

function addAudit(
  actor: Account | undefined,
  action: string,
  affected?: Account,
  details?: string,
  module = 'User Management',
) {
  useAdminStore.getState().addAuditLog({
    actorId: actor?.id ?? null,
    actorName: actor?.fullName ?? 'System Setup',
    actorUsername: actor?.username ?? 'system',
    action,
    module,
    affectedUserId: affected?.id,
    affectedUserName: affected?.fullName,
    details,
  })
}

function actor(actorId: string): Account | undefined {
  return useAuthStore.getState().accounts.find((account) => account.id === actorId)
}

function problemsFrom(cause: unknown, fallback: string): FieldProblem[] {
  const message = cause instanceof Error && cause.message ? cause.message : fallback
  return [{ field: 'form', message }]
}

function recordFailedLogin(
  username: string,
  browser: ReturnType<typeof browserContext>,
) {
  useAdminStore.getState().recordLogin({
    userName: 'Unknown user',
    username,
    ...browser,
    status: 'failed',
  })
}

function upsertAccount(accounts: Account[], account: Account): Account[] {
  return accounts.some((item) => item.id === account.id)
    ? accounts.map((item) => (item.id === account.id ? account : item))
    : [...accounts, account]
}

interface AuthState {
  accounts: Account[]
  currentAccountId: string | null
  activeSessionId: string | null
  /** True until the persisted Supabase session has been restored on load. */
  initializing: boolean
  initialize: () => Promise<void>
  refreshAccounts: () => Promise<void>
  signIn: (
    username: string,
    password: string,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  signOut: () => void
  currentAccount: () => Account | null
  changeOwnPassword: (
    accountId: string,
    password: string,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  clear: () => void
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
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  resetManagedPassword: (
    actorId: string,
    id: string,
    password: string,
    requireChange?: boolean,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  createManagedRole: (
    actorId: string,
    input: CreateManagedRoleInput,
  ) => Promise<{ role: ManagedRole } | { problems: FieldProblem[] }>
  updateManagedRole: (
    actorId: string,
    roleId: AccountRole,
    patch: Pick<ManagedRole, 'label' | 'description'>,
  ) => Promise<{ role: ManagedRole } | { problems: FieldProblem[] }>
  deleteManagedRole: (
    actorId: string,
    roleId: AccountRole,
  ) => Promise<{ roleId: AccountRole } | { problems: FieldProblem[] }>
  updateManagedRolePermissions: (
    actorId: string,
    role: AccountRole,
    permissions: Permission[],
  ) => Promise<{ permissions: Permission[] } | { problems: FieldProblem[] }>
  terminateManagedSession: (
    actorId: string,
    sessionId: string,
  ) => { session: ActiveSession } | { problems: FieldProblem[] }
}

/**
 * Memoised so React StrictMode's double mount (and any caller) restores the
 * session once. The auth-state listener is attached once for the same reason.
 */
let initPromise: Promise<void> | null = null
let authListenerAttached = false

export const useAuthStore = create<AuthState>()((set, get) => ({
  accounts: [],
  currentAccountId: null,
  activeSessionId: null,
  initializing: true,

  initialize: () => {
    initPromise ??= (async () => {
      try {
        const client = getSupabase()
        if (!authListenerAttached) {
          authListenerAttached = true
          client.auth.onAuthStateChange((event, session) => {
            // Sign-in is handled explicitly so a disabled profile never flashes
            // the shell; here we only need to react to a session going away
            // (sign-out, token revocation, or another tab signing out).
            if (event === 'SIGNED_OUT' || !session) {
              set({ currentAccountId: null, activeSessionId: null })
            }
          })
        }
        const { data } = await client.auth.getSession()
        await get().refreshAccounts()
        set({
          currentAccountId: data.session?.user.id ?? null,
          initializing: false,
        })
      } catch (cause) {
        console.error('Supabase auth initialisation failed:', cause)
        set({ initializing: false })
      }
    })()
    return initPromise
  },

  refreshAccounts: async () => {
    const client = getSupabase()
    const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS)
    if (error) throw error
    set({ accounts: (data as ProfileRow[] | null)?.map(profileToAccount) ?? [] })
  },

  signIn: async (identifier, password) => {
    const browser = browserContext()
    const normalized = normalizeUsername(identifier)
    try {
      const client = getSupabase()
      const email = await resolveSignInAddress(identifier, async (username) => {
        const { data, error } = await client.rpc('resolve_login_email', {
          p_username: username,
        })
        if (error) {
          console.error('resolve_login_email failed:', error)
          return null
        }
        return typeof data === 'string' ? data : null
      })
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      })
      if (error || !data.user) {
        recordFailedLogin(normalized, browser)
        return {
          problems: [
            { field: 'form', message: 'That username/email and password do not match.' },
          ],
        }
      }

      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile) {
        await client.auth.signOut()
        recordFailedLogin(normalized, browser)
        return {
          problems: [
            {
              field: 'form',
              message: 'Your account is not set up yet. Contact an administrator.',
            },
          ],
        }
      }

      const account = profileToAccount(profile as ProfileRow)
      if ((account.status ?? 'active') !== 'active') {
        await client.auth.signOut()
        recordFailedLogin(normalized, browser)
        return {
          problems: [
            { field: 'form', message: 'That username/email and password do not match.' },
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
      const signedIn: Account = { ...account, lastLoginAt: now }
      set((state) => ({
        accounts: upsertAccount(state.accounts, signedIn),
        currentAccountId: account.id,
        activeSessionId: sessionId,
      }))
      return { account: signedIn }
    } catch (cause) {
      console.error('Sign-in failed:', cause)
      recordFailedLogin(normalized, browser)
      return {
        problems: [
          {
            field: 'form',
            message: 'Could not reach the server. Check your connection and try again.',
          },
        ],
      }
    }
  },

  signOut: () => {
    const sessionId = get().activeSessionId
    if (sessionId) useAdminStore.getState().endSession(sessionId)
    try {
      void getSupabase().auth.signOut()
    } catch (cause) {
      console.error(cause)
    }
    set({ currentAccountId: null, activeSessionId: null })
  },

  currentAccount: () => {
    const { accounts, currentAccountId } = get()
    if (!currentAccountId) return null
    const account = accounts.find((candidate) => candidate.id === currentAccountId)
    return account && (account.status ?? 'active') === 'active' ? account : null
  },

  changeOwnPassword: async (accountId, password) => {
    const account = get().accounts.find((candidate) => candidate.id === accountId)
    if (
      accountId !== get().currentAccountId ||
      !account ||
      (account.status ?? 'active') !== 'active'
    ) {
      return {
        problems: [
          { field: 'form', message: 'Sign in to change this account password.' },
        ],
      }
    }
    const passwordProblem = validatePassword(password)
    if (passwordProblem) {
      return { problems: [{ field: 'password', message: passwordProblem }] }
    }
    try {
      const client = getSupabase()
      const { error } = await client.auth.updateUser({ password })
      if (error) {
        return { problems: [{ field: 'password', message: error.message }] }
      }
      // Clear the "must change password" flag server-side. RLS blocks direct
      // profile writes, so this goes through a narrow security-definer RPC.
      const { error: flagError } = await client.rpc('mark_password_changed')
      if (flagError) console.error('mark_password_changed failed:', flagError)
    } catch (cause) {
      console.error('Password change failed:', cause)
      return {
        problems: [
          {
            field: 'form',
            message: 'Could not change the password. Check your connection and try again.',
          },
        ],
      }
    }
    const updated: Account = { ...account, mustChangePassword: false }
    set((state) => ({
      accounts: state.accounts.map((candidate) =>
        candidate.id === accountId ? updated : candidate,
      ),
    }))
    addAudit(account, 'Changed Account Password', account)
    return { account: updated }
  },

  clear: () => set({ accounts: [], currentAccountId: null, activeSessionId: null }),

  // --- Phase 5 server-backed administration ---------------------------------

  createManagedAccount: async (actorId, input) => {
    const usernameProblem = validateUsername(input.username)
    if (usernameProblem) {
      return { problems: [{ field: 'username', message: usernameProblem }] }
    }
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim()
    const nameProblem = validateFullName(fullName)
    if (nameProblem) {
      return { problems: [{ field: 'fullName', message: nameProblem }] }
    }
    const passwordProblem = validatePassword(input.password)
    if (passwordProblem) {
      return { problems: [{ field: 'password', message: passwordProblem }] }
    }
    try {
      const { accountId } = await createUser({
        username: normalizeUsername(input.username),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        password: input.password,
        role: input.role,
        customPermissions: input.customPermissions,
      })
      await get().refreshAccounts()
      const account = get().accounts.find((candidate) => candidate.id === accountId)
      if (!account) {
        return {
          problems: [
            {
              field: 'form',
              message: 'The account was created but is not visible yet. Reload to see it.',
            },
          ],
        }
      }
      addAudit(actor(actorId), 'Created User Account', account, `@${account.username} created`)
      return { account }
    } catch (cause) {
      console.error('Create account failed:', cause)
      return { problems: problemsFrom(cause, 'Could not create the account.') }
    }
  },

  updateManagedAccount: async (actorId, id, patch) => {
    const current = get().accounts.find((candidate) => candidate.id === id)
    if (!current) {
      return { problems: [{ field: 'form', message: 'That account no longer exists.' }] }
    }
    const fullName =
      patch.fullName ??
      ([patch.firstName ?? current.firstName, patch.lastName ?? current.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
        current.fullName)
    try {
      if (patch.status !== undefined) {
        await setAccountStatus(id, patch.status, patch.statusReason ?? '')
      }
      await updateAccountMetadata({
        userId: id,
        fullName,
        email: patch.email ?? current.email ?? '',
        role: patch.role ?? current.role,
        customPermissions:
          patch.customPermissions !== undefined
            ? patch.customPermissions
            : current.customPermissions ?? null,
      })
      await get().refreshAccounts()
      const account = get().accounts.find((candidate) => candidate.id === id) ?? current
      addAudit(
        actor(actorId),
        patch.status !== undefined ? `Set Account ${patch.status}` : 'Updated User Account',
        account,
        `@${account.username} updated`,
      )
      return { account }
    } catch (cause) {
      console.error('Update account failed:', cause)
      return { problems: problemsFrom(cause, 'Could not update the account.') }
    }
  },

  resetManagedPassword: async (actorId, id, password, requireChange = true) => {
    const passwordProblem = validatePassword(password)
    if (passwordProblem) {
      return { problems: [{ field: 'password', message: passwordProblem }] }
    }
    try {
      await resetUserPassword(id, password, requireChange)
      const account = get().accounts.find((candidate) => candidate.id === id)
      if (account) addAudit(actor(actorId), 'Reset Account Password', account)
      return account ? { account } : { problems: problemsFrom(null, 'Account not found.') }
    } catch (cause) {
      console.error('Reset password failed:', cause)
      return { problems: problemsFrom(cause, 'Could not reset the password.') }
    }
  },

  createManagedRole: async (actorId, input) => {
    try {
      const row = await createRole(input.label, input.description, input.permissions)
      await useAdminStore.getState().refreshRoles()
      addAudit(actor(actorId), 'Created Role', undefined, `Role ${row.label} created`, 'Roles')
      return { role: { id: row.id, label: row.label, description: row.description } }
    } catch (cause) {
      console.error('Create role failed:', cause)
      return { problems: problemsFrom(cause, 'Could not create the role.') }
    }
  },

  updateManagedRole: async (actorId, roleId, patch) => {
    try {
      const row = await updateRole(roleId, patch.label, patch.description)
      await useAdminStore.getState().refreshRoles()
      addAudit(actor(actorId), 'Updated Role', undefined, `Role ${row.label} updated`, 'Roles')
      return { role: { id: row.id, label: row.label, description: row.description } }
    } catch (cause) {
      console.error('Update role failed:', cause)
      return { problems: problemsFrom(cause, 'Could not update the role.') }
    }
  },

  deleteManagedRole: async (actorId, roleId) => {
    try {
      await deleteRole(roleId)
      await useAdminStore.getState().refreshRoles()
      addAudit(actor(actorId), 'Deleted Role', undefined, `Role ${roleId} deleted`, 'Roles')
      return { roleId }
    } catch (cause) {
      console.error('Delete role failed:', cause)
      return { problems: problemsFrom(cause, 'Could not delete the role.') }
    }
  },

  updateManagedRolePermissions: async (actorId, role, permissions) => {
    try {
      const saved = await setRolePermissions(role, permissions)
      await useAdminStore.getState().refreshRoles()
      addAudit(actor(actorId), 'Updated Role Permissions', undefined, `Role ${role}`, 'Roles')
      return { permissions: saved }
    } catch (cause) {
      console.error('Update role permissions failed:', cause)
      return { problems: problemsFrom(cause, 'Could not update the role permissions.') }
    }
  },

  terminateManagedSession: (_actorId, _sessionId) => ({
    problems: sessionsDeferredProblem,
  }),
}))
