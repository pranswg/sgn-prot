import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { passwordStrengthProblems } from '@/lib/credentials'
import { useAuthStore } from '@/store/authStore'

export function PasswordChangePage() {
  const changeOwnPassword = useAuthStore((state) => state.changeOwnPassword)
  const signOut = useAuthStore((state) => state.signOut)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    if (password !== confirmation) {
      setError('The two passwords do not match.')
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await changeOwnPassword(password)
      if ('problems' in result) {
        setError(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success('Your password has been changed.')
    } catch (cause) {
      console.error(cause)
      setError('Could not update your password. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8">
      <form
        onSubmit={(event) => void submit(event)}
        className="grid w-full max-w-md gap-5 rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
      >
        <header className="grid gap-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Your administrator provided a temporary password. Change it now to
            continue to the system.
          </p>
        </header>
        <div className="grid gap-2">
          <Label htmlFor="required-new-password">New password</Label>
          <PasswordInput
            id="required-new-password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {password && passwordStrengthProblems(password).length > 0 && (
            <p className="text-xs text-muted-foreground">
              {passwordStrengthProblems(password).join(' · ')}
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="required-confirm-password">Confirm new password</Label>
          <PasswordInput
            id="required-confirm-password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-2">
          <Button type="submit" loading={pending}>
            {pending ? 'Updating…' : 'Change Password'}
          </Button>
          <Button type="button" variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </form>
    </main>
  )
}
