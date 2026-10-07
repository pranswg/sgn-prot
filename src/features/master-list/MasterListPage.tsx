import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  FileUp,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowDownAZ,
  ChevronDown,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useNavStore } from '@/store/navStore'
import { useSidebarStore } from '@/store/sidebarStore'
import type { ChoirPosition, Member } from '@/core/types/member'
import { CHOIR_POSITIONS, POSITION_LABELS } from '@/core/constants/choirPositions'
import { MEMBERSHIP_OPTIONS } from '@/core/constants/memberMembership'
import { exportCSV, exportExcel, membersToRows } from '@/lib/export'
import {
  EMPTY_DIRECTORY_FILTERS,
  MEMBER_SORT_LABEL,
  buildMemberReferences,
  computeDirectoryStats,
  countActiveDirectoryFilters,
  countMembersByPosition,
  DEFAULT_MEMBER_PAGE_SIZE,
  filterMembers,
  filtersForStartView,
  formatMemberName,
  hasActiveDirectoryFilters,
  paginate,
  quickFilterLabel,
  toggleInList,
  type MemberDirectoryFilters,
  type MemberPageSize,
  type MemberSort,
} from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import { todayPHT } from '@/lib/phDate'
import { MemberFormDialog } from './MemberFormDialog'
import { MemberDetailDialog } from './MemberDetailDialog'
import { ImportRosterDialog } from './ImportRosterDialog'
import {
  MemberDirectoryTable,
  MemberDirectoryEmptyState,
} from './MemberDirectoryTable'
import { PageSizeControl, SectionPaginator } from './SectionPaginator'
import { StatCards, type StatAction } from './StatCards'
import { MobileDirectoryHeader } from './MobileDirectoryHeader'
import { MobileMemberCard } from './MobileMemberCard'
import { MemberActionSheet } from './MemberActionSheet'
import { MobileFilterSheet } from './MobileFilterSheet'
import {
  MOBILE_FILTER_LABEL,
  MOBILE_FILTER_SECTIONS,
  type MobileFilterSection,
} from './mobileFilters'
import { MemberProfileSheet } from './MemberProfileSheet'
import { MobileMemberFormSheet } from './MobileMemberFormSheet'

const GENDER_LABEL: Record<string, string> = {
  female: "Women's Choir",
  male: "Men's Choir",
}

/** Mobile grouping control above the card list. */
const GENDER_SEGMENTS: {
  value: 'all' | 'male' | 'female'
  label: string
}[] = [
  { value: 'all', label: 'All' },
  { value: 'female', label: 'Women' },
  { value: 'male', label: 'Men' },
]

/**
 * What a filter chip shows once its selection is narrower than "all": the
 * chosen label for the single-choice filters, a count for the multi-selects,
 * and undefined when the filter is wide open. The undefined case is also what
 * decides the chip's neutral versus active styling.
 */
function filterChipValue(
  section: MobileFilterSection,
  filters: MemberDirectoryFilters,
): string | undefined {
  switch (section) {
    case 'status':
      if (filters.status === 'all') return undefined
      return filters.status === 'active' ? 'Active' : 'Inactive'
    case 'voices':
      return filters.voices.length > 0
        ? `${filters.voices.length} selected`
        : undefined
    case 'roles': {
      const count =
        filters.positions.length + (filters.quick !== 'all' ? 1 : 0)
      return count > 0 ? `${count} selected` : undefined
    }
  }
}

export function MasterListPage() {
  const members = useMemberStore((s) => s.members)
  const trainees = useMemberStore((s) => s.trainees)
  const removeMember = useMemberStore((s) => s.removeMember)
  const deactivateMember = useMemberStore((s) => s.deactivateMember)
  const reactivateMember = useMemberStore((s) => s.reactivateMember)
  const voices = useSettingsStore((s) => s.voices)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const navigate = useNavStore((s) => s.navigate)
  const setMobileDrawerOpen = useSidebarStore((s) => s.setMobileDrawerOpen)
  const isMobile = useIsMobile()

  const voiceMap = useMemo(() => allVoices(), [allVoices])

  // The dashboard KPI cards navigate straight into a filtered Master List, so
  // the first filters are the one-shot view they set rather than the wide-open
  // directory. It is read during first render and then forgotten so a later
  // plain navigation cannot re-apply a card the user has long left.
  const [filters, setFilters] = useState<MemberDirectoryFilters>(() => {
    const start = useNavStore.getState().directoryStart
    return start ? filtersForStartView(start) : EMPTY_DIRECTORY_FILTERS
  })
  useEffect(() => {
    useNavStore.getState().clearDirectoryStart()
  }, [])
  const [sort, setSort] = useState<MemberSort>('last-name')
  // The "Recently Added" quick filter owns the ordering too: turning it on
  // flips the directory to newest-first, and the sort control shows that
  // choice instead of a stale label while the rows are date-ordered.
  const effectiveSort: MemberSort =
    filters.quick === 'recent' ? 'recently-added' : sort
  const [pageSize, setPageSize] =
    useState<MemberPageSize>(DEFAULT_MEMBER_PAGE_SIZE)
  // The mobile card list is a single flat list rather than two choir sections,
  // so it keeps one page number of its own instead of borrowing the desktop's.
  const [mobilePage, setMobilePage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [profileTarget, setProfileTarget] = useState<Member | null>(null)
  const [desktopDetailTarget, setDesktopDetailTarget] = useState<Member | null>(
    null,
  )
  const [actionTarget, setActionTarget] = useState<Member | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  // null closes the sheet; otherwise it names the one filter being edited.
  const [filterSheetSection, setFilterSheetSection] =
    useState<MobileFilterSection | null>(null)

  const references = useMemo(() => buildMemberReferences(members), [members])
  const stats = useMemo(
    () => computeDirectoryStats(members, trainees, voices),
    [members, trainees, voices],
  )
  const positionCounts = useMemo(
    () => countMembersByPosition(members),
    [members],
  )
  const voiceCounts = useMemo(
    () => new Map(stats.voiceCounts.map((v) => [v.id, v.count] as const)),
    [stats],
  )

  const filteredMembers = useMemo(
    () => filterMembers(members, filters, voices, references, effectiveSort),
    [members, filters, voices, references, effectiveSort],
  )

  // The profile sheet stays open across a deactivate, so it reads the member
  // back out of the store instead of holding the snapshot it was opened with.
  const profileMember = profileTarget
    ? (members.find((m) => m.id === profileTarget.id) ?? null)
    : null

  // Match count for the filter sheet's Apply button, evaluated against the
  // in-progress edits rather than the filters that are already applied.
  const previewCount = (candidate: MemberDirectoryFilters) =>
    filterMembers(members, candidate, voices, references, effectiveSort).length

  const filtersActive = hasActiveDirectoryFilters(filters)
  const activeFilterCount = countActiveDirectoryFilters(filters)
  // Which KPI card the directory currently reflects: the wide-open view maps
  // to Total, otherwise the status filter's card. Null when narrowed by a
  // filter no card owns (voice, position, query).
  const selectedStat: StatAction | null = !filtersActive
    ? 'all'
    : filters.status === 'active'
      ? 'active'
      : filters.status === 'inactive'
        ? 'inactive'
        : null
  // The search field has its own clear button, so the chip row only offers a
  // bulk clear for the selections that do not.
  const selectableFilterCount =
    activeFilterCount - (filters.query.trim() !== '' ? 1 : 0)
  const filteredCount = filteredMembers.length
  // Clamped on read, so narrowing the filters mid-page cannot leave the mobile
  // list stranded on an empty page 4.
  const mobilePageResult = paginate(filteredMembers, mobilePage, pageSize)
  const totalCount = members.length

  const setFilter = <K extends keyof MemberDirectoryFilters>(
    key: K,
    value: MemberDirectoryFilters[K],
  ) => setFilters((f) => ({ ...f, [key]: value }))

  const clearFilters = () => setFilters(EMPTY_DIRECTORY_FILTERS)

  // Tapping a KPI card either narrows the directory to that cohort or jumps to
  // the Trainees tab. The filters reset first so the listed members are exactly
  // the cohort the card counts.
  const selectStat = (action: StatAction) => {
    if (action === 'trainees') {
      navigate('trainees')
      return
    }
    setFilters(
      action === 'all'
        ? EMPTY_DIRECTORY_FILTERS
        : { ...EMPTY_DIRECTORY_FILTERS, status: action },
    )
    setMobilePage(1)
  }

  const openAddDialog = () => {
    setEditingMember(null)
    setFormOpen(true)
  }

  const openEditDialog = (member: Member) => {
    setProfileTarget(null)
    setDesktopDetailTarget(null)
    setEditingMember(member)
    setFormOpen(true)
  }

  const handleAssign = (member: Member) => {
    startNewSuguan()
    toast.success(
      `Choir Suguan ready — assign ${formatMemberName(member, sort)} to a slot.`,
    )
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    if (filteredCount === 0) {
      toast.error('No members to export.')
      return
    }
    const rows = membersToRows(filteredMembers) as unknown as Record<
      string,
      string | number
    >[]
    const suffix = `${filters.gender === 'all' ? 'all' : filters.gender}${
      filters.query.trim() ? '-filtered' : ''
    }`
    const filename = `master-list-${suffix}-${todayPHT()}`
    try {
      if (format === 'csv') {
        exportCSV(rows, `${filename}.csv`)
      } else {
        await exportExcel(rows, `${filename}.xlsx`)
      }
      toast.success(
        `Exported ${filteredCount} members as ${format.toUpperCase()}.`,
      )
    } catch {
      toast.error('Export failed.')
    }
  }

  const directoryProps = {
    members: filteredMembers,
    voices,
    references,
    sort,
    onView: setDesktopDetailTarget,
    onEdit: openEditDialog,
    onDelete: setRemoveTarget,
    onImport: () => setImportOpen(true),
    hasAnyMembers: members.length > 0,
    onClearFilters: clearFilters,
  }

  return (
    <div className="flex flex-col gap-5">
      <MobileDirectoryHeader
        title="Master List"
        description="Manage choir members"
        onOpenMenu={() => setMobileDrawerOpen(true)}
        onAddMember={openAddDialog}
        onImportRoster={() => setImportOpen(true)}
        onExport={handleExport}
      />

      <PageHeader
        eyebrow="Choir Registry"
        title="Master List"
        description="Manage your choir members, trainees, and positions."
        className="hidden md:flex"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  Export current view ({filteredCount})
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>
                  Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="size-4" />
              Import Roster
            </Button>
            <Button onClick={openAddDialog}>
              <Plus className="size-4" />
              Add Member
            </Button>
          </>
        }
      />

      <StatCards stats={stats} selected={selectedStat} onSelect={selectStat} />

      {/* Search & filter toolbar. Every directory filter lives here (choir
          segment, membership, status, voices, positions, sort). Sticky under
          the screen header so the filters stay with you while the list
          scrolls, taking over from the removed sticky side panel. */}
      <div
        className={cn(
          'sticky top-14 z-20 -mx-4 flex flex-col gap-2.5 border-b border-border/70 bg-background px-4 py-2.5',
          'md:top-14 md:mx-0 md:gap-3 md:rounded-xl md:border md:px-3 md:py-3 md:bg-card',
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => setFilter('query', e.target.value)}
              placeholder="Search member name, ID, or position..."
              aria-label="Search members"
              className="h-12 rounded-lg bg-background pl-9 pr-9 md:h-10"
            />
            {filters.query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setFilter('query', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {/* Same choir segment the mobile list uses, promoted to desktop. */}
            <div
              role="group"
              aria-label="Filter by choir"
              className="grid grid-cols-3 gap-0.5 rounded-lg border border-input bg-background p-0.5"
            >
              {GENDER_SEGMENTS.map((segment) => (
                <button
                  key={segment.value}
                  type="button"
                  aria-pressed={filters.gender === segment.value}
                  onClick={() => setFilter('gender', segment.value)}
                  className={cn(
                    'h-8 rounded-md px-2.5 text-xs font-medium transition-colors',
                    filters.gender === segment.value
                      ? 'bg-brand-navy text-white'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {segment.label}
                </button>
              ))}
            </div>

            <Select
              value={filters.status}
              onValueChange={(v) =>
                setFilter('status', v as MemberDirectoryFilters['status'])
              }
            >
              <SelectTrigger
                aria-label="Filter by status"
                className="h-9 w-[9.5rem] bg-background text-[0.8125rem]"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'h-9 gap-1.5 px-3 text-[0.8125rem] font-normal',
                    filters.voices.length > 0 &&
                      'border-brand-teal/40 bg-brand-teal-soft text-brand-teal',
                  )}
                >
                  {filters.voices.length === 0
                    ? 'Voice Positions'
                    : filters.voices.length === 1
                      ? (voices.find((v) => v.id === filters.voices[0])
                          ?.name ?? 'Voice Positions')
                      : `${filters.voices.length} Voices`}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Voice Positions
                </DropdownMenuLabel>
                {voices.map((voice) => (
                  <DropdownMenuCheckboxItem
                    key={voice.id}
                    checked={filters.voices.includes(voice.id)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      setFilter('voices', toggleInList(filters.voices, voice.id))
                    }
                  >
                    <span className="flex-1">{voice.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {voiceCounts.get(voice.id) ?? 0}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'h-9 gap-1.5 px-3 text-[0.8125rem] font-normal',
                    (filters.positions.length > 0 ||
                      filters.quick !== 'all') &&
                      'border-brand-teal/40 bg-brand-teal-soft text-brand-teal',
                  )}
                >
                  {filters.positions.length === 0 && filters.quick === 'all'
                    ? 'Membership & Roles'
                    : `${
                        filters.positions.length +
                        (filters.quick !== 'all' ? 1 : 0)
                      } Selected`}
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Membership
                </DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={filters.quick === 'recent'}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() =>
                    setFilter(
                      'quick',
                      filters.quick === 'recent' ? 'all' : 'recent',
                    )
                  }
                >
                  <span className="flex-1">Recently Added</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {stats.total}
                  </span>
                </DropdownMenuCheckboxItem>
                {MEMBERSHIP_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={filters.quick === option.value}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      setFilter(
                        'quick',
                        filters.quick === option.value ? 'all' : option.value,
                      )
                    }
                  >
                    <span className="flex-1">{option.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {stats.membershipCounts.get(option.value) ?? 0}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuLabel className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Choir Positions
                </DropdownMenuLabel>
                {CHOIR_POSITIONS.map((position) => (
                  <DropdownMenuCheckboxItem
                    key={position.id}
                    checked={filters.positions.includes(position.id)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      setFilter(
                        'positions',
                        toggleInList(filters.positions, position.id),
                      )
                    }
                  >
                    <span className="flex-1">
                      {POSITION_LABELS[position.id]}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {positionCounts.get(position.id) ?? 0}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Select
              value={effectiveSort}
              onValueChange={(v) => {
                setSort(v as MemberSort)
                if (filters.quick === 'recent') setFilter('quick', 'all')
              }}
            >
              <SelectTrigger
                aria-label="Sort members"
                className="h-9 w-[11.5rem] bg-background text-[0.8125rem]"
              >
                <ArrowDownAZ className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEMBER_SORT_LABEL) as MemberSort[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {MEMBER_SORT_LABEL[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              disabled={!filtersActive}
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <SlidersHorizontal className="size-4" />
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Mobile filter chips: one focused bottom sheet each, so the toolbar
            never needs a permanently visible column of controls. The three
            chips share the row equally; Clear only ever takes its own edge. */}
        <div className="flex items-center gap-2 md:hidden">
          <div className="grid flex-1 grid-cols-3 gap-2">
            {MOBILE_FILTER_SECTIONS.map((section) => {
              const value = filterChipValue(section, filters)
              return (
                <button
                  key={section}
                  type="button"
                  onClick={() => setFilterSheetSection(section)}
                  className={cn(
                    'inline-flex h-9 w-full min-w-0 items-center justify-center gap-1.5 truncate rounded-lg border px-2 text-xs font-medium transition-colors',
                    value
                      ? 'border-brand-teal/40 bg-brand-teal-soft text-brand-teal'
                      : 'border-border/70 bg-card text-muted-foreground active:bg-muted',
                  )}
                >
                  <span className="truncate">
                    {value ?? MOBILE_FILTER_LABEL[section]}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0" />
                </button>
              )
            })}
          </div>
          {selectableFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-red-600/25 bg-red-500/10 px-3 text-xs font-medium text-red-700 dark:text-red-300"
            >
              <X className="size-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* Choir segment under the other mobile filters, inside the toolbar. */}
        <div
          role="group"
          aria-label="Filter by choir"
          className="grid grid-cols-3 gap-0.5 rounded-lg border border-border bg-card p-0.5 md:hidden"
        >
          {GENDER_SEGMENTS.map((segment) => (
            <button
              key={segment.value}
              type="button"
              aria-pressed={filters.gender === segment.value}
              onClick={() => setFilter('gender', segment.value)}
              className={cn(
                'h-8 rounded-md text-xs font-medium transition-colors',
                filters.gender === segment.value
                  ? 'bg-brand-navy text-white'
                  : 'text-muted-foreground active:bg-muted',
              )}
            >
              {segment.label}
            </button>
          ))}
        </div>

        {filtersActive && (
          <div className="hidden flex-wrap items-center gap-2 border-t border-border/60 pt-3 md:flex">
            <span className="text-[0.6875rem] font-medium text-muted-foreground">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}{' '}
              active
            </span>
            {filters.voices.map((id) => (
              <FilterChip
                key={`voice-${id}`}
                label={voices.find((v) => v.id === id)?.name ?? id}
                onClear={() =>
                  setFilter('voices', toggleInList(filters.voices, id))
                }
              />
            ))}
            {filters.positions.map((id) => (
              <FilterChip
                key={`position-${id}`}
                label={POSITION_LABELS[id as ChoirPosition] ?? id}
                onClear={() =>
                  setFilter('positions', toggleInList(filters.positions, id))
                }
              />
            ))}
            {filters.quick !== 'all' && (
              <FilterChip
                label={quickFilterLabel(filters.quick)}
                onClear={() => setFilter('quick', 'all')}
              />
            )}
            {filters.gender !== 'all' && (
              <FilterChip
                label={GENDER_LABEL[filters.gender]}
                onClear={() => setFilter('gender', 'all')}
              />
            )}
            {filters.status !== 'all' && (
              <FilterChip
                label={filters.status}
                onClear={() => setFilter('status', 'all')}
              />
            )}
          </div>
        )}
      </div>

      {/* Member directory */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Member Directory
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Showing{' '}
              <span className="font-medium tabular-nums text-foreground/80">
                {filteredCount}
              </span>{' '}
              of {totalCount} members
            </p>
          </div>
        </div>

        {/* Mobile sort, stacked under the heading. The choir segment lives in
            the toolbar's scrolling chip row instead. */}
        <div className="flex flex-col gap-2 md:hidden">
          <Select
            value={effectiveSort}
            onValueChange={(v) => {
              setSort(v as MemberSort)
              if (filters.quick === 'recent') setFilter('quick', 'all')
            }}
          >
            <SelectTrigger
              aria-label="Sort members"
              className="h-10 w-full bg-background text-[0.8125rem]"
            >
              <ArrowDownAZ className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MEMBER_SORT_LABEL) as MemberSort[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {MEMBER_SORT_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col">
          {/* Mobile card list */}
          <div className="md:hidden">
            {filteredMembers.length === 0 ? (
              <MemberDirectoryEmptyState
                hasAnyMembers={totalCount > 0}
                onImport={() => setImportOpen(true)}
                onClearFilters={clearFilters}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <ul className="flex flex-col gap-2">
                  {mobilePageResult.items.map((member, index) => (
                    <MobileMemberCard
                      key={member.id}
                      member={member}
                      number={mobilePageResult.firstItem + index}
                      reference={references.get(member.id)}
                      voices={voiceMap}
                      sort={sort}
                      onOpen={setProfileTarget}
                      onOpenMenu={setActionTarget}
                    />
                  ))}
                </ul>
                {mobilePageResult.pageCount > 1 ? (
                  <>
                    <div className="flex items-center justify-end">
                      <PageSizeControl
                        value={pageSize}
                        onChange={(size) => {
                          setMobilePage(1)
                          setPageSize(size)
                        }}
                      />
                    </div>
                    <div className="rounded-lg border border-border/70 bg-card">
                      <SectionPaginator
                        label="members"
                        page={mobilePageResult}
                        onPageChange={setMobilePage}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>

          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card md:block">
            <MemberDirectoryTable
              {...directoryProps}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </section>

      {/* Mobile filter sheet */}
      <MobileFilterSheet
        open={filterSheetSection !== null}
        section={filterSheetSection ?? 'voices'}
        onOpenChange={(open) => {
          if (!open) setFilterSheetSection(null)
        }}
        filters={filters}
        onApply={setFilters}
        voices={voices}
        stats={stats}
        previewCount={previewCount}
      />

      {/* Mobile three-dot member actions */}
      <MemberActionSheet
        member={actionTarget}
        sort={sort}
        onOpenChange={(open) => {
          if (!open) setActionTarget(null)
        }}
        onView={(member) => {
          setActionTarget(null)
          setProfileTarget(member)
        }}
        onEdit={(member) => {
          setActionTarget(null)
          openEditDialog(member)
        }}
        onAssign={(member) => {
          setActionTarget(null)
          handleAssign(member)
        }}
        onRemove={(member) => {
          setActionTarget(null)
          setRemoveTarget(member)
        }}
      />

      {isMobile ? (
        <MobileMemberFormSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          member={editingMember}
          onSaved={() => setProfileTarget(null)}
        />
      ) : (
        <MemberFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          member={editingMember}
          onSaved={() => setDesktopDetailTarget(null)}
        />
      )}

      <ImportRosterDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Mobile profile screen */}
      <MemberProfileSheet
        member={isMobile ? profileMember : null}
        reference={
          isMobile && profileMember
            ? references.get(profileMember.id)
            : undefined
        }
        sort={sort}
        onOpenChange={(open) => {
          if (!open) setProfileTarget(null)
        }}
        onEdit={openEditDialog}
        onToggleStatus={(member) => {
          const name = formatMemberName(member, sort)
          if (member.isActive) {
            deactivateMember(member.id)
            toast.success(`${name} deactivated.`)
          } else {
            reactivateMember(member.id)
            toast.success(`${name} reactivated.`)
          }
        }}
      />

      <MemberDetailDialog
        member={isMobile ? null : desktopDetailTarget}
        onOpenChange={(open) => {
          if (!open) setDesktopDetailTarget(null)
        }}
        onEdit={() =>
          desktopDetailTarget && openEditDialog(desktopDetailTarget)
        }
      />

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.firstName} {removeTarget?.lastName} from the
              Master List? This cannot be undone. Consider deactivating instead
              to preserve history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                if (removeTarget) {
                  removeMember(removeTarget.id)
                  toast.success('Member removed.')
                  setRemoveTarget(null)
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FilterChip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-md border border-brand-teal/25 bg-brand-teal-soft py-0.5 pl-2 pr-1.5 text-[0.6875rem] font-medium capitalize text-brand-teal transition-colors hover:border-brand-teal/50"
    >
      {label}
      <X className="size-3" />
    </button>
  )
}
