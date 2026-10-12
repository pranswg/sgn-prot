import { useState } from 'react'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Trainee, TransferReason } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { TRANSFER_REASON_OPTIONS } from '@/lib/memberHistory'
import { todayPHT } from '@/lib/phDate'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/useAsyncAction'

export interface TraineeTransferFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trainee: Trainee | null
  onSuccess?: () => void
}

interface TransferFormState {
  date: string
  reason: TransferReason
  notes: string
}

const fullName = (t: Trainee) =>
  [t.firstName, t.middleName, t.lastName, t.suffix].filter(Boolean).join(' ')

function freshState(): TransferFormState {
  return { date: todayPHT(), reason: 'transferred-locale', notes: '' }
}

/** Shared form fields for recording a trainee transfer-out. */
function TransferFields({
  form,
  setField,
}: {
  form: TransferFormState
  setField: <K extends keyof TransferFormState>(
    key: K,
    value: TransferFormState[K],
  ) => void
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="trainee-transfer-date">Transfer date</Label>
        <Input
          id="trainee-transfer-date"
          type="date"
          value={form.date}
          onChange={(e) => setField('date', e.target.value)}
        />
      </div>

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

      <div className="grid gap-2">
        <Label htmlFor="trainee-transfer-notes">
          Notes <span className="font-normal text-muted-foreground">(Optional)</span>
        </Label>
        <Textarea
          id="trainee-transfer-notes"
          rows={3}
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="e.g. still training when they left the locale"
        />
      </div>
    </div>
  )
}

function useTraineeTransferSubmit(onSuccess?: () => void) {
  const transferTrainee = useMemberStore((s) => s.transferTrainee)

  return (trainee: Trainee, state: TransferFormState) => {
    const result = transferTrainee(trainee.id, {
      date: state.date,
      reason: state.reason,
      notes: state.notes,
    })
    if (result.error) {
      toast.error(result.error)
      return false
    }
    toast.success(`${fullName(trainee)} transferred out.`)
    onSuccess?.()
    return true
  }
}

/** Desktop dialog for recording a trainee transfer-out. */
export function TraineeTransferDialog({
  open,
  onOpenChange,
  trainee,
  onSuccess,
}: TraineeTransferFormProps) {
  const [form, setForm] = useState<TransferFormState>(freshState)
  const [wasOpen, setWasOpen] = useState(open)
  const submit = useTraineeTransferSubmit(onSuccess)

  const [confirmTransfer, confirmingTransfer] = useAsyncAction(
    (target: Trainee, state: TransferFormState) => {
      if (submit(target, state)) onOpenChange(false)
    },
  )

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(freshState())
  }

  if (!trainee) return null

  const setField = <K extends keyof TransferFormState>(
    key: K,
    value: TransferFormState[K],
  ) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Out</DialogTitle>
          <DialogDescription>
            {fullName(trainee)} stays in the trainee archive and can be
            restored later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <TransferFields form={form} setField={setField} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmTransfer(trainee, form)}
            loading={confirmingTransfer}
          >
            <LogOut className="size-4" />
            Confirm Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Mobile bottom sheet for the same form. */
export function TraineeTransferSheet({
  open,
  onOpenChange,
  trainee,
  onSuccess,
}: TraineeTransferFormProps) {
  const [form, setForm] = useState<TransferFormState>(freshState)
  const [wasOpen, setWasOpen] = useState(open)
  const submit = useTraineeTransferSubmit(onSuccess)

  const [confirmTransfer, confirmingTransfer] = useAsyncAction(
    (target: Trainee, state: TransferFormState) => {
      if (submit(target, state)) onOpenChange(false)
    },
  )

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(freshState())
  }

  if (!trainee) return null

  const setField = <K extends keyof TransferFormState>(
    key: K,
    value: TransferFormState[K],
  ) => setForm((f) => ({ ...f, [key]: value }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[88dvh] flex-col gap-0 rounded-t-2xl pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex shrink-0 justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-border/80" />
        </div>
        <div className="flex items-center gap-3 px-5 pt-2 pb-3">
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl',
              'bg-destructive/10 text-destructive',
            )}
          >
            <LogOut className="size-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <SheetTitle className="text-lg font-bold">Transfer Out</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {fullName(trainee)}
            </SheetDescription>
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4">
          <TransferFields form={form} setField={setField} />
        </div>
        <div className="flex shrink-0 gap-3 px-4 pt-2">
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-xl text-sm font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="h-12 flex-1 rounded-xl text-sm font-semibold"
            onClick={() => void confirmTransfer(trainee, form)}
            loading={confirmingTransfer}
          >
            Confirm Transfer
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
