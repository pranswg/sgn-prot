import { useState } from 'react'
import { toast } from 'sonner'
import {
  LogOut,
  Pencil,
  Trash2,
  Undo2,
  UserPlus,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  MemberLifecycleBadge,
} from '@/components/StatusBadges'
import type { Member, MemberHistoryEvent, TransferReason } from '@/core/types/member'
import { useMemberStore } from '@/store/memberStore'
import { useAuthStore } from '@/store/authStore'
import {
  MEMBER_HISTORY_EVENT_LABELS,
  memberHistoryEvents,
  memberIsReturned,
  memberLifecycleStatus,
  memberMembershipPeriods,
  transferReasonLabel,
  TRANSFER_REASON_OPTIONS,
} from '@/lib/memberHistory'
import { formatDateKeyLongDate } from '@/lib/phDate'
import { formatMemberName, memberInitials } from '@/lib/memberDirectory'
import { getVoiceName } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/useAsyncAction'

interface MemberHistoryDetailProps {
  member: Member
  reference?: string
  canManage: boolean
  onRequestRestore: () => void
}

const EVENT_ICONS: Record<MemberHistoryEvent['type'], typeof UserPlus> = {
  joined: UserPlus,
  'transferred-out': LogOut,
  returned: Undo2,
}

const EVENT_STYLES: Record<MemberHistoryEvent['type'], string> = {
  joined: 'border-brand-teal/30 bg-brand-teal-soft text-brand-teal',
  'transferred-out': 'border-amber-500/30 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  returned: 'border-green-500/30 bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300',
}

function MemberAvatar({ member }: { member: Member }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-navy text-[0.8125rem] font-semibold tracking-tight text-white">
      {memberInitials(member)}
    </span>
  )
}

interface LifecycleHeaderProps extends MemberHistoryDetailProps {
  member: Member
}

function LifecycleHeader({ member, reference, canManage, onRequestRestore }: LifecycleHeaderProps) {
  const status = memberLifecycleStatus(member)
  const periods = memberMembershipPeriods(member)
  const restorable = status === 'transferred-out' || status === 'inactive'
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <MemberAvatar member={member} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-foreground">
            {formatMemberName(member)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">
            {reference ?? '—'}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <MemberLifecycleBadge member={member} />
        {memberIsReturned(member) && (
          <span className="text-[0.6875rem] font-medium text-brand-teal">
            {periods} {periods === 1 ? 'term' : 'terms'}
          </span>
        )}
        {restorable && canManage && (
          <Button size="sm" onClick={onRequestRestore}>
            <Undo2 className="size-3.5" />
            Restore
          </Button>
        )}
      </div>
    </div>
  )
}

/** The whole timeline, shared by the desktop dialog and the mobile sheet. */
export function MemberHistoryContent({
  member,
  reference,
  canManage,
  onRequestRestore,
}: MemberHistoryDetailProps) {
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const updateHistoryEvent = useMemberStore((s) => s.updateHistoryEvent)
  const removeHistoryEvent = useMemberStore((s) => s.removeHistoryEvent)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editReason, setEditReason] = useState<TransferReason>('other')
  const [editNotes, setEditNotes] = useState('')
  const [deleting, setDeleting] = useState<MemberHistoryEvent | null>(null)

  const events = memberHistoryEvents(member)
  const timeline = [...events].reverse()

  const startEdit = (event: MemberHistoryEvent) => {
    setEditingId(event.id)
    setEditDate(event.date)
    setEditReason(event.reason ?? 'other')
    setEditNotes(event.notes ?? '')
  }

  const saveEdit = (event: MemberHistoryEvent) => {
    // A null account id (signed out mid-session) fails the store's activeActor
    // check and returns the standard manager error.
    const accountId = currentAccountId ?? ''
    const error = updateHistoryEvent(accountId, member.id, event.id, {
      date: editDate,
      reason: event.type === 'transferred-out' ? editReason : event.reason,
      notes: editNotes,
    })
    if (error) {
      toast.error(error.error)
      return
    }
    setEditingId(null)
    toast.success('History event updated.')
  }

  const [saveHistoryEdit, savingHistoryEdit] = useAsyncAction(saveEdit)

  if (member.isActive && events.length === 0) return null

  const confirmDelete = () => {
    if (!deleting) return
    const accountId = currentAccountId ?? ''
    const error = removeHistoryEvent(accountId, member.id, deleting.id)
    setDeleting(null)
    if (error) {
      toast.error(error.error)
      return
    }
    toast.success('History event removed.')
  }

  return (
    <div className="grid gap-4">
      <LifecycleHeader
        member={member}
        reference={reference}
        canManage={canManage}
        onRequestRestore={onRequestRestore}
      />

      {events.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-5 text-center">
          <p className="text-sm font-medium text-foreground">No recorded history yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This member's membership predates event tracking. Use Restore to bring
            them to the active Master List.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col">
          {timeline.map((event, index) => {
            const Icon = EVENT_ICONS[event.type]
            const isLast = index === timeline.length - 1
            const isEditing = editingId === event.id
            return (
              <li key={event.id} className={cn('relative flex gap-3.5', !isLast && 'pb-6')}>
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute top-8 bottom-0 left-[15px] w-px bg-border/70"
                  />
                )}
                <span
                  className={cn(
                    'z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-background',
                    EVENT_STYLES[event.type],
                  )}
                >
                  <Icon className="size-3.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 leading-tight">
                      <p className="text-sm font-semibold text-foreground">
                        {MEMBER_HISTORY_EVENT_LABELS[event.type]}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateKeyLongDate(event.date)}
                      </p>
                    </div>
                    {canManage && !isEditing && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit event"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(event)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove event"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleting(event)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {event.voicePosition ? (
                      <span>
                        {getVoiceName(event.voicePosition, voices)}
                      </span>
                    ) : null}
                    {event.type === 'transferred-out' ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        {transferReasonLabel(event.reason)}
                      </span>
                    ) : null}
                    {event.actorName ? (
                      <span className="truncate">
                        by {event.actorName}
                      </span>
                    ) : null}
                  </div>
                  {event.notes ? (
                    <p className="mt-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                      {event.notes}
                    </p>
                  ) : null}

                  {isEditing && (
                    <div className="mt-3 grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                      <div className="grid gap-2">
                        <Label htmlFor={`event-date-${event.id}`}>Date</Label>
                        <Input
                          id={`event-date-${event.id}`}
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                        />
                      </div>
                      {event.type === 'transferred-out' && (
                        <div className="grid gap-2">
                          <Label>Reason</Label>
                          <Select
                            value={editReason}
                            onValueChange={(value) =>
                              setEditReason(value as TransferReason)
                            }
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
                        <Label htmlFor={`event-notes-${event.id}`}>Notes</Label>
                        <Textarea
                          id={`event-notes-${event.id}`}
                          rows={2}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingId(null)}
                          className="flex-1"
                        >
                          <X className="size-3.5" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void saveHistoryEdit(event)}
                          loading={savingHistoryEdit}
                          className="flex-1"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this history event?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the "
              {deleting ? MEMBER_HISTORY_EVENT_LABELS[deleting.type] : ''}" event
              from {formatMemberName(member)}'s timeline. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={confirmDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface MemberHistoryDetailDialogProps {
  member: Member | null
  reference?: string
  canManage: boolean
  onOpenChange: (open: boolean) => void
  onRequestRestore?: () => void
}

/** Desktop timeline dialog. */
export function MemberHistoryDialog({
  member,
  reference,
  canManage,
  onOpenChange,
  onRequestRestore,
}: MemberHistoryDetailDialogProps) {
  if (!member) return null
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Membership History</DialogTitle>
          <DialogDescription>
            Member history in the locale.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <MemberHistoryContent
            member={member}
            reference={reference}
            canManage={canManage}
            onRequestRestore={onRequestRestore ?? (() => {})}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Mobile timeline sheet. */
export function MemberHistorySheet({
  member,
  reference,
  canManage,
  onOpenChange,
  onRequestRestore,
}: MemberHistoryDetailDialogProps) {
  if (!member) return null
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col gap-0 rounded-t-2xl pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex shrink-0 justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-border/80" />
        </div>
        <div className="px-5 pt-2 pb-3">
          <SheetTitle className="text-lg font-bold">Membership History</SheetTitle>
          <SheetDescription className="text-xs">
            Member history in the locale.
          </SheetDescription>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto border-t border-border/60 px-4 pt-4 pb-6">
          <MemberHistoryContent
            member={member}
            reference={reference}
            canManage={canManage}
            onRequestRestore={onRequestRestore ?? (() => {})}
          />
        </div>
        <div className="flex shrink-0 px-4 pt-2">
          <Button
            variant="secondary"
            className="h-12 flex-1 rounded-xl text-sm font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}