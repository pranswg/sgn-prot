import { useState } from 'react'
import { ChevronRight, History } from 'lucide-react'
import type { Member } from '@/core/types/member'
import { MemberHistoryDialog } from '@/features/members-history/MemberHistoryDetail'
import {
  MEMBER_HISTORY_EVENT_LABELS,
  memberHistoryEvents,
} from '@/lib/memberHistory'
import { formatMonthYearKey } from '@/lib/phDate'
import { cn } from '@/lib/utils'

interface MemberHistoryEntryProps {
  /**
   * The member whose timeline the row opens. In Add mode the caller passes the
   * existing profile matched by name, so a returning singer can be checked
   * without saving a duplicate.
   */
  member: Member | null
  reference?: string
  canManage: boolean
  onRequestRestore?: (member: Member) => void
  /** Phones read the last event in words; the rail keeps the year. */
  showLastEvent?: boolean
  className?: string
}

/**
 * The Member history row shared by the desktop identity rail and the phone
 * form. It opens the existing Membership History window over the form rather
 * than navigating away, so the entered data stays in place behind it.
 */
export function MemberHistoryEntry({
  member,
  reference,
  canManage,
  onRequestRestore,
  showLastEvent = false,
  className,
}: MemberHistoryEntryProps) {
  const [open, setOpen] = useState(false)

  const events = member ? memberHistoryEvents(member) : []
  const last = events[events.length - 1]
  const available = Boolean(member) && !(member?.isActive && events.length === 0)

  const countLabel = `${events.length} ${events.length === 1 ? 'event' : 'events'}`
  const subtitle = !member
    ? 'Available once the member is saved'
    : events.length === 0
      ? 'No recorded history yet'
      : showLastEvent && last
        ? `${countLabel} · Last: ${MEMBER_HISTORY_EVENT_LABELS[last.type]}, ${formatMonthYearKey(last.date)}`
        : `${countLabel} · last ${last?.date.slice(0, 4) ?? '—'}`

  return (
    <>
      <button
        type="button"
        disabled={!available}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-[3.5rem] w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-left shadow-sm transition-colors',
          available
            ? 'hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            : 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
          <History className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">
            Member history
          </span>
          <span className="mt-0.5 block truncate text-[0.625rem] text-muted-foreground">
            {subtitle}
          </span>
        </span>
        {available && events.length > 0 ? (
          <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            {events.length}
          </span>
        ) : null}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </button>

      {open && member ? (
        <MemberHistoryDialog
          member={member}
          reference={reference}
          canManage={canManage}
          onOpenChange={(next) => {
            if (!next) setOpen(false)
          }}
          onRequestRestore={
            onRequestRestore ? () => onRequestRestore(member) : undefined
          }
        />
      ) : null}
    </>
  )
}
