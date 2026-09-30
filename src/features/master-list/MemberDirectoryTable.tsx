import { FileUp, SearchX, Users, Venus, Mars } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface MemberDirectoryTableProps {
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

const COLUMN_COUNT = 8

const headClass =
  'h-11 bg-muted/40 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

interface ChoirSectionHeaderProps {
  icon: typeof Users
  iconClass: string
  title: string
  count: number
  startNumber: number
}

function ChoirSectionHeader({
  icon: Icon,
  iconClass,
  title,
  count,
  startNumber,
}: ChoirSectionHeaderProps) {
  return (
    <TableRow className="border-y border-border/60 bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={COLUMN_COUNT} className="px-4 py-2">
        <div className="flex items-center gap-2.5">
          <Icon className={cn('size-3.5', iconClass)} />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-foreground/75">
            {title}
          </span>
          <span className="rounded border border-border bg-background px-1.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
          <span className="text-[0.625rem] tabular-nums text-muted-foreground/60">
            #{startNumber}&ndash;#{startNumber + count - 1}
          </span>
          <span aria-hidden className="h-px flex-1 bg-border/60" />
        </div>
      </TableCell>
    </TableRow>
  )
}

export function MemberDirectoryEmptyState({
  hasAnyMembers,
  onImport,
  onClearFilters,
}: {
  hasAnyMembers: boolean
  onImport: () => void
  onClearFilters: () => void
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {hasAnyMembers ? 'No members match the current filters' : 'No members yet'}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {hasAnyMembers
            ? 'Try widening the search or clearing the active directory filters.'
            : 'Import the choir roster or add members manually to build the directory.'}
        </p>
      </div>
      {hasAnyMembers ? (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Reset filters
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={onImport}>
          <FileUp className="size-4" />
          Import Roster
        </Button>
      )}
    </div>
  )
}

export function MemberDirectoryTable({
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
}: MemberDirectoryTableProps) {
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
    <>
      {/* Desktop / tablet: dense table */}
      <div className="hidden md:block">
        <Table className="min-w-[54rem]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={`${headClass} w-14 text-center`}>#</TableHead>
              <TableHead className={headClass}>Member</TableHead>
              <TableHead className={`${headClass} hidden lg:table-cell`}>
                Gender
              </TableHead>
              <TableHead className={headClass}>Voice Position</TableHead>
              <TableHead className={`${headClass} hidden xl:table-cell`}>
                Positions / Privileges
              </TableHead>
              <TableHead className={headClass}>Membership</TableHead>
              <TableHead className={headClass}>Status</TableHead>
              <TableHead className={`${headClass} w-24 text-right`}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.map((section) => (
              <ChoirSection
                key={section.title}
                {...section}
                rowNumbers={rowNumbers}
                voices={voices}
                references={references}
                sort={sort}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: card list instead of a horizontally scrolling table */}
      <div className="flex flex-col gap-5 p-4 md:hidden">
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
            <ul className="flex flex-col gap-2.5">
              {section.members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-2.5 rounded-lg border border-border/70 bg-card p-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                      {rowNumbers.get(member.id) ?? '—'}
                    </span>
                    <MemberInitialsAvatar member={member} sort={sort} />
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
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <VoiceBadge name={getVoiceName(member.voicePosition, voices)} />
                    <MembershipBadge type={member.membershipType} />
                    <GenderBadge gender={member.gender} />
                    <MemberStatusBadge active={member.isActive} />
                  </div>
                  <MemberPositionsCell positions={member.positions} max={3} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

interface ChoirSectionProps {
  title: string
  members: Member[]
  icon: typeof Users
  iconClass: string
  rowNumbers: Map<string, number>
  voices: VoicePosition[]
  references: Map<string, string>
  sort: MemberSort
  onView: (member: Member) => void
  onEdit: (member: Member) => void
  onDelete: (member: Member) => void
}

function ChoirSection({
  title,
  members,
  icon,
  iconClass,
  rowNumbers,
  voices,
  references,
  sort,
  onView,
  onEdit,
  onDelete,
}: ChoirSectionProps) {
  const startNumber = rowNumbers.get(members[0].id) ?? 1

  return (
    <>
      <ChoirSectionHeader
        icon={icon}
        iconClass={iconClass}
        title={title}
        count={members.length}
        startNumber={startNumber}
      />
      {members.map((member) => (
        <TableRow
          key={member.id}
          className="h-14 border-b border-border/60 transition-colors hover:bg-brand-teal-soft/30"
        >
          <TableCell className="w-14 text-center align-middle">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
              {rowNumbers.get(member.id) ?? '—'}
            </span>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              <MemberInitialsAvatar member={member} sort={sort} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[0.8125rem] font-semibold text-foreground">
                  {formatMemberName(member, sort)}
                </p>
                <p className="mt-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">
                  {references.get(member.id) ?? '—'}
                </p>
              </div>
            </div>
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <GenderBadge gender={member.gender} />
          </TableCell>
          <TableCell>
            <VoiceBadge name={getVoiceName(member.voicePosition, voices)} />
          </TableCell>
          <TableCell className="hidden xl:table-cell">
            <MemberPositionsCell positions={member.positions} max={2} />
          </TableCell>
          <TableCell>
            <MembershipBadge type={member.membershipType} />
          </TableCell>
          <TableCell>
            <MemberStatusBadge active={member.isActive} />
          </TableCell>
          <TableCell className="text-right">
            <MemberRowActions
              member={member}
              sort={sort}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
