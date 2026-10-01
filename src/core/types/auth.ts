/**
 * Account types for the local sign-in gate.
 *
 * There is no server. Accounts live in `localStorage` under `choir-auth`, and a
 * password is only ever stored as a PBKDF2 digest plus its salt. That stops an
 * exported backup file from containing a plaintext password, but it is NOT
 * real security: anyone with devtools can read and rewrite the whole store.
 * Treat this as a way to keep the app's screens honest, not as protection.
 */

export type AccountRole = 'admin' | 'member'

export interface Account {
  id: string
  /** Lower-cased, trimmed. The login key, so it must stay unique. */
  username: string
  /** As typed at registration. Display only; never used to log in. */
  fullName: string
  /** Lower-case hex PBKDF2 digest. Never a plaintext password. */
  passwordHash: string
  /** Lower-case hex salt, unique per account. */
  passwordSalt: string
  role: AccountRole
  createdAt: string
}

/** The shape accepted from a registration form, before it becomes an Account. */
export interface NewAccountInput {
  username: string
  fullName: string
  password: string
  confirmPassword: string
}