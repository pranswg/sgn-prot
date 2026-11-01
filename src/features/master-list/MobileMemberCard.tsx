import { MoreVertical } from 'lucide-react'
import {
  MemberLifecycleBadge,
  ReturnedMemberBadge,
} from '@/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { memberPositionLabel } from '@/core/constants/memberMembership'
import type { DutyRole, VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import { memberIsReturned } from '@/lib/memberHistory'
import { memberRankNames } from '@/lib/memberRanks'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'

interface MobileMemberCardProps {
  member: Member
  reference?: string
  voices: VoicePosition[]
  dutyRoles: DutyRole[]
  /** PNK sings one voice, so its cards carry no voice name. */
  showVoice?: boolean
  sort: MemberSort
  onOpenMenu: (member: Member) => void
  hasActions: boolean
}

/**
 * Compact directory card. The body and the overflow button both open the
 * member's action sheet. The choir section header already names the gender, so
 * the card spends its one metadata line on the reference, voice, and chosen
 * Choir Positions instead of a repeated gender badge.
 */
export function MobileMemberCard({
  member,
  reference,
  voices,
  dutyRoles,
  showVoice = true,
  sort,
  onOpenMenu,
  hasActions,
}: MobileMemberCardProps) {
  const name = formatMemberName(member, sort)
  const ranks = memberRankNames(member, dutyRoles).join(', ')
  const meta = [
    reference ?? '—',
    showVoice ? memberPositionLabel(member, voices) : null,
    ranks || null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="pressable overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm active:bg-brand-teal-soft/40 motion-reduce:transform-none">
      <div className="flex items-center gap-3 p-3.5">
        <button
          type="button"
          onClick={() => onOpenMenu(member)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <MemberInitialsAvatar
            member={member}
            sort={sort}
            className="size-11 shrink-0 text-sm"
          />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold text-foreground">
              {name}
            </span>
            <span className="mt-0.5 block truncate text-[0.6875rem] tabular-nums text-muted-foreground">
              {meta}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {memberIsReturned(member) && <ReturnedMemberBadge />}
          <MemberLifecycleBadge member={member} />
          {hasActions && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1 text-muted-foreground"
              aria-label={`Actions for ${name}`}
              onClick={() => onOpenMenu(member)}
            >
              <MoreVertical className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
