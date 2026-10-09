/**
 * Shared authentication helpers that are not Supabase calls.
 *
 * Login is handled by Supabase Auth, so the password hashing that used to live
 * here is gone. What remains is the pure validation the sign-in and
 * change-password screens render, plus the initials helper the avatars use.
 */

export interface FieldProblem {
  field: 'username' | 'fullName' | 'password' | 'confirmPassword' | 'form'
  message: string
}

const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

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
    return `Keep your password under ${PASSWORD_MAX} characters.`
  }
  if (/^[0-9]+$/.test(raw)) {
    return 'Do not use only numbers for your password.'
  }
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

export function initialsFor(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
