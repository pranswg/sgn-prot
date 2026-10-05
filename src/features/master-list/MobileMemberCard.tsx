import { MoreVertical } from 'lucide-react'
import {
  GenderBadge,
  MemberStatusBadge,
  VoiceBadge,
} from '@/components/StatusBadges'
import { Button } from '@/components/ui/button'
import { getVoiceName } from '@/core/constants/voicePositions'
import type { VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { formatMemberName, type MemberSort } from '@/lib/memberDirectory'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'

interface MobileMemberCardProps {
  member: Member
  reference?: string
  voices: VoicePosition[]
  sort: MemberSort
  /** Tapping the card body opens the member's profile. */
  onOpen: (member: Member) => void
  onOpenMenu: (member: Member) => void
}

/**
 * Compact directory card. The body is one large tap target for the profile, so
 * the card carries no row number — the display reference (M-001) is what
 * identifies the member here. The overflow button stays a sibling of the tap
 * target rather than nested inside it.
 */
export function MobileMemberCard({
  member,
  reference,
  voices,
  sort,
  onOpen,
  onOpenMenu,
}: MobileMemberCardProps) {
  const name = formatMemberName(member, sort)

  return (
    <li className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-colors active:bg-brand-teal-soft/40">
      <div className="flex items-center gap-2 p-3.5">
        <button
          type="button"
          onClick={() => onOpen(member)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
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
            <span className="mt-0.5 block text-[0.6875rem] tabular-nums text-muted-foreground">
              {reference ?? '—'}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <GenderBadge gender={member.gender} />
              <VoiceBadge name={getVoiceName(member.voicePosition, voices)} />
              <MemberStatusBadge active={member.isActive} />
            </span>
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-1 shrink-0 text-muted-foreground"
          aria-label={`Actions for ${name}`}
          onClick={() => onOpenMenu(member)}
        >
          <MoreVertical className="size-4" />
        </Button>
      </div>
    </li>
  )
}
