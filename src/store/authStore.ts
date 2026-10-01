import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Account, NewAccountInput } from '@/core/types/auth'
import {
  findAccountByUsername,
  hashPassword,
  isUsernameTaken,
  normalizeUsername,
  roleForNewAccount,
  validateRegistration,
  verifyPassword,
  type FieldProblem,
} from '@/lib/credentials'

interface AuthState {
  accounts: Account[]
  /** Id of the signed-in account, or null when signed out. */
  currentAccountId: string | null
  register: (input: NewAccountInput) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  signIn: (username: string, password: string) => Promise<{ account: Account } | { problems: FieldProblem[] }>
  signOut: () => void
  /** Re-reads the signed-in account. Returns null if the id no longer resolves. */
  currentAccount: () => Account | null
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentAccountId: null,

      register: async (input) => {
        const { accounts } = get()
        const problems = validateRegistration(input)
        if (problems.length > 0) return { problems }
        if (isUsernameTaken(accounts, input.username)) {
          return {
            problems: [
              { field: 'username', message: 'That username is already taken.' },
            ],
          }
        }

        const { passwordHash, passwordSalt } = await hashPassword(input.password)
        const account: Account = {
          id: nanoid(),
          username: normalizeUsername(input.username),
          fullName: input.fullName.trim(),
          passwordHash,
          passwordSalt,
          role: roleForNewAccount(accounts),
          createdAt: new Date().toISOString(),
        }

        set((s) => ({
          accounts: [...s.accounts, account],
          // Registration signs the new account in, so a first run lands on the
          // dashboard instead of bouncing the user back to the login form.
          currentAccountId: account.id,
        }))
        return { account }
      },

      signIn: async (username, password) => {
        const account = findAccountByUsername(get().accounts, username)
        // Same message either way: saying "no such username" would let anyone
        // enumerate which accounts exist without the password.
        const invalid: FieldProblem[] = [
          { field: 'form', message: 'That username and password do not match.' },
        ]
        if (!account) {
          // Hash anyway so a missing username and a wrong password take a
          // similar amount of time, rather than failing instantly.
          await hashPassword(password)
          return { problems: invalid }
        }
        if (!(await verifyPassword(password, account))) {
          return { problems: invalid }
        }

        set({ currentAccountId: account.id })
        return { account }
      },

      signOut: () => set({ currentAccountId: null }),

      currentAccount: () => {
        const { accounts, currentAccountId } = get()
        if (!currentAccountId) return null
        return accounts.find((a) => a.id === currentAccountId) ?? null
      },

      clear: () => set({ accounts: [], currentAccountId: null }),
    }),
    {
      name: 'choir-auth',
      version: 1,
      // Deliberately no `importData`: accounts are excluded from the Settings
      // backup file. A restore should never silently install someone else's
      // password hashes on this machine. See SettingsPage's BackupFile.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          accounts?: Account[]
          currentAccountId?: string | null
        }
        return {
          ...state,
          accounts: Array.isArray(state.accounts) ? state.accounts : [],
          currentAccountId: state.currentAccountId ?? null,
        }
      },
    },
  ),
)