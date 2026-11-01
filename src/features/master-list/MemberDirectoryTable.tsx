import { useState } from 'react'
import { ChevronDown, SearchX, Venus, Mars } from 'lucide-react'
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
  MemberLifecycleBadge,
  ReturnedMemberBadge,
  VoiceBadge,
} from '@/components/StatusBadges'
import { memberPositionLabel } from '@/core/constants/memberMembership'
import type { DutyRole, VoicePosition } from '@/core/types/suguan'
import type { Member } from '@/core/types/member'
import { cn } from '@/lib/utils'
import { memberIsReturned } from '@/lib/memberHistory'
import {
  formatMemberName,
  groupMembersByGender,
  paginate,
  type MemberPageSize,
  type MemberSort,
} from '@/lib/memberDirectory'
import { MemberInitialsAvatar } from './MemberInitialsAvatar'
import { MemberRowActions } from './MemberRowActions'
import { PageSizeControl, SectionPaginator } from './SectionPaginator'

interface MemberDirectoryTableProps {
  members: Member[]
  voices: VoicePosition[]
  references: Map<string, string>
  sort: MemberSort
  dutyRoles: DutyRole[]
  onEdit: (member: Member) => void
  onTransfer: (member: Member) => void
  onDelete: (member: Member) => void
  canEdit: boolean
  canTransfer: boolean
  canDelete: boolean
  hasAnyMembers: boolean
  onClearFilters: () => void
  pageSize: MemberPageSize
  onPageSizeChange: (size: MemberPageSize) => void
  /** PNK sings one voice, so its table has no Voice column. */
  showVoice?: boolean
}

const headClass =
  'h-10 bg-background text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

/** The member's configured Choir Positions (duty-role names), in stored order. */
function positionsFor(member: Member, dutyRoles: DutyRole[]): string[] {
  const ids = member.assignedDutyRoleIds ?? []
  if (ids.length === 0) return []
  const nameById = new Map(dutyRoles.map((role) => [role.id, role.name]))
  return ids
    .map((id) => nameById.get(id))
    .filter((name): name is string => Boolean(name))
}

/**
 * Plain text rather than coloured chips: inside a gendered section the voice
 * badge and status already carry the row's accents, and a third colour made
 * the directory read as confetti.
 */
function ChoirPositions({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <span className="text-xs text-foreground/80">{names.join(', ')}</span>
  )
}

export function MemberDirectoryEmptyState({
  hasAnyMembers,
  onClearFilters,
}: {
  hasAnyMembers: boolean
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
            : 'Add members manually to build the directory.'}
        </p>
      </div>
      {hasAnyMembers ? (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Reset filters
        </Button>
      ) : null}
    </div>
  )
}

export function MemberDirectoryTable({
  members,
  voices,
  references,
  sort,
  dutyRoles,
  onEdit,
  onTransfer,
  onDelete,
  canEdit,
  canTransfer,
  canDelete,
  hasAnyMembers,
  onClearFilters,
  pageSize,
  onPageSizeChange,
  showVoice = true,
}: MemberDirectoryTableProps) {
  // The women's and men's sections page independently, so each keeps its own
  // page number rather than sharing one cursor across both.
  const [pages, setPages] = useState<Record<string, number>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const setSectionPage = (key: string, page: number) =>
    setPages((current) => ({ ...current, [key]: page }))
  const toggleSection = (key: string) =>
    setCollapsed((current) => ({ ...current, [key]: !current[key] }))

  if (members.length === 0) {
    return (
      <MemberDirectoryEmptyState
        hasAnyMembers={hasAnyMembers}
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
    // cannot blank a section.
    page: paginate(section.members, pages[section.key] ?? 1, pageSize),
  }))

  const anyPaged = sections.some((section) => section.page.pageCount > 1)

  return (
    <>
      {anyPaged ? (
        <div className="mb-3 flex justify-end">
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

      <div className="flex flex-col gap-3">
        {sections.map((section) => {
          const isCollapsed = Boolean(collapsed[section.key])
          const SectionIcon = section.icon
          return (
            <section
              key={section.key}
              className="overflow-hidden rounded-xl border border-border/70 bg-card"
            >
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => toggleSection(section.key)}
                className={cn(
                  'flex w-full items-center gap-2.5 border-b border-border/60 bg-brand-teal-soft/35 px-4 py-2.5 text-left transition-colors hover:bg-brand-teal-soft/55',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                )}
              >
                <SectionIcon className={cn('size-3.5', section.iconClass)} />
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-foreground/75">
                  {section.title}
                </span>
                <span className="rounded border border-border bg-background px-1.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
                  {section.page.total}
                </span>
                <span className="text-[0.625rem] tabular-nums text-muted-foreground/60">
                  #{section.page.firstItem}–#{section.page.lastItem} of #
                  {section.page.total}
                </span>
                <ChevronDown
                  className={cn(
                    'ml-auto size-4 text-muted-foreground transition-transform',
                    isCollapsed && '-rotate-90',
                  )}
                />
              </button>

              {isCollapsed ? null : (
                <>
                  <Table className="min-w-[52rem]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={`${headClass} w-14 text-center`}>
                          <span className="sr-only">#</span>
                        </TableHead>
                        <TableHead className={headClass}>Member</TableHead>
                        {showVoice && (
                          <TableHead className={headClass}>Voice</TableHead>
                        )}
                        <TableHead className={headClass}>
                          Choir Position
                        </TableHead>
                        <TableHead className={headClass}>Status</TableHead>
                        <TableHead className={`${headClass} w-12 text-right`}>
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.page.items.map((member, index) => (
                        <TableRow
                          key={member.id}
                          className="h-14 border-b border-border transition-colors hover:bg-background"
                        >
                          <TableCell className="w-14 text-center align-middle">
                            <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                              {section.page.firstItem + index}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <MemberInitialsAvatar member={member} sort={sort} />
                              <div className="min-w-0 leading-tight">
                                <p className="truncate text-[0.8125rem] font-semibold text-foreground">
                                  {formatMemberName(member, sort)}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1.5 text-[0.6875rem] tabular-nums text-muted-foreground">
                                  {references.get(member.id) ?? '—'}
                                  {memberIsReturned(member) && (
                                    <ReturnedMemberBadge />
                                  )}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          {showVoice && (
                            <TableCell>
                              <VoiceBadge
                                name={memberPositionLabel(member, voices)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <ChoirPositions
                              names={positionsFor(member, dutyRoles)}
                            />
                          </TableCell>
                          <TableCell>
                            <MemberLifecycleBadge member={member} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MemberRowActions
                              member={member}
                              sort={sort}
                              onEdit={onEdit}
                              onTransfer={onTransfer}
                              onDelete={onDelete}
                              canEdit={canEdit}
                              canTransfer={canTransfer}
                              canDelete={canDelete}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {section.page.pageCount > 1 ? (
                    <SectionPaginator
                      label={section.title}
                      page={section.page}
                      onPageChange={(page) =>
                        setSectionPage(section.key, page)
                      }
                    />
                  ) : null}
                </>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
