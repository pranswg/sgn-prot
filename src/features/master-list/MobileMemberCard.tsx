import { MoreVertical } from 'lucide-react'
import {
  GenderBadge,
  MemberLifecycleBadge,
  ReturnedMemberBadge,
  VoiceBadge,
} from '@/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { memberPositionLabel } from '@/core/constants/memberMembership'
import { memberIsReturned } from '@/lib/memberHistory'
import type { VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'

interface MobileMemberCardProps {
  member: Member
  /** Position in the current list, shown as a row-number chip. */
  number: number
  reference?: string
  voices: VoicePosition[]
  /** PNK sings one voice, so its cards carry no voice badge. */
  showVoice?: boolean
  sort: MemberSort
  onOpenMenu: (member: Member) => void
  hasActions: boolean
}

/**
 * Compact directory card. The body and the overflow button both open the
 * member's action sheet; the row number chip sits beside the avatar and the
 * display reference (M-001) under the name.
 */
export function MobileMemberCard({
  member,
  number,
  reference,
  voices,
  showVoice = true,
  sort,
  onOpenMenu,
  hasActions,
}: MobileMemberCardProps) {
  const name = formatMemberName(member, sort)

  return (
    <li className="pressable overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm active:bg-brand-teal-soft/40 motion-reduce:transform-none">
      <div className="flex items-center gap-2 p-3.5">
        <button
          type="button"
          onClick={() => onOpenMenu(member)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
            {number}
          </span>
          <MemberInitialsAvatar
            member={member}
            sort={sort}
            className="size-11 shrink-0 text-sm"
          />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold text-foreground">
              {name}
            </span>
            <span className="mt-0.5 block text-[0.6875rem] tabular-nums text-muted-foreground">
              {reference ?? '—'}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <GenderBadge gender={member.gender} />
              {showVoice && (
                <VoiceBadge name={memberPositionLabel(member, voices)} />
              )}
              <MemberLifecycleBadge member={member} />
              {memberIsReturned(member) && <ReturnedMemberBadge />}
            </span>
          </span>
        </button>
        {hasActions && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1 shrink-0 text-muted-foreground"
            aria-label={`Actions for ${name}`}
            onClick={() => onOpenMenu(member)}
          >
            <MoreVertical className="size-4" />
          </Button>
        )}
      </div>
    </li>
  )
}
