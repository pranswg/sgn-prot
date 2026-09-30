import { MoreVertical } from 'lucide-react'
import {
  GenderBadge,
  MemberStatusBadge,
  MembershipBadge,
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
  number: number
  voices: VoicePosition[]
  sort: MemberSort
  onOpenMenu: (member: Member) => void
}

export function MobileMemberCard({
  member,
  reference,
  number,
  voices,
  sort,
  onOpenMenu,
}: MobileMemberCardProps) {
  return (
    <li className="rounded-xl border border-border/70 bg-card p-3.5 transition-colors active:bg-brand-teal-soft/30">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
          {number}
        </span>
        <MemberInitialsAvatar
          member={member}
          sort={sort}
          className="size-10 text-xs"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-foreground">
            {formatMemberName(member, sort)}
          </p>
          <p className="mt-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">
            {reference ?? '—'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-1 -mt-1 text-muted-foreground"
          aria-label={`Actions for ${formatMemberName(member, sort)}`}
          onClick={() => onOpenMenu(member)}
        >
          <MoreVertical className="size-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <VoiceBadge name={getVoiceName(member.voicePosition, voices)} />
        <GenderBadge gender={member.gender} />
        <MembershipBadge type={member.membershipType} />
        <MemberStatusBadge active={member.isActive} />
      </div>
    </li>
  )
}
