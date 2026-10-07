/**
 * Account types for the local sign-in gate.
 *
 * There is no server. Accounts live in `localStorage` under `choir-auth`, and a
 * password is only ever stored as a PBKDF2 digest plus its salt. That stops an
 * exported backup file from containing a plaintext password, but it is NOT
 * real security: anyone with devtools can read and rewrite the whole store.
 * Treat this as a way to keep the app's screens honest, not as protection.
 */

export type AccountRole =
  | 'admin'
  | 'suguan-manager'
  | 'choir-manager'
  | 'viewer'

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
  /** Lower-case hex digest. Never a plaintext password. */
  passwordHash: string
  /** Lower-case hex salt, unique per account. */
  passwordSalt: string
  /** How `passwordHash` was produced; assumed `pbkdf2` when absent. */
  hashAlgo?: PasswordHashAlgo
  role: AccountRole
  status?: AccountStatus
  email?: string
  firstName?: string
  lastName?: string
  customPermissions?: Permission[] | null
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