import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  Account,
  AccountRole,
  Permission,
} from '@/core/types/auth'
import type { Database } from '@/lib/database.types'
import type { ActiveSession, ManagedRole } from '@/core/types/admin'
import { ADMIN_ONLY_PERMISSIONS, ACCOUNT_ROLES } from '@/lib/rbac'
import { validatePassword, type FieldProblem } from '@/lib/credentials'
import {
  currentUserAgent,
  profileToAccount,
  usernameToEmail,
} from '@/lib/accountMapping'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAdminStore } from '@/store/adminStore'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

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

const credentialsProblem: FieldProblem[] = [
  { field: 'form', message: 'That username and password do not match.' },
]

const configProblem: FieldProblem[] = [
  { field: 'form', message: 'This installation is not connected to its server yet.' },
]

/** Extracts the `{ error }` payload an Edge Function returns on failure. */
async function functionErrorMessage(error: unknown): Promise<string> {
  const fallback = (error as { message?: string })?.message ?? 'The request failed.'
  const context = (error as { context?: Response })?.context
  if (context && typeof context.json === 'function') {
    try {
      const payload = (await context.json()) as { error?: string }
      if (typeof payload?.error === 'string' && payload.error) return payload.error
    } catch {
      // Body was not JSON; keep the generic message.
    }
  }
  return fallback
}

async function invokeFunction<T>(
  name: string,
  body: unknown,
): Promise<{ data: T } | { problems: FieldProblem[] }> {
  const { data, error } = await getSupabase().functions.invoke<T>(name, {
    body: body as Record<string, unknown>,
  })
  if (error) {
    return { problems: [{ field: 'form', message: await functionErrorMessage(error) }] }
  }
  return { data: data as T }
}

async function fetchProfile(id: string): Promise<Account | null> {
  const { data } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle<ProfileRow>()
  return data ? profileToAccount(data) : null
}

interface AuthState {
  accounts: Account[]
  currentAccountId: string | null
  /** False until the session restore on boot completes; gates the first paint. */
  ready: boolean
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
  changeOwnPassword: (
    password: string,
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
  ) => Promise<{ session: ActiveSession } | { problems: FieldProblem[] }>
  signIn: (
    username: string,
    password: string,
  ) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  signOut: () => void
  factoryReset: () => Promise<{ ok: true } | { problems: FieldProblem[] }>
  currentAccount: () => Account | null
  refresh: () => Promise<void>
  bootstrap: () => Promise<void>
  clear: () => void
  seedDefaultAdmin: () => Promise<Account | null>
}

/**
 * Memoised at module scope so the startup seed never races itself (React
 * StrictMode mounts twice in dev). The seed itself is idempotent server-side.
 */
let defaultAdminSeed: Promise<Account | null> | null = null
let authListenerAttached = false

function roleExists(role: AccountRole): boolean {
  return (
    ACCOUNT_ROLES.some((item) => item.id === role) ||
    useAdminStore.getState().customRoles.some((item) => item.id === role)
  )
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  accounts: [],
  currentAccountId: null,
  ready: false,

  bootstrap: async () => {
    if (!isSupabaseConfigured) {
      set({ ready: true })
      return
    }
    const supabase = getSupabase()
    try {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      if (user) {
        set({ currentAccountId: user.id })
        await get().refresh()
        const account = get().accounts.find((item) => item.id === user.id)
        if (!account || account.status !== 'active') {
          set({ accounts: [], currentAccountId: null })
          void supabase.auth.signOut()
        }
      } else {
        set({ ready: true })
      }
    } catch (cause) {
      // A network failure restoring the session must not strand the first
      // paint; fall through to the sign-in screen instead.
      console.error('Could not restore the session:', cause)
      set({ ready: true })
    }
    if (!authListenerAttached) {
      authListenerAttached = true
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          set({ accounts: [], currentAccountId: null, ready: true })
          useAdminStore.getState().clear()
        }
      })
    }
  },

  refresh: async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data } = await getSupabase()
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      set({
        accounts: (data ?? []).map(profileToAccount),
        ready: true,
      })
      await useAdminStore.getState().refresh()
    } catch (cause) {
      console.error('Could not refresh accounts:', cause)
      set({ ready: true })
    }
  },

  signIn: async (username, password) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const supabase = getSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    if (error || !data.user) {
      void supabase.rpc('record_login_failed', {
        p_username: username.trim().toLowerCase(),
        p_device: currentUserAgent(),
      })
      return { problems: credentialsProblem }
    }
    const account = await fetchProfile(data.user.id)
    if (!account || account.status !== 'active') {
      await supabase.auth.signOut()
      void supabase.rpc('record_login_failed', {
        p_username: username.trim().toLowerCase(),
        p_device: currentUserAgent(),
      })
      return { problems: credentialsProblem }
    }
    await supabase.rpc('record_login', { p_device: currentUserAgent() })
    set({ currentAccountId: account.id })
    await get().refresh()
    return {
      account: get().accounts.find((item) => item.id === account.id) ?? account,
    }
  },

  signOut: () => {
    set({ accounts: [], currentAccountId: null })
    useAdminStore.getState().clear()
    if (isSupabaseConfigured) void getSupabase().auth.signOut()
  },

  factoryReset: async () => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const { error } = await getSupabase().functions.invoke('admin-reset-workspace', {
      body: {},
    })
    if (error) return { problems: [{ field: 'form', message: await functionErrorMessage(error) }] }
    return { ok: true }
  },

  changeOwnPassword: async (password) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const passwordProblem = validatePassword(password)
    if (passwordProblem) {
      return { problems: [{ field: 'password', message: passwordProblem }] }
    }
    const supabase = getSupabase()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { problems: [{ field: 'password', message: error.message }] }
    await supabase.rpc('complete_password_change')
    await get().refresh()
    const account = get().accounts.find((item) => item.id === get().currentAccountId)
    return account ? { account } : { problems: credentialsProblem }
  },

  createManagedAccount: async (_actorId, input) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const result = await invokeFunction<{ profile: ProfileRow }>(
      'admin-create-user',
      input,
    )
    if ('problems' in result) return result
    await get().refresh()
    return { account: profileToAccount(result.data.profile) }
  },

  updateManagedAccount: async (_actorId, id, patch) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const result = await invokeFunction<{ profile: ProfileRow }>(
      'admin-update-user',
      { id, patch },
    )
    if ('problems' in result) return result
    await get().refresh()
    return { account: profileToAccount(result.data.profile) }
  },

  resetManagedPassword: async (_actorId, id, password, requireChange = true) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const passwordProblem = validatePassword(password)
    if (passwordProblem) {
      return { problems: [{ field: 'password', message: passwordProblem }] }
    }
    const result = await invokeFunction<{ profile: ProfileRow }>(
      'admin-reset-password',
      { id, password, requireChange },
    )
    if ('problems' in result) return result
    await get().refresh()
    return { account: profileToAccount(result.data.profile) }
  },

  createManagedRole: async (_actorId, input) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const label = input.label.trim()
    const description = input.description.trim()
    if (!label || label.length > 48) {
      return {
        problems: [{ field: 'form', message: 'Enter a role name up to 48 characters.' }],
      }
    }
    if (description.length > 160) {
      return {
        problems: [{ field: 'form', message: 'Keep the role description under 160 characters.' }],
      }
    }
    const roles = [...ACCOUNT_ROLES, ...useAdminStore.getState().customRoles]
    if (roles.some((role) => role.label.toLowerCase() === label.toLowerCase())) {
      return {
        problems: [{ field: 'form', message: 'A role with that name already exists.' }],
      }
    }
    const supabase = getSupabase()
    const id = `custom-${nanoid()}`
    const { error } = await supabase
      .from('roles')
      .insert({ id, label, description, is_system: false })
    if (error) return { problems: [{ field: 'form', message: error.message }] }
    const permissions = [...new Set(input.permissions)].filter(
      (permission) => !ADMIN_ONLY_PERMISSIONS.includes(permission),
    )
    if (permissions.length > 0) {
      const { error: permissionError } = await supabase
        .from('role_permissions')
        .insert(permissions.map((permission) => ({ role_id: id, permission })))
      if (permissionError) {
        return { problems: [{ field: 'form', message: permissionError.message }] }
      }
    }
    await get().refresh()
    return { role: { id, label, description } }
  },

  updateManagedRole: async (_actorId, roleId, patch) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    const role = useAdminStore.getState().customRoles.find((item) => item.id === roleId)
    if (!role) {
      return {
        problems: [{ field: 'form', message: 'Only custom roles can be edited here.' }],
      }
    }
    const label = patch.label.trim()
    const description = patch.description.trim()
    if (!label || label.length > 48) {
      return {
        problems: [{ field: 'form', message: 'Enter a role name up to 48 characters.' }],
      }
    }
    if (description.length > 160) {
      return {
        problems: [{ field: 'form', message: 'Keep the role description under 160 characters.' }],
      }
    }
    const roles = [...ACCOUNT_ROLES, ...useAdminStore.getState().customRoles]
    if (
      roles.some(
        (item) => item.id !== roleId && item.label.toLowerCase() === label.toLowerCase(),
      )
    ) {
      return {
        problems: [{ field: 'form', message: 'A role with that name already exists.' }],
      }
    }
    const { error } = await getSupabase()
      .from('roles')
      .update({ label, description })
      .eq('id', roleId)
      .eq('is_system', false)
    if (error) return { problems: [{ field: 'form', message: error.message }] }
    await get().refresh()
    return { role: { id: roleId, label, description } }
  },

  deleteManagedRole: async (_actorId, roleId) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
    if (roleId === 'admin') {
      return {
        problems: [{ field: 'form', message: 'The Admin role cannot be deleted.' }],
      }
    }
    const role = useAdminStore.getState().customRoles.find((item) => item.id === roleId)
    if (!role) {
      return {
        problems: [{ field: 'form', message: 'The selected role no longer exists.' }],
      }
    }
    if (get().accounts.some((account) => account.role === roleId)) {
      return {
        problems: [{ field: 'form', message: 'Reassign all users before deleting this role.' }],
      }
    }
    const { error } = await getSupabase()
      .from('roles')
      .delete()
      .eq('id', roleId)
      .eq('is_system', false)
    if (error) return { problems: [{ field: 'form', message: error.message }] }
    await get().refresh()
    return { roleId }
  },

  updateManagedRolePermissions: async (_actorId, role, permissions) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
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
    if (!roleExists(role)) {
      return {
        problems: [{ field: 'form', message: 'The selected role no longer exists.' }],
      }
    }
    const supabase = getSupabase()
    const next = [...new Set(permissions)].filter(
      (permission) => !ADMIN_ONLY_PERMISSIONS.includes(permission),
    )
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', role)
    if (deleteError) {
      return { problems: [{ field: 'form', message: deleteError.message }] }
    }
    if (next.length > 0) {
      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(next.map((permission) => ({ role_id: role, permission })))
      if (insertError) {
        return { problems: [{ field: 'form', message: insertError.message }] }
      }
    }
    await get().refresh()
    return { permissions: next }
  },

  terminateManagedSession: async (_actorId, sessionId) => {
    if (!isSupabaseConfigured) return { problems: configProblem }
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
    const { error } = await getSupabase().rpc('admin_terminate_session', {
      p_session_id: sessionId,
    })
    if (error) return { problems: [{ field: 'form', message: error.message }] }
    await useAdminStore.getState().refresh()
    return { session }
  },

  currentAccount: () => {
    const { accounts, currentAccountId } = get()
    if (!currentAccountId) return null
    const account = accounts.find((item) => item.id === currentAccountId)
    return account && (account.status ?? 'active') === 'active' ? account : null
  },

  clear: () => set({ accounts: [], currentAccountId: null }),

  seedDefaultAdmin: async () => {
    if (!isSupabaseConfigured) return null
    defaultAdminSeed ??= (async () => {
      try {
        await getSupabase().functions.invoke('seed-default-admin', { body: {} })
      } catch (cause) {
        console.error('Could not seed the default Admin:', cause)
      }
      return null
    })()
    return defaultAdminSeed
  },
}))
