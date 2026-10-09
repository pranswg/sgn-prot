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

import type {
  Account,
  AccountRole,
  NewAccountInput,
  PasswordHashAlgo,
} from '@/core/types/auth'

/**
 * Iteration count for PBKDF2-SHA256. High enough to make an offline guess
 * expensive, low enough that a login does not feel slow on a modest phone
 * (~100ms on current hardware). Do not lower this to "speed up" login.
 */
const PBKDF2_ITERATIONS = 210_000

/**
 * Rounds for the `simplified` fallback KDF. Pure-JS SHA-256 is far slower per
 * round than WebCrypto, so this is an order of magnitude fewer than PBKDF2 —
 * enough to avoid a bare digest while keeping login under a few hundred ms.
 */
const SIMPLIFIED_ITERATIONS = 20_000

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

/**
 * WebCrypto's `subtle` (and therefore PBKDF2) exists only on secure origins —
 * https or localhost. A phone loading the dev server over plain http on the
 * LAN has no `crypto.subtle`, and every hashing call would throw. That is the
 * origin of the old "Could not process the password on this browser" toast.
 */
function subtleAvailable(): boolean {
  return (
    typeof globalThis.crypto?.subtle?.importKey === 'function'
  )
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/**
 * Pure-JS SHA-256, exported so tests can pin it against the published test
 * vectors. It exists only for the `simplified` fallback KDF below; every
 * secure origin still goes through WebCrypto's PBKDF2.
 */
export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input)
  const bitLen = bytes.length * 8
  const totalLen = Math.ceil((bytes.length + 9) / 64) * 64
  const data = new Uint8Array(totalLen)
  data.set(bytes)
  data[bytes.length] = 0x80
  const view = new DataView(data.buffer)
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000))
  view.setUint32(totalLen - 4, bitLen >>> 0)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19
  const w = new Uint32Array(64)

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15]
      const y = w[i - 2]
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7
    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + s1 + ch + SHA256_K[i] + w[i]) | 0
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + maj) | 0
      h = g
      g = f
      f = e
      e = (d + t1) | 0
      d = c
      c = b
      b = a
      a = (t1 + t2) | 0
    }
    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
    h5 = (h5 + f) | 0
    h6 = (h6 + g) | 0
    h7 = (h7 + h) | 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
    .join('')
}

/**
 * Fallback KDF for origins without `crypto.subtle`: repeated SHA-256 over the
 * password, salt, and round counter. Deterministic, salted, and far from
 * state-of-the-art — but the same honest trade-off as the rest of this store:
 * it keeps plaintext out of `localStorage`, not out of a determined attacker's
 * reach.
 */
async function simplifiedHex(password: string, saltHex: string): Promise<string> {
  let state = sha256Hex(`${password}:${saltHex}:0`)
  for (let i = 1; i < SIMPLIFIED_ITERATIONS; i++) {
    state = sha256Hex(`${state}:${password}:${saltHex}`)
  }
  return state
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
 * Returns the digest, the fresh salt that produced it, and which KDF was
 * used. The caller stores all three; neither digest nor salt can be derived
 * from the other.
 *
 * PBKDF2 on secure origins, the iterated-SHA-256 fallback elsewhere. Pass
 * `algo` to force a path (used by tests).
 */
export async function hashPassword(
  password: string,
  algo?: PasswordHashAlgo,
): Promise<{
  passwordHash: string
  passwordSalt: string
  hashAlgo: PasswordHashAlgo
}> {
  const passwordSalt = randomSaltHex()
  const hashAlgo: PasswordHashAlgo =
    algo ?? (subtleAvailable() ? 'pbkdf2' : 'simplified')
  const passwordHash =
    hashAlgo === 'simplified'
      ? await simplifiedHex(password, passwordSalt)
      : await pbkdf2Hex(password, passwordSalt)
  return { passwordHash, passwordSalt, hashAlgo }
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
  account: Pick<Account, 'passwordHash' | 'passwordSalt' | 'hashAlgo'>,
): Promise<boolean> {
  if (!account.passwordHash || !account.passwordSalt) return false
  const algo = account.hashAlgo ?? 'pbkdf2'
  // A pbkdf2 digest cannot be recomputed without `subtle`. Failing closed
  // beats comparing against the fallback digest, which would never match.
  if (algo === 'pbkdf2' && !subtleAvailable()) return false
  const candidate =
    algo === 'simplified'
      ? await simplifiedHex(password, account.passwordSalt)
      : await pbkdf2Hex(password, account.passwordSalt)
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
 * Whether any active Admin exists. The default-admin seed in `authStore` runs
 * whenever this is false, so a fresh browser (or one whose admins were all
 * disabled) always has a known login, while a real multi-account setup never
 * gets a surprise seed.
 */
export function hasActiveAdmin(accounts: Account[]): boolean {
  return accounts.some(
    (account) =>
      account.role === 'admin' && (account.status ?? 'active') === 'active',
  )
}

/**
 * Only the initial setup account is an Admin. Later accounts need an
 * Administrator-created role before they can receive system permissions.
 */
export function roleForNewAccount(
  existingAccounts: Account[],
): AccountRole {
  return existingAccounts.length === 0 ? 'admin' : ''
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