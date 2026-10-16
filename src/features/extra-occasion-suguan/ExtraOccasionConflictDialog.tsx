import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatDateKeyNumeric } from '@/lib/phDate'
import type { Member } from '@/core/types/member'
import type { MemberConflict } from './extraOccasionConflicts'

interface ExtraOccasionConflictDialogProps {
  open: boolean
  member: Member | null
  conflicts: MemberConflict[]
  /** The occasion the member is being added to. */
  targetLabel: string
  onMove: () => void
  onStraight: () => void
  onCancel: () => void
}

/**
 * Shown when a member is assigned to an occasion while already serving another
 * occasion on a shared date. "Straight" is the keep-both choice and is recorded
 * as a decision on the target record so the dialog does not nag again.
 */
export function ExtraOccasionConflictDialog({
  open,
  member,
  conflicts,
  targetLabel,
  onMove,
  onStraight,
  onCancel,
}: ExtraOccasionConflictDialogProps) {
  const distinct = new Map<string, MemberConflict>()
  for (const conflict of conflicts) {
    if (!distinct.has(conflict.other.key)) distinct.set(conflict.other.key, conflict)
  }
  const name = member ? `${member.firstName} ${member.lastName}` : 'This member'
  const hasActual = conflicts.some((c) => c.kind === 'time-overlap')
  const hasSameDay = conflicts.some((c) => c.kind === 'same-day')
  const description = hasActual
    ? `${name} is already committed to another occasion at an overlapping time.`
    : hasSameDay
      ? `${name} is already assigned to another occasion on the same date.`
      : `${name} is already assigned to another occasion. Set the dates on both occasions to confirm whether they overlap.`

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={
                hasActual
                  ? 'size-4 text-destructive'
                  : 'size-4 text-amber-500'
              }
            />
            {hasActual ? 'Member already committed' : 'Member also assigned'}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {[...distinct.values()].map((conflict) => (
            <li
              key={conflict.other.key}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <p className="font-medium">{conflict.other.name}</p>
              <p className="text-xs text-muted-foreground">
                {conflict.kind === 'time-overlap'
                  ? 'Overlapping time'
                  : conflict.kind === 'same-day'
                    ? 'Same day, different time'
                    : 'Dates not set'}
                {conflict.dates.length > 0 && (
                  <>
                    {' · '}
                    {conflict.dates.map(formatDateKeyNumeric).join(', ')}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Adding them to <span className="font-medium">{targetLabel}</span>.
        </p>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onMove} className="w-full">
            Move to This Occasion
          </Button>
          <Button variant="outline" onClick={onStraight} className="w-full">
            Straight
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
