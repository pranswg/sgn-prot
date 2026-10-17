import type { Account, AccountStatus, Permission } from '@/core/types/auth'

/**
 * Pure mapping between the app's `Account` view and the Supabase `profiles` row.
 * Kept free of React and of the Supabase client so it can be tested under
 * `node:test`, exactly like `credentials.ts` was before the auth swap.
 *
 * Login accepts a username or an email, but Supabase Auth keys on an email. A
 * username resolves through `resolveSignInAddress`, because an account an admin
 * created with the Create User form's Email field carries that real address as
 * its Auth identity rather than a synthetic `<username>@choir.local` one; that
 * synthetic form is still the fallback, and the seeded backstop Admin uses it
 * (`admin@choir.local`).
 */
export const AUTH_EMAIL_DOMAIN = 'choir.local'

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`
}

export function emailToUsername(email: string | null | undefined): string {
  if (!email) return ''
  return email.split('@')[0] ?? ''
}

export function isEmail(input: string): boolean {
  const trimmed = input.trim()
  return trimmed.includes('@')
}

export function resolveSignInEmail(input: string): string {
  const trimmed = input.trim().toLowerCase()
  return isEmail(trimmed) ? trimmed : usernameToEmail(trimmed)
}

/**
 * Resolves a sign-in identifier to the address Supabase Auth should check.
 * An email is used as typed. A username asks `lookup` for the account's Auth
 * address (the Create User form's Email field becomes the GoTrue identity, so it
 * need not be the synthetic address) and falls back to the synthetic
 * `<username>@choir.local` when the lookup finds nothing — no such account, or
 * the lookup itself failed.
 */
export async function resolveSignInAddress(
  input: string,
  lookup: (username: string) => Promise<string | null>,
): Promise<string> {
  const trimmed = input.trim()
  if (isEmail(trimmed)) return resolveSignInEmail(trimmed)
  const stored = await lookup(trimmed)
  return stored?.trim() ? stored.trim().toLowerCase() : resolveSignInEmail(trimmed)
}

/** The columns the client reads from `public.profiles`. */
export interface ProfileRow {
  id: string
  username: string
  full_name: string
  email: string | null
  role: string
  custom_permissions: string[] | null
  status: string
  must_change_password: boolean
  created_at: string
  updated_at?: string
}

const ACCOUNT_STATUSES: AccountStatus[] = [
  'active',
  'disabled',
  'suspended',
  'pending-activation',
]

export function toAccountStatus(value: string | null | undefined): AccountStatus {
  return ACCOUNT_STATUSES.includes(value as AccountStatus)
    ? (value as AccountStatus)
    : 'active'
}

export function nameParts(
  account: Pick<Account, 'fullName'> & Partial<Pick<Account, 'firstName' | 'lastName'>>,
): { firstName: string; lastName: string } {
  const firstName = account.firstName?.trim()
  const lastName = account.lastName?.trim()
  if (firstName || lastName) {
    return { firstName: firstName ?? '', lastName: lastName ?? '' }
  }
  const parts = account.fullName.trim().split(/\s+/)
  return {
    firstName: parts.slice(0, -1).join(' ') || parts[0] || '',
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
  }
}

export function profileToAccount(row: ProfileRow): Account {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    ...nameParts({ fullName: row.full_name }),
    role: row.role,
    status: toAccountStatus(row.status),
    email: row.email ?? undefined,
    customPermissions: (row.custom_permissions ?? null) as Permission[] | null,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
  }
}
