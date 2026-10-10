import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Music4 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/authStore'

/**
 * The sign-in screen. `App.tsx` renders this bare, outside the `Layout` shell,
 * because an unauthenticated visitor should not see the sidebar or the page
 * chrome. System accounts are created by an administrator (the seeded Admin is
 * `admin` / `admin1234`), so this screen never registers anyone.
 *
 * Sign-in now talks to Supabase Auth through the store, which returns the same
 * `FieldProblem[]` shape the screen has always rendered.
 */
export function AuthPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const fieldId = useId()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    try {
      const result = await signIn(username, password)
      if ('problems' in result) {
        setError(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success(`Welcome back, ${result.account.fullName}.`)
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
                className="h-10"
                placeholder="Enter Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${fieldId}-password`}>Password</Label>
              <div className="relative">
                <Input
                  id={`${fieldId}-password`}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" className="h-10 w-full" loading={pending}>
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
