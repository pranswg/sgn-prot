import { useState } from 'react'
import { toast } from 'sonner'
import { LogOut, Undo2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Member, TransferReason } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { useAuthStore } from '@/store/authStore'
import { TRANSFER_REASON_OPTIONS } from '@/lib/memberHistory'
import { todayPHT } from '@/lib/phDate'
import { formatMemberName } from '@/lib/memberDirectory'
import { useAsyncAction } from '@/hooks/useAsyncAction'

export type LifecycleFormKind = 'transfer' | 'restore'

interface MemberLifecycleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: Member | null
  kind: LifecycleFormKind
  onSuccess?: (member: Member) => void
}

interface LifecycleFormState {
  date: string
  reason: TransferReason
  notes: string
}

function freshState(): LifecycleFormState {
  return { date: todayPHT(), reason: 'transferred-locale', notes: '' }
}

/** Shared form fields for recording a transfer-out or a return. */
function LifecycleFields({
  kind,
  form,
  setField,
}: {
  kind: LifecycleFormKind
  form: LifecycleFormState
  setField: <K extends keyof LifecycleFormState>(key: K, value: LifecycleFormState[K]) => void
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="lifecycle-date">
          {kind === 'transfer' ? 'Transfer date' : 'Return date'}
        </Label>
        <Input
          id="lifecycle-date"
          type="date"
          value={form.date}
          onChange={(e) => setField('date', e.target.value)}
        />
      </div>

      {kind === 'transfer' && (
        <div className="grid gap-2">
          <Label>Reason for transfer</Label>
          <Select
            value={form.reason}
            onValueChange={(value) => setField('reason', value as TransferReason)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSFER_REASON_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="lifecycle-notes">
          Notes <span className="font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <Textarea
          id="lifecycle-notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder={
            kind === 'transfer'
              ? 'e.g. transferred to Manila locale, attending another locale'
              : 'e.g. returning member to the locale'
          }
        />
      </div>
    </div>
  )
}

/** Runs the store action and reports the outcome to the caller. */
function useLifecycleSubmit(
  kind: LifecycleFormKind,
  onSuccess?: (member: Member) => void,
) {
  const transferMember = useMemberStore((s) => s.transferMember)
  const restoreMember = useMemberStore((s) => s.restoreMember)
  const currentAccountId = useAuthStore((s) => s.currentAccountId)

  return (member: Member, state: LifecycleFormState) => {
    // A null account id (signed out mid-session) fails inside the store's
    // activeActor check and returns the standard manager error.
    const accountId = currentAccountId ?? ''
    const result =
      kind === 'transfer'
        ? transferMember(accountId, member.id, {
            date: state.date,
            reason: state.reason,
            notes: state.notes,
          })
        : restoreMember(accountId, member.id, {
            date: state.date,
            notes: state.notes,
          })
    if (result.error) {
      toast.error(result.error)
      return null
    }
    toast.success(
      kind === 'transfer'
        ? `${formatMemberName(member)} transferred out.`
        : `${formatMemberName(member)} restored to the Master List.`,
    )
    if (result.member) onSuccess?.(result.member)
    return result.member ?? member
  }
}

/** Desktop dialog for recording a transfer-out or a return. */
export function MemberLifecycleDialog({
  open,
  onOpenChange,
  member,
  kind,
  onSuccess,
}: MemberLifecycleFormProps) {
  const [form, setForm] = useState<LifecycleFormState>(freshState)
  const [wasOpen, setWasOpen] = useState(open)
  const submit = useLifecycleSubmit(kind, onSuccess)

  const [confirmLifecycle, confirmingLifecycle] = useAsyncAction(
    (target: Member, state: LifecycleFormState) => {
      const saved = submit(target, state)
      if (saved) onOpenChange(false)
    },
  )

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(freshState())
  }

  if (!member) return null
  const name = formatMemberName(member)
  const isTransfer = kind === 'transfer'

  const setField = <K extends keyof LifecycleFormState>(
    key: K,
    value: LifecycleFormState[K],
  ) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isTransfer ? 'Transfer Out' : 'Restore Member'}</DialogTitle>
          <DialogDescription>
            {isTransfer
              ? `${name} stays in the archive and can be restored later.`
              : `${name} returns to the Master List.`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <LifecycleFields kind={kind} form={form} setField={setField} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={isTransfer ? 'destructive' : 'default'}
            onClick={() => void confirmLifecycle(member, form)}
            loading={confirmingLifecycle}
          >
            {isTransfer ? <LogOut className="size-4" /> : <Undo2 className="size-4" />}
            {isTransfer ? 'Confirm Transfer' : 'Restore Member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
