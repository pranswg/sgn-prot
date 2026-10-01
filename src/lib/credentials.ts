/**
 * Pure credential logic for the local sign-in gate.
 *
 * Everything here is deliberately free of React and of `localStorage` so it can
 * be tested under `node:test`. The store in `src/store/authStore.ts` owns
 * persistence; this module owns normalisation, validation, and hashing.
 *
 * Security caveat: PBKDF2 keeps plaintext passwords out of the backup file, but
 * the salt and digest are both in `localStorage` on the user's own machine. This
 * is not a substitute for server-side auth.
 */

import type { Account, AccountRole, NewAccountInput } from '@/core/types/auth'

/**
 * Iteration count for PBKDF2-SHA256. High enough to make an offline guess
 * expensive, low enough that a login does not feel slow on a modest phone
 * (~100ms on current hardware). Do not lower this to "speed up" login.
 */
const PBKDF2_ITERATIONS = 210_000

const SALT_BYTES = 16
const USERNAME_MIN = 3
const USERNAME_MAX = 24
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

export interface FieldProblem {
  field: 'username' | 'fullName' | 'password' | 'confirmPassword' | 'form'
  message: string
}

/**
 * Lower-cases and trims a username so `  Maria ` and `maria` are one account.
 * Kept separate from validation so the store can look up by the same key it
 * stored under, otherwise a trailing space creates a duplicate account.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidUsernameKey(value: string): boolean {
  return value.length > 0 && value.length <= USERNAME_MAX
}

/**
 * A username must survive being typed on a phone keyboard without autocomplete
 * mangling it, so letters, digits, dot, dash, underscore, and at-sign only.
 * Spaces are rejected because `normalizeUsername` would strip them and two
 * different inputs would then collide.
 */
export function validateUsername(raw: string): string | null {
  const value = normalizeUsername(raw)
  if (!value) return 'Choose a username.'
  if (value.length < USERNAME_MIN) {
    return `Use at least ${USERNAME_MIN} characters for your username.`
  }
  if (value.length > USERNAME_MAX) {
    return `Keep your username under ${USERNAME_MAX} characters.`
  }
  if (!/^[a-z0-9._@-]+$/.test(value)) {
    return 'Use letters, numbers, and only . _ - @ in your username.'
  }
  return null
}

export function validateFullName(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Enter your full name.'
  if (value.length > 80) return 'Keep your name under 80 characters.'
  return null
}

/**
 * A length floor, a length ceiling, and a check against the single most
 * important weakness: a numeric-only password, which falls to a short brute
 * force no matter how long it is.
 */
export function validatePassword(raw: string): string | null {
  if (!raw) return 'Choose a password.'
  if (raw.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters for your password.`
  }
  if (raw.length > PASSWORD_MAX) {
    // PBKDF2 with SHA-256 ignores input past this many bytes anyway, so a longer
    // password would silently behave like a truncated one.
    return `Keep your password under ${PASSWORD_MAX} characters.`
  }
  if (/^[0-9]+$/.test(raw)) {
    return 'Do not use only numbers for your password.'
  }
  return null
}

export function validateConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (!confirmation) return 'Re-enter your password.'
  if (password !== confirmation) return 'The two passwords do not match.'
  return null
}

export function passwordStrengthProblems(raw: string): string[] {
  const problems: string[] = []
  if (raw.length < PASSWORD_MIN) {
    problems.push(`At least ${PASSWORD_MIN} characters`)
  }
  if (/^[0-9]+$/.test(raw)) {
    problems.push('Not only numbers')
  }
  if (!/[A-Za-z]/.test(raw) || !/[0-9]/.test(raw)) {
    problems.push('Mix letters and numbers')
  }
  return problems
}

/**
 * Validates a whole registration form at once so the page can render every
 * problem in one pass instead of re-validating on each keystroke and showing
 * half the messages before the user has finished typing.
 */
export function validateRegistration(input: NewAccountInput): FieldProblem[] {
  const problems: FieldProblem[] = []
  const username = validateUsername(input.username)
  if (username) problems.push({ field: 'username', message: username })
  const fullName = validateFullName(input.fullName)
  if (fullName) problems.push({ field: 'fullName', message: fullName })
  const password = validatePassword(input.password)
  if (password) problems.push({ field: 'password', message: password })
  else {
    // Only compare the two entries when the password itself is acceptable,
    // otherwise a too-short password produces two confusing messages.
    const confirmation = validateConfirmation(input.password, input.confirmPassword)
    if (confirmation) problems.push({ field: 'confirmPassword', message: confirmation })
  }
  return problems
}

function toHex(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

function randomSaltHex(): string {
  const salt = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(salt)
  return toHex(salt)
}

async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      // The stored salt is hex text; bytes vs. text only has to be consistent
      // between hashing and verifying, and both go through here.
      salt: encoder.encode(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return toHex(new Uint8Array(bits))
}

/**
 * Returns the digest and the fresh salt that produced it. The caller stores
 * both; neither can be derived from the other.
 */
export async function hashPassword(
  password: string,
): Promise<{ passwordHash: string; passwordSalt: string }> {
  const passwordSalt = randomSaltHex()
  const passwordHash = await pbkdf2Hex(password, passwordSalt)
  return { passwordHash, passwordSalt }
}

/**
 * Compares two hex strings without an early return, so the time taken does not
 * leak how many leading characters matched. Matters little here, but it is the
 * habit worth keeping.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function verifyPassword(
  password: string,
  account: Pick<Account, 'passwordHash' | 'passwordSalt'>,
): Promise<boolean> {
  if (!account.passwordHash || !account.passwordSalt) return false
  const candidate = await pbkdf2Hex(password, account.passwordSalt)
  return timingSafeEqualHex(candidate, account.passwordHash)
}

export function findAccountByUsername(
  accounts: Account[],
  rawUsername: string,
): Account | undefined {
  const key = normalizeUsername(rawUsername)
  return accounts.find((account) => account.username === key)
}

export function isUsernameTaken(
  accounts: Account[],
  rawUsername: string,
): boolean {
  return findAccountByUsername(accounts, rawUsername) !== undefined
}

/**
 * The first account to register becomes the admin, so a fresh install has
 * someone who can see that an admin exists rather than an all-`member` roster.
 * This only means "registered first", not a real authorisation check.
 */
export function roleForNewAccount(
  existingAccounts: Account[],
): AccountRole {
  return existingAccounts.length === 0 ? 'admin' : 'member'
}

/** Two-letter fallback used by the header avatar. */
export function initialsFor(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}