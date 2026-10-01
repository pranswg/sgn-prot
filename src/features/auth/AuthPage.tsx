import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Music4, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { NewAccountInput } from '@/core/types/auth'
import { passwordStrengthProblems, type FieldProblem } from '@/lib/credentials'
import { useAuthStore } from '@/store/authStore'

type AuthMode = 'sign-in' | 'register'

const EMPTY_FORM: NewAccountInput = {
  username: '',
  fullName: '',
  password: '',
  confirmPassword: '',
}

/**
 * Login and registration on one screen. There is no router in this app, so the
 * mode is local state rather than a route. `App.tsx` renders this bare, outside
 * the `Layout` shell, because an unauthenticated visitor should not see the
 * sidebar or the page chrome.
 *
 * Validation lives in `src/lib/credentials.ts` and is shared with the store, so
 * this component only renders messages and never re-implements a rule.
 */
export function AuthPage() {
  const register = useAuthStore((s) => s.register)
  const signIn = useAuthStore((s) => s.signIn)
  const accountCount = useAuthStore((s) => s.accounts.length)

  // A fresh install has no accounts, so signing in is impossible. Start on
  // registration there and tell the user why.
  const [mode, setMode] = useState<AuthMode>(accountCount === 0 ? 'register' : 'sign-in')
  const [form, setForm] = useState<NewAccountInput>(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  // Inline messages from the last failed submit. Kept as the full problem list
  // so every bad field is explained at once instead of one per attempt.
  const [problems, setProblems] = useState<FieldProblem[]>([])

  const isRegister = mode === 'register'
  const fieldId = useId()

  const messageFor = (field: FieldProblem['field']) =>
    problems.find((p) => p.field === field)?.message

  const set = (field: keyof NewAccountInput, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    // Clear just this field's error as soon as it is edited, so the message
    // never contradicts what is on screen.
    setProblems((list) => list.filter((p) => p.field !== field))
  }

  const switchMode = () => {
    setMode(isRegister ? 'sign-in' : 'register')
    setForm(EMPTY_FORM)
    setProblems([])
    setShowPassword(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const result = isRegister
        ? await register(form)
        : await signIn(form.username, form.password)

      if ('problems' in result) {
        setProblems(result.problems)
        // A form-level problem (bad credentials) has no field to mark, so it
        // goes in a toast. Field-level problems are shown inline.
        const formLevel = result.problems.find((p) => p.field === 'form')
        if (formLevel) toast.error(formLevel.message)
        return
      }

      setProblems([])

      toast.success(
        isRegister
          ? `Welcome, ${result.account.fullName}.`
          : `Welcome back, ${result.account.fullName}.`,
      )
    } catch {
      // Web Crypto is unavailable on insecure origins other than localhost, so
      // hashing can genuinely throw. Say so instead of failing silently.
      toast.error('Could not process the password on this browser.')
    } finally {
      setPending(false)
    }
  }

  const strength = isRegister && form.password
    ? passwordStrengthProblems(form.password)
    : []

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-navy text-white shadow-sm">
              <Music4 className="size-6 text-brand-teal-bright" />
            </span>
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold tracking-tight">
                {isRegister ? 'Create your account' : 'Sign in'}
              </h1>
              <p className="text-sm text-muted-foreground">
                INC Choir Manager &middot; Sta. Monica
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
          >
            {isRegister && (
              <div className="grid gap-2">
                <Label htmlFor={`${fieldId}-name`}>Full name</Label>
                <Input
                  id={`${fieldId}-name`}
                  name="name"
                  autoComplete="name"
                  aria-invalid={messageFor('fullName') ? true : undefined}
                  aria-describedby={
                    messageFor('fullName') ? `${fieldId}-name-error` : undefined
                  }
                  className="h-10"
                  placeholder="Maria Santos"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                />
                <FieldMessage id={`${fieldId}-name-error`}>
                  {messageFor('fullName')}
                </FieldMessage>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor={`${fieldId}-username`}>Username</Label>
              <Input
                id={`${fieldId}-username`}
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={messageFor('username') ? true : undefined}
                aria-describedby={
                  messageFor('username') ? `${fieldId}-username-error` : undefined
                }
                className="h-10"
                placeholder="maria"
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
              />
              <FieldMessage id={`${fieldId}-username-error`}>
                {messageFor('username')}
              </FieldMessage>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${fieldId}-password`}>Password</Label>
              <div className="relative">
                <Input
                  id={`${fieldId}-password`}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  aria-invalid={messageFor('password') ? true : undefined}
                  aria-describedby={
                    messageFor('password') ? `${fieldId}-password-error` : undefined
                  }
                  className="h-10 pr-10"
                  placeholder={isRegister ? 'At least 8 characters' : ''}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <FieldMessage id={`${fieldId}-password-error`}>
                {messageFor('password')}
              </FieldMessage>
            </div>

            {isRegister && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor={`${fieldId}-confirm`}>Confirm password</Label>
                  <Input
                    id={`${fieldId}-confirm`}
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-invalid={messageFor('confirmPassword') ? true : undefined}
                    aria-describedby={
                      messageFor('confirmPassword')
                        ? `${fieldId}-confirm-error`
                        : undefined
                    }
                    className="h-10"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                  />
                  <FieldMessage id={`${fieldId}-confirm-error`}>
                    {messageFor('confirmPassword')}
                  </FieldMessage>
                </div>

                {strength.length > 0 ? (
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {strength.map((problem) => (
                      <li key={problem}>Needs: {problem}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs text-brand-teal">
                    <ShieldCheck className="size-3.5" />
                    Password looks reasonable.
                  </p>
                )}
              </>
            )}

            <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isRegister ? 'Create account' : 'Sign in'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {isRegister ? 'Already have an account?' : 'No account yet?'}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="font-medium text-brand-teal underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                {isRegister ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </form>

          <p className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Accounts are stored on this device only. Passwords are hashed, but
              anyone with access to this browser can read the data.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders nothing when there is no message, so the grid gap stays consistent
 * and no empty element interrupts the field rhythm.
 */
function FieldMessage({ id, children }: { id: string; children?: string }) {
  if (!children) return null
  return (
    <p id={id} className="text-xs text-destructive">
      {children}
    </p>
  )
}