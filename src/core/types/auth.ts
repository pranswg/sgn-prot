/**
 * Account types for the signed-in user and the Administration screens.
 *
 * Accounts now live in Supabase Auth + the `profiles` table; the password
 * digest fields below are vestigial from the old browser-local sign-in and are
 * always absent on a server-backed account. Nothing new should populate them.
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
  /** Legacy local digest; absent on Supabase-backed accounts. */
  passwordHash?: string
  /** Legacy local salt; absent on Supabase-backed accounts. */
  passwordSalt?: string
  /** Legacy marker for which KDF produced `passwordHash`. */
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