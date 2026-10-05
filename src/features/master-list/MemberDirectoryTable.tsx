import { useState } from 'react'
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
  paginate,
  type MemberPage,
  type MemberPageSize,
  type MemberSort,
} from '@/lib/memberDirectory'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'
import { MemberPositionsCell } from './MemberPositionsCell'
import { MemberRowActions } from './MemberRowActions'
import { PageSizeControl, SectionPaginator } from './SectionPaginator'

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
  pageSize: MemberPageSize
  onPageSizeChange: (size: MemberPageSize) => void
}

const COLUMN_COUNT = 8

const headClass =
  'h-11 bg-background text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

interface ChoirSectionHeaderProps {
  icon: typeof Users
  iconClass: string
  title: string
  count: number
  /** e.g. `#3-#7`. Omitted when the section is empty. */
  rangeLabel?: string
}

function ChoirSectionHeader({
  icon: Icon,
  iconClass,
  title,
  count,
  rangeLabel,
}: ChoirSectionHeaderProps) {
  return (
    <TableRow className="border-y border-border bg-background hover:bg-background">
      <TableCell colSpan={COLUMN_COUNT} className="px-4 py-2">
        <div className="flex items-center gap-2.5">
          <Icon className={cn('size-3.5', iconClass)} />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-foreground/75">
            {title}
          </span>
          <span className="rounded border border-border bg-background px-1.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
          {rangeLabel ? (
            <span className="text-[0.625rem] tabular-nums text-muted-foreground/60">
              {rangeLabel}
            </span>
          ) : null}
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
  pageSize,
  onPageSizeChange,
}: MemberDirectoryTableProps) {
  // The women's and men's tables page independently, so each keeps its own page
  // number rather than sharing one cursor across both sections.
  const [pages, setPages] = useState<Record<string, number>>({})

  const setSectionPage = (key: string, page: number) =>
    setPages((current) => ({ ...current, [key]: page }))

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
  const choirSections = [
    {
      key: 'women',
      title: "Women's Choir",
      members: women,
      icon: Venus,
      iconClass: 'text-pink-500',
    },
    {
      key: 'men',
      title: "Men's Choir",
      members: men,
      icon: Mars,
      iconClass: 'text-sky-500',
    },
  ].filter((section) => section.members.length > 0)

  const sections = choirSections.map((section) => ({
    ...section,
    // `paginate` clamps, so a stale page 4 left over from a wider filter set
    // cannot blank the table.
    page: paginate(section.members, pages[section.key] ?? 1, pageSize),
  }))

  const anyPaged = sections.some((section) => section.page.pageCount > 1)

  return (
    <>
      {anyPaged ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="text-[0.6875rem] text-muted-foreground">
            Paged per choir section
          </p>
          <PageSizeControl
            value={pageSize}
            onChange={(size) => {
              // Keeping the current page while the page size changes would
              // silently jump the user; start over at the top instead.
              setPages({})
              onPageSizeChange(size)
            }}
          />
        </div>
      ) : null}

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
                key={section.key}
                title={section.title}
                page={section.page}
                icon={section.icon}
                iconClass={section.iconClass}
                voices={voices}
                references={references}
                sort={sort}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
                onPageChange={(page) => setSectionPage(section.key, page)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      </>
  )
}

interface ChoirSectionProps {
  title: string
  page: MemberPage<Member>
  icon: typeof Users
  iconClass: string
  voices: VoicePosition[]
  references: Map<string, string>
  sort: MemberSort
  onView: (member: Member) => void
  onEdit: (member: Member) => void
  onDelete: (member: Member) => void
  onPageChange: (page: number) => void
}

function ChoirSection({
  title,
  page,
  icon,
  iconClass,
  voices,
  references,
  sort,
  onView,
  onEdit,
  onDelete,
  onPageChange,
}: ChoirSectionProps) {
  return (
    <>
      <ChoirSectionHeader
        icon={icon}
        iconClass={iconClass}
        title={title}
        count={page.total}
        rangeLabel={
          page.pageCount > 1
            ? `#${page.firstItem}-#${page.lastItem} of #${page.total}`
            : `#1-#${page.total}`
        }
      />
      {page.items.map((member, index) => (
        <TableRow
          key={member.id}
          className="h-14 border-b border-border transition-colors hover:bg-background"
        >
          <TableCell className="w-14 text-center align-middle">
            <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
              {page.firstItem + index}
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

      {page.pageCount > 1 ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={COLUMN_COUNT} className="p-0">
            <SectionPaginator
              label={title}
              page={page}
              onPageChange={onPageChange}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}
