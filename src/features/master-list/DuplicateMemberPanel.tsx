import { AlertTriangle, Eye, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MemberLifecycleBadge } from '@/components/StatusBadges'
import type { Member } from '@/core/types/member'
import { formatMemberName, memberInitials } from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import { useAsyncAction } from '@/hooks/useAsyncAction'

interface DuplicateMemberPanelProps {
  candidates: Member[]
  onViewHistory: (member: Member) => void
  onRestore: (member: Member) => void
  /** Proceed with adding the new profile anyway. */
  onContinue: () => void
  /** Back to the form, so the caller can correct the name. */
  onCancel: () => void
  /** Mobile switches to larger, thumb-sized tap targets. */
  mobile?: boolean
}

/**
 * Shown inside the Add Member form when saving would create a profile that
 * matches an existing member's name (after normalising case and accents).
 * `MemberFormDialog` and `MobileMemberFormSheet` swap their body to this panel
 * instead of nesting a second dialog, so the entered data stays in place while
 * the user decides: view the existing timeline, restore the transferred-out
 * profile, or ignore the match and add a new record.
 */
export function DuplicateMemberPanel({
  candidates,
  onViewHistory,
  onRestore,
  onContinue,
  onCancel,
  mobile = false,
}: DuplicateMemberPanelProps) {
  const [restore, restoring] = useAsyncAction(onRestore)
  const [proceed, proceeding] = useAsyncAction(onContinue)

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50 p-3 dark:bg-amber-500/10">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            A possible duplicate was found
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            The Master List already has a member with this name. If it is the
            same person, restore them instead of creating a second record.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {candidates.map((member) => (
          <li
            key={member.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3',
              mobile ? 'min-h-12 py-2.5' : 'py-2',
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-navy text-[0.6875rem] font-semibold tracking-tight text-white">
              {memberInitials(member)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-foreground">
                {formatMemberName(member)}
              </p>
              <span className="mt-1 inline-flex">
                <MemberLifecycleBadge member={member} />
              </span>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size={mobile ? 'default' : 'sm'}
                onClick={() => onViewHistory(member)}
              >
                <Eye className="size-3.5" />
                View History
              </Button>
              {!member.isActive && (
                <Button
                  size={mobile ? 'default' : 'sm'}
                  onClick={() => restore(member)}
                  loading={restoring}
                >
                  <Undo2 className="size-3.5" />
                  Restore
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          className={cn(mobile && 'h-12 rounded-xl text-sm font-semibold')}
          onClick={onCancel}
        >
          Back to Form
        </Button>
        <Button
          className={cn(mobile && 'h-12 rounded-xl text-sm font-semibold')}
          onClick={proceed}
          loading={proceeding}
        >
          Create New Member Anyway
        </Button>
      </div>
    </div>
  )
}