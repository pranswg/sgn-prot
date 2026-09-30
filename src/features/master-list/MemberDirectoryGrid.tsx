import { Venus, Mars } from 'lucide-react'
import {
  GenderBadge,
  MemberStatusBadge,
  MembershipBadge,
  VoiceBadge,
} from '@/components/StatusBadges'
import { getVoiceName } from '@/core/constants/voicePositions'
import type { VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { cn } from '@/lib/utils'
import {
  formatMemberName,
  groupMembersByGender,
  type MemberSort,
} from '@/lib/memberDirectory'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'
import { MemberPositionsCell } from './MemberPositionsCell'
import { MemberRowActions } from './MemberRowActions'
import { MemberDirectoryEmptyState } from './MemberDirectoryTable'

interface MemberDirectoryGridProps {
  members: Member[]
  voices: VoicePosition[]
  references: Map<string, string>
  sort: MemberSort
  onView: (member: Member) => void
  onEdit: (member: Member) => void
  onDelete: (member: Member) => void
  onImport: () => void
  hasAnyMembers: boolean
  onClearFilters: () => void
}

export function MemberDirectoryGrid({
  members,
  voices,
  references,
  sort,
  onView,
  onEdit,
  onDelete,
  onImport,
  hasAnyMembers,
  onClearFilters,
}: MemberDirectoryGridProps) {
  if (members.length === 0) {
    return (
      <MemberDirectoryEmptyState
        hasAnyMembers={hasAnyMembers}
        onImport={onImport}
        onClearFilters={onClearFilters}
      />
    )
  }

  const { women, men } = groupMembersByGender(members)
  const sections = [
    {
      title: "Women's Choir",
      members: women,
      icon: Venus,
      iconClass: 'text-pink-500',
    },
    {
      title: "Men's Choir",
      members: men,
      icon: Mars,
      iconClass: 'text-sky-500',
    },
  ].filter((section) => section.members.length > 0)

  // Numbering runs continuously down the visible list, across both sections.
  const rowNumbers = new Map<string, number>()
  let next = 1
  for (const section of sections) {
    for (const member of section.members) {
      rowNumbers.set(member.id, next)
      next += 1
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <section.icon className={cn('size-3.5', section.iconClass)} />
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-foreground/75">
              {section.title}
            </h3>
            <span className="rounded border border-border bg-muted/50 px-1.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
              {section.members.length}
            </span>
            <span aria-hidden className="h-px flex-1 bg-border/60" />
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {section.members.map((member) => (
              <li
                key={member.id}
                className="group flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-4 transition-colors hover:border-brand-teal/40 hover:bg-brand-teal-soft/20"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                    {rowNumbers.get(member.id) ?? '—'}
                  </span>
                  <MemberInitialsAvatar
                    member={member}
                    sort={sort}
                    className="size-10 text-xs"
                  />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-[0.8125rem] font-semibold text-foreground">
                      {formatMemberName(member, sort)}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">
                      {references.get(member.id) ?? '—'}
                    </p>
                  </div>
                  <MemberRowActions
                    member={member}
                    sort={sort}
                    onView={onView}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    className="-mr-1 -mt-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <VoiceBadge name={getVoiceName(member.voicePosition, voices)} />
                  <MembershipBadge type={member.membershipType} />
                  <GenderBadge gender={member.gender} />
                  <MemberStatusBadge active={member.isActive} />
                </div>

                <div className="mt-auto border-t border-border/60 pt-3">
                  <p className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                    Positions / Privileges
                  </p>
                  <MemberPositionsCell positions={member.positions} max={3} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
