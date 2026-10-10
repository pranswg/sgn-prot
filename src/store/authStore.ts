import { create } from 'zustand'
import type { Account, AccountRole, Permission } from '@/core/types/auth'
import { normalizeUsername, validatePassword, type FieldProblem } from '@/lib/credentials'
import { profileToAccount, resolveSignInEmail, type ProfileRow } from '@/lib/authIdentity'
import { getSupabase } from '@/lib/supabase'
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

const deferredProblem: FieldProblem[] = [
  {
    field: 'form',
    message:
      'User and role management are moving to the server and are temporarily unavailable.',
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
  ) => { account: Account } | { problems: FieldProblem[] }
  resetManagedPassword: (
    actorId: string,
    id: string,
    password: string,
    requireChange?: boolean,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  createManagedRole: (
    actorId: string,
    input: CreateManagedRoleInput,
  ) => { role: ManagedRole } | { problems: FieldProblem[] }
  updateManagedRole: (
    actorId: string,
    roleId: AccountRole,
    patch: Pick<ManagedRole, 'label' | 'description'>,
  ) => { role: ManagedRole } | { problems: FieldProblem[] }
  deleteManagedRole: (
    actorId: string,
    roleId: AccountRole,
  ) => { roleId: AccountRole } | { problems: FieldProblem[] }
  updateManagedRolePermissions: (
    actorId: string,
    role: AccountRole,
    permissions: Permission[],
  ) => { permissions: Permission[] } | { problems: FieldProblem[] }
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
    const email = resolveSignInEmail(identifier)
    try {
      const client = getSupabase()
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

  // --- Deferred until the Phase 5 server write path -------------------------

  createManagedAccount: (_actorId, _input) =>
    Promise.resolve({ problems: deferredProblem }),
  updateManagedAccount: (_actorId, _id, _patch) => ({ problems: deferredProblem }),
  resetManagedPassword: (_actorId, _id, _password, _requireChange) =>
    Promise.resolve({ problems: deferredProblem }),
  createManagedRole: (_actorId, _input) => ({ problems: deferredProblem }),
  updateManagedRole: (_actorId, _roleId, _patch) => ({ problems: deferredProblem }),
  deleteManagedRole: (_actorId, _roleId) => ({ problems: deferredProblem }),
  updateManagedRolePermissions: (_actorId, _role, _permissions) => ({
    problems: deferredProblem,
  }),
  terminateManagedSession: (_actorId, _sessionId) => ({ problems: deferredProblem }),
}))
