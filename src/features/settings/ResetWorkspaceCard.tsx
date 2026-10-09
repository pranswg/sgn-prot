import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuthStore } from '@/store/authStore'
import { clearLocalWorkspace } from '@/lib/workspaceSync'

const CONFIRM_PHRASE = 'RESET'

/**
 * Admin-only factory reset. Wipes the whole shared workspace, deletes every
 * account, and restores the default `admin` login with a forced password change.
 * The signed-in admin is deleted too, so this ends on the sign-in screen.
 */
export function ResetWorkspaceCard() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const factoryReset = useAuthStore((state) => state.factoryReset)
  const signOut = useAuthStore((state) => state.signOut)

  const reset = async () => {
    setBusy(true)
    const result = await factoryReset()
    if ('problems' in result) {
      setBusy(false)
      setConfirmation('')
      toast.error(result.problems[0]?.message ?? 'Could not reset the workspace.')
      return
    }
    clearLocalWorkspace()
    signOut()
    toast.success('Workspace reset. Sign in as admin to continue.')
    window.location.reload()
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" />
          Factory Reset
        </CardTitle>
        <CardDescription>
          Delete all choir data, clear the security logs, and remove every
          account. The default <span className="font-medium">admin</span> login is
          recreated with a forced password change. This cannot be undone, and it
          affects every device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Reset Workspace
        </Button>
      </CardContent>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return
          setOpen(next)
          if (!next) setConfirmation('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the entire workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              All members, trainees, Suguan records, Koro documents, presets,
              settings, and security logs will be permanently deleted. Every
              account will be removed and the default <code>admin</code> login
              recreated. You will be signed out. Type{' '}
              <span className="font-semibold">{CONFIRM_PHRASE}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reset-confirmation">Confirmation</Label>
            <Input
              id="reset-confirmation"
              value={confirmation}
              autoComplete="off"
              placeholder={CONFIRM_PHRASE}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy || confirmation !== CONFIRM_PHRASE}
              onClick={() => {
                void reset()
              }}
            >
              {busy ? 'Resetting…' : 'Reset Workspace'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
