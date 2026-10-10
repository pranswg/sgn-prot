/**
 * Account types for the sign-in gate.
 *
 * Accounts are backed by Supabase Auth and the `public.profiles` table. The app
 * keeps a read-only `Account` cache of those profiles; passwords never reach
 * the client, so the password fields below are vestigial from the local-only
 * era and are only still produced by `credentials.ts`'s now-unused hashing
 * helpers pending cleanup.
 */

/** Role IDs are strings so Admin-created roles can be persisted and assigned. */
export type AccountRole = string

export type AccountStatus =
  | 'active'
  | 'disabled'
  | 'suspended'
  | 'pending-activation'

export type Permission =
  | 'view-dashboard'
  | 'view-master-list'
  | 'add-members'
  | 'edit-members'
  | 'delete-members'
  | 'manage-trainees'
  | 'view-suguan'
  | 'create-suguan'
  | 'edit-suguan'
  | 'assign-members'
  | 'delete-suguan'
  | 'export-documents'
  | 'manage-users'
  | 'manage-roles'
  | 'view-audit-logs'
  | 'change-settings'
  | 'restore-data'
  | 'view-login-history'
  | 'manage-sessions'
  | 'manage-membership-history'

/**
 * Which KDF produced `passwordHash`. `pbkdf2` needs WebCrypto's `subtle`, which
 * browsers expose only on secure origins (https or localhost); `simplified` is
 * the iterated-SHA-256 fallback used on insecure origins such as a phone
 * loading the dev server over plain http on the LAN. Verification must use the
 * same algorithm that produced the stored digest.
 */
export type PasswordHashAlgo = 'pbkdf2' | 'simplified'

export interface Account {
  id: string
  /** Lower-cased, trimmed. The login key, so it must stay unique. */
  username: string
  /** As typed at registration. Display only; never used to log in. */
  fullName: string
  /** Lower-case hex digest. Never a plaintext password. Unset for server accounts. */
  passwordHash?: string
  /** Lower-case hex salt, unique per account. Unset for server accounts. */
  passwordSalt?: string
  /** How `passwordHash` was produced; assumed `pbkdf2` when absent. */
  hashAlgo?: PasswordHashAlgo
  role: AccountRole
  status?: AccountStatus
  email?: string
  firstName?: string
  lastName?: string
  customPermissions?: Permission[] | null
  mustChangePassword?: boolean
  statusReason?: string
  createdAt: string
  lastLoginAt?: string
}

/** The shape accepted from a registration form, before it becomes an Account. */
export interface NewAccountInput {
  username: string
  fullName: string
  password: string
  confirmPassword: string
}