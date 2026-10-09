import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Music4 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FieldProblem } from '@/lib/credentials'
import { useAuthStore } from '@/store/authStore'

/**
 * Sign-in screen. `App.tsx` renders this bare, outside the `Layout` shell,
 * because an unauthenticated visitor should not see the sidebar or the page
 * chrome.
 *
 * There is no self-registration: accounts are created by an Admin through the
 * Administration screens. Validation of a new account lives in
 * `src/lib/credentials.ts`; this component only reports sign-in failures.
 */
export function AuthPage() {
  const signIn = useAuthStore((s) => s.signIn)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [problems, setProblems] = useState<FieldProblem[]>([])
  const fieldId = useId()

  const messageFor = (field: FieldProblem['field']) =>
    problems.find((p) => p.field === field)?.message

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const result = await signIn(username, password)
      if ('problems' in result) {
        setProblems(result.problems)
        const formLevel = result.problems.find((p) => p.field === 'form')
        if (formLevel) toast.error(formLevel.message)
        return
      }
      setProblems([])
      toast.success(`Welcome back, ${result.account.fullName}.`)
    } catch {
      toast.error('Could not sign in. Please check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-navy text-white shadow-sm">
              <Music4 className="size-6 text-brand-teal-bright" />
            </span>
            <div className="grid gap-1">
              <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
              <p className="text-sm text-muted-foreground">Choir Manager</p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
          >
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
                placeholder="Enter Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
                  autoComplete="current-password"
                  aria-invalid={messageFor('password') ? true : undefined}
                  aria-describedby={
                    messageFor('password') ? `${fieldId}-password-error` : undefined
                  }
                  className="h-10 pr-10"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Need access? Contact an administrator to create your account.
            </p>
          </form>
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
