import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  FileDown,
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
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useNavStore } from '@/store/navStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { formatPHTDateTime } from '@/lib/phDate'
import type { ChoirPosition, Member } from '@/core/types/member'
import { CHOIR_POSITIONS, POSITION_LABELS } from '@/core/constants/choirPositions'
import { MEMBERSHIP_OPTIONS } from '@/core/constants/memberMembership'
import {
  exportCSVRows,
  exportMasterListExcel,
  exportMasterListWord,
  masterListToSpreadsheetRows,
} from '@/lib/export'
import { exportMasterListPdf } from './masterListPdfExport'
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
import { belongsInMasterList } from '@/lib/memberHistory'
import { cn } from '@/lib/utils'
import { exportFileName, masterListExportDocumentName } from '@/lib/exportNaming'
import { MemberFormDialog } from './MemberFormDialog'
import { MemberDetailDialog } from './MemberDetailDialog'
import {
  MemberDirectoryTable,
  MemberDirectoryEmptyState,
} from './MemberDirectoryTable'
import { PageSizeControl, SectionPaginator } from './SectionPaginator'
import { StatCards, type StatAction } from './StatCards'
import { MobileDirectoryHeader } from '@/components/MobileDirectoryHeader'
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
import {
  MasterListPdfSetupDialog,
} from './MasterListPdfSetupDialog'
import type { MasterListPaperSize } from './masterListPaperSizes'
import { usePermissions } from '@/hooks/usePermissions'
import { useExportPreview } from '@/hooks/useExportPreview'
import {
  MemberLifecycleDialog,
  MemberLifecycleSheet,
  type LifecycleFormKind,
} from '@/features/members-history/MemberLifecycleForm'

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
  const lastUpdatedAt = useMemberStore((s) => s.lastUpdatedAt)
  const deactivateMember = useMemberStore((s) => s.deactivateMember)
  const reactivateMember = useMemberStore((s) => s.reactivateMember)
  const voices = useSettingsStore((s) => s.voices)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const dutyRoles = useSettingsStore((s) => s.dutyRoles)
  const localeName = useSettingsStore((s) => s.localeName)
  const setLocaleName = useSettingsStore((s) => s.setLocaleName)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const navigate = useNavStore((s) => s.navigate)
  const setMobileDrawerOpen = useSidebarStore((s) => s.setMobileDrawerOpen)
  const isMobile = useIsMobile()
  const { can } = usePermissions()
  const canAddMembers = can('add-members')
  const canEditMembers = can('edit-members')
  // A member who transfers out (admin-only) is never deleted from the archive;
  // the lifecycle form records the date, reason, and notes as history events.
  const canManageHistory = can('manage-membership-history')
  const canAssignMembers = can('assign-members')
  const canExportDocuments = can('export-documents')
  // Only a settings-editor may persist the congregation name; for everyone else
  // it is used for this export alone, so their denied write never fires.
  const canChangeSettings = can('change-settings')
  const updatedAt = new Date(lastUpdatedAt)
  const lastUpdatedLabel = `${formatPHTDateTime(updatedAt, {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  })} - ${formatPHTDateTime(updatedAt, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`

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
  const [pdfSetupOpen, setPdfSetupOpen] = useState(false)
  const [wordSetupOpen, setWordSetupOpen] = useState(false)
  const { exportPreview, requestExport } = useExportPreview()
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [profileTarget, setProfileTarget] = useState<Member | null>(null)
  const [desktopDetailTarget, setDesktopDetailTarget] = useState<Member | null>(
    null,
  )
  const [actionTarget, setActionTarget] = useState<Member | null>(null)
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    member: Member
    kind: LifecycleFormKind
  } | null>(null)
  // null closes the sheet; otherwise it names the one filter being edited.
  const [filterSheetSection, setFilterSheetSection] =
    useState<MobileFilterSection | null>(null)

  // References are built from the full persisted roster so M-001 codes never
  // shift for the remaining members when someone is transferred out.
  const references = useMemo(() => buildMemberReferences(members), [members])
  // A formal transfer moves the member off the Master List entirely — they
  // live on the Members History page from then on — so every list-scoped read
  // (counts, filters, table, exports) works from this narrowed roster.
  const directoryMembers = useMemo(
    () => members.filter(belongsInMasterList),
    [members],
  )
  const stats = useMemo(
    () => computeDirectoryStats(directoryMembers, trainees, voices),
    [directoryMembers, trainees, voices],
  )
  const positionCounts = useMemo(
    () => countMembersByPosition(directoryMembers),
    [directoryMembers],
  )
  const voiceCounts = useMemo(
    () => new Map(stats.voiceCounts.map((v) => [v.id, v.count] as const)),
    [stats],
  )

  const filteredMembers = useMemo(
    () =>
      filterMembers(directoryMembers, filters, voices, references, effectiveSort),
    [directoryMembers, filters, voices, references, effectiveSort],
  )

  // The profile sheet stays open across a deactivate, so it reads the member
  // back out of the store instead of holding the snapshot it was opened with.
  const profileMember = profileTarget
    ? (members.find((m) => m.id === profileTarget.id) ?? null)
    : null

  // Match count for the filter sheet's Apply button, evaluated against the
  // in-progress edits rather than the filters that are already applied.
  const previewCount = (candidate: MemberDirectoryFilters) =>
    filterMembers(directoryMembers, candidate, voices, references, effectiveSort)
      .length

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
  const totalCount = directoryMembers.length

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

  const handleExport = (format: 'csv' | 'excel') => {
    if (filteredCount === 0) {
      toast.error('No members to export.')
      return
    }
    const fileName = exportFileName(
      masterListExportDocumentName(filters.gender),
      format,
    )
    requestExport({
      filename: fileName,
      onConfirm: () => void runSpreadsheetExport(format, fileName),
    })
  }

  const runSpreadsheetExport = async (
    format: 'csv' | 'excel',
    fileName: string,
  ) => {
    const rows = masterListToSpreadsheetRows(
      filteredMembers,
      trainees.filter(
        (trainee) =>
          trainee.status === 'active' || trainee.status === 'inactive',
      ),
      voices,
      dutyRoles,
      localeName,
    )
    try {
      if (format === 'csv') {
        exportCSVRows(rows, fileName)
      } else {
        await exportMasterListExcel(rows, fileName)
      }
      toast.success(
        `Exported the Master List as ${format.toUpperCase()}.`,
      )
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? `Export failed: ${error.message}`
          : 'Export failed.',
      )
    }
  }

  const handlePdfExport = async (
    name: string,
    paperSize: MasterListPaperSize,
  ) => {
    setPdfSetupOpen(false)
    if (canChangeSettings) setLocaleName(name)
    const fileName = exportFileName('Master List', 'pdf')
    requestExport({
      filename: fileName,
      onConfirm: () => void runPdfExport(name, paperSize, fileName),
    })
  }

  const runPdfExport = async (
    name: string,
    paperSize: MasterListPaperSize,
    fileName: string,
  ) => {
    try {
      await exportMasterListPdf(
        directoryMembers,
        trainees,
        voices,
        dutyRoles,
        name,
        paperSize,
        fileName,
      )
      toast.success('Master List exported as PDF.')
    } catch (error) {
      console.error(error)
      toast.error('Could not export the Master List PDF.')
    }
  }

  const handleWordExport = async (
    name: string,
    paperSize: MasterListPaperSize,
  ) => {
    setWordSetupOpen(false)
    if (canChangeSettings) setLocaleName(name)
    const fileName = exportFileName('Master List', 'docx')
    requestExport({
      filename: fileName,
      onConfirm: () => void runWordExport(name, paperSize, fileName),
    })
  }

  const runWordExport = async (
    name: string,
    paperSize: MasterListPaperSize,
    fileName: string,
  ) => {
    try {
      await exportMasterListWord(
        directoryMembers,
        trainees,
        voices,
        dutyRoles,
        name,
        paperSize,
        fileName,
      )
      toast.success('Master List exported as Word.')
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? `Word export failed: ${error.message}`
          : 'Could not export the Master List Word document.',
      )
    }
  }

  const directoryProps = {
    members: filteredMembers,
    voices,
    references,
    sort,
    onView: setDesktopDetailTarget,
    onEdit: openEditDialog,
    onTransfer: (member: Member) =>
      setLifecycleTarget({ member, kind: 'transfer' }),
    canEdit: canEditMembers,
    canTransfer: canManageHistory,
    hasAnyMembers: directoryMembers.length > 0,
    onClearFilters: clearFilters,
  }

  return (
    <div className="flex flex-col gap-5">
      {exportPreview}
      <MobileDirectoryHeader
        title="Master List"
        description="Manage choir members"
        onOpenMenu={() => setMobileDrawerOpen(true)}
      />

      <PageHeader
        eyebrow="Choir Registry"
        title="Master List"
        description="Manage your choir members, trainees, and positions."
        className="hidden md:flex"
      />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border/70 bg-card px-4 py-3 text-sm">
        <span className="font-medium text-foreground">
          Master List last updated on
        </span>
        <time
          dateTime={lastUpdatedAt}
          className="text-muted-foreground"
        >
          {lastUpdatedLabel}
        </time>
      </div>

      <StatCards stats={stats} selected={selectedStat} onSelect={selectStat} />

      {canExportDocuments && (
        <div className="flex items-center gap-3">
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="ml-auto">
                  <Download className="size-4" />
                  Export Data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export data</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <Download className="size-4" />
                  CSV (current view)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>
                  <Download className="size-4" />
                  Excel (current view)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWordSetupOpen(true)}>
                  <Download className="size-4" />
                  Word (full Master List)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPdfSetupOpen(true)}>
                  <FileDown className="size-4" />
                  PDF (full Master List)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )}

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
          <div className="flex items-center justify-between gap-3">
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
            {canAddMembers && (
              <Button
                size="default"
                className="shrink-0"
                onClick={openAddDialog}
              >
                <Plus className="size-4" />
                Add Member
              </Button>
            )}
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
                      hasActions={canEditMembers || canAssignMembers || canManageHistory}
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
        onTransfer={(member) => {
          setActionTarget(null)
          setLifecycleTarget({ member, kind: 'transfer' })
        }}
        canEdit={canEditMembers}
        canAssign={canAssignMembers}
        canTransfer={canManageHistory}
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

      {pdfSetupOpen && (
        <MasterListPdfSetupDialog
          onOpenChange={setPdfSetupOpen}
          savedLocaleName={localeName}
          onExport={handlePdfExport}
        />
      )}
      {wordSetupOpen && (
        <MasterListPdfSetupDialog
          documentType="Word"
          onOpenChange={setWordSetupOpen}
          savedLocaleName={localeName}
          onExport={handleWordExport}
        />
      )}

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
        onLifecycle={(member) =>
          setLifecycleTarget({
            member,
            kind: member.isActive ? 'transfer' : 'restore',
          })
        }
        canManage={canEditMembers}
        canLifecycle={canManageHistory}
      />

      <MemberDetailDialog
        member={isMobile ? null : desktopDetailTarget}
        onOpenChange={(open) => {
          if (!open) setDesktopDetailTarget(null)
        }}
        onEdit={() =>
          desktopDetailTarget && openEditDialog(desktopDetailTarget)
        }
        onTransfer={(member) =>
          setLifecycleTarget({ member, kind: 'transfer' })
        }
        canEdit={canEditMembers}
        canTransfer={canManageHistory}
      />

      {lifecycleTarget &&
        (isMobile ? (
          <MemberLifecycleSheet
            open
            onOpenChange={(open: boolean) => {
              if (!open) setLifecycleTarget(null)
            }}
            member={lifecycleTarget.member}
            kind={lifecycleTarget.kind}
          />
        ) : (
          <MemberLifecycleDialog
            open
            onOpenChange={(open: boolean) => {
              if (!open) setLifecycleTarget(null)
            }}
            member={lifecycleTarget.member}
            kind={lifecycleTarget.kind}
          />
        ))}
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
