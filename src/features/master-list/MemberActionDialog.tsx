import { LogOut, Pencil, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { MemberLifecycleBadge } from '@/components/StatusBadges'
import { memberPositionLabel } from '@/core/constants/memberMembership'
import type { DutyRole, VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import { memberRankNames } from '@/lib/memberRanks'
import { cn } from '@/lib/utils'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'

interface MemberActionDialogProps {
  member: Member | null
  /** The member's M-code, so the dialog identifies them the same way the card does. */
  reference?: string
  voices: VoicePosition[]
  dutyRoles: DutyRole[]
  sort?: MemberSort
  onOpenChange: (open: boolean) => void
  onEdit: (member: Member) => void
  onTransfer: (member: Member) => void
  onDelete: (member: Member) => void
  canEdit: boolean
  canTransfer: boolean
  canDelete: boolean
}

/**
 * Centred member window opened from a card tap or its kebab. It repeats the
 * member's identity rather than a generic heading, because the list dims behind
 * it, then groups the destructive rows away from the everyday ones.
 */
export function MemberActionDialog({
  member,
  reference,
  voices,
  dutyRoles,
  sort = 'last-name',
  onOpenChange,
  onEdit,
  onTransfer,
  onDelete,
  canEdit,
  canTransfer,
  canDelete,
}: MemberActionDialogProps) {
  const name = member ? formatMemberName(member, sort) : ''
  const ranks = member ? memberRankNames(member, dutyRoles).join(', ') : ''
  const meta = [
    reference ?? null,
    member ? memberPositionLabel(member, voices) : null,
    ranks || null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Dialog open={!!member} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[26rem]">
        {member && (
          <>
            <div className="flex items-start gap-3.5 p-5 pr-12">
              <MemberInitialsAvatar
                member={member}
                sort={sort}
                className="size-14 shrink-0 text-base"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-lg font-semibold tracking-tight">
                  {name}
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate text-xs">
                  {meta}
                </DialogDescription>
                <div className="mt-2">
                  <MemberLifecycleBadge member={member} />
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="border-t border-border/60 p-1.5">
                <ActionRow
                  icon={Pencil}
                  label="Edit member"
                  onClick={() => onEdit(member)}
                />
              </div>
            )}

            {(canTransfer || canDelete) && (
              <div className="border-t border-border/60 p-1.5">
                {canTransfer && (
                  <ActionRow
                    icon={LogOut}
                    label="Transfer out"
                    tone="warning"
                    onClick={() => onTransfer(member)}
                  />
                )}
                {canDelete && (
                  <ActionRow
                    icon={Trash2}
                    label="Delete member"
                    tone="destructive"
                    onClick={() => onDelete(member)}
                  />
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ActionRow({
  icon: Icon,
  label,
  tone = 'default',
  onClick,
}: {
  icon: typeof Pencil
  label: string
  tone?: 'default' | 'warning' | 'destructive'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-3.5 rounded-lg px-3.5 text-left text-[0.9375rem] font-medium transition-colors',
        'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none active:bg-muted',
        tone === 'warning'
          ? 'text-amber-700 dark:text-amber-300'
          : tone === 'destructive'
            ? 'text-destructive'
            : 'text-foreground',
      )}
    >
      <Icon className="size-4.5 shrink-0" />
      {label}
    </button>
  )
}
