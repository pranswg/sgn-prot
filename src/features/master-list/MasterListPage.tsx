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
  Mars,
  Music2,
  ShieldCheck,
  Venus,
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useNavStore } from '@/store/navStore'
import { useSidebarStore } from '@/store/sidebarStore'
import { formatPHTDateTime } from '@/lib/phDate'
import type { Choir, Member } from '@/core/types/member'
import { CHOIR_LABELS, membersOf, traineesOf } from '@/lib/choirs'
import { CHOIR_PAGES } from '@/lib/sidebarNav'
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
  DEFAULT_MEMBER_PAGE_SIZE,
  filterMembers,
  filtersForStartView,
  groupMembersByGender,
  hasActiveDirectoryFilters,
  paginate,
  type MemberDirectoryFilters,
  type MemberPageSize,
  type MemberSort,
} from '@/lib/memberDirectory'
import { belongsInMasterList } from '@/lib/memberHistory'
import { cn } from '@/lib/utils'
import { exportFileName, masterListExportDocumentName } from '@/lib/exportNaming'
import { MemberFormDialog } from './MemberFormDialog'
import {
  MemberDirectoryTable,
  MemberDirectoryEmptyState,
} from './MemberDirectoryTable'
import { PageSizeControl } from './SectionPaginator'
import { StatCards, type StatAction } from './StatCards'
import { MobileDirectoryHeader } from '@/components/MobileDirectoryHeader'
import { MobileChoirSection } from './MobileChoirSection'
import { MemberActionDialog } from './MemberActionDialog'
import { MobileFilterDialog } from './MobileFilterDialog'
import {
  MOBILE_FILTER_LABEL,
  MOBILE_FILTER_SECTIONS,
  type MobileFilterSection,
} from './mobileFilters'
import { MobileMemberFormDialog } from './MobileMemberFormDialog'
import {
  MasterListPdfSetupDialog,
} from './MasterListPdfSetupDialog'
import {
  MasterListAttendanceDialog,
  type MasterListAttendanceExportFormat,
} from './MasterListAttendanceDialog'
import type { MasterListPaperSize } from './masterListPaperSizes'
import {
  exportMasterListAttendancePdf,
  type MasterListAttendanceOptions,
} from './masterListAttendancePdf'
import { exportMasterListAttendanceWord } from './masterListAttendanceWord'
import { usePermissions } from '@/hooks/usePermissions'
import { useExportPreview } from '@/hooks/useExportPreview'
import {
  MemberLifecycleDialog,
  type LifecycleFormKind,
} from '@/features/members-history/MemberLifecycleForm'

/**
 * Sentinel value for the "Clear" row inside the voice/position dropdowns.
 * It never reaches a filter: the handlers turn it into an empty list, and the
 * triggers read an empty list as their placeholder.
 */
const CLEAR_FILTER = '__clear'

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
 * What a filter chip shows once its selection is narrower than "all": a count
 * for the multi-selects, and undefined when the filter is wide open. The
 * undefined case is also what decides the chip's neutral versus active
 * styling.
 */
function filterChipValue(
  section: MobileFilterSection,
  filters: MemberDirectoryFilters,
): string | undefined {
  switch (section) {
    case 'voices':
      return filters.voices.length > 0
        ? `${filters.voices.length} selected`
        : undefined
    case 'roles': {
      const count = filters.positions.length
      return count > 0 ? `${count} selected` : undefined
    }
  }
}

export function MasterListPage({ choir = 'aws' }: { choir?: Choir }) {
  // The page is reused for both choirs; every read below is scoped, and the
  // forms stamp the same choir on anything added from here.
  // PNK sings in one voice — everyone is a Soprano 2 — so it hides the voice
  // filters, the voice column and the form's voice picker, and hides the
  // membership filter too (its list is one membership pool).
  const isPnk = choir === 'pnk'
  // One chip row drives the phone filter dialogs, so PNK simply drops the Voice
  // chip rather than opening a dialog with nothing in it.
  const mobileFilterSections: MobileFilterSection[] = isPnk
    ? MOBILE_FILTER_SECTIONS.filter((section) => section !== 'voices')
    : MOBILE_FILTER_SECTIONS
  const allMembers = useMemberStore((s) => s.members)
  const allTrainees = useMemberStore((s) => s.trainees)
  const members = useMemo(() => membersOf(allMembers, choir), [allMembers, choir])
  const trainees = useMemo(
    () => traineesOf(allTrainees, choir),
    [allTrainees, choir],
  )
  const lastUpdatedAt = useMemberStore((s) => s.lastUpdatedAt)
  const removeMember = useMemberStore((s) => s.removeMember)
  const voices = useSettingsStore((s) => s.voices)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const dutyRoles = useSettingsStore((s) => s.dutyRoles)
  const localeName = useSettingsStore((s) => s.localeName)
  const setLocaleName = useSettingsStore((s) => s.setLocaleName)
  const navigate = useNavStore((s) => s.navigate)
  const setMobileDrawerOpen = useSidebarStore((s) => s.setMobileDrawerOpen)
  const isMobile = useIsMobile()
  const { can } = usePermissions()
  const canAddMembers = can('add-members')
  const canEditMembers = can('edit-members')
  // A member who transfers out (admin-only) is never deleted from the archive;
  // the lifecycle form records the date, reason, and notes as history events.
  const canManageHistory = can('manage-membership-history')
  const canDeleteMembers = can('delete-members')
  const canExportDocuments = can('export-documents')
  const choirLabel = CHOIR_LABELS[choir]
  const documentName = `${choirLabel} Master List`
  const updatedAt = new Date(lastUpdatedAt)
  const lastUpdatedLabel = `${formatPHTDateTime(updatedAt, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} · ${formatPHTDateTime(updatedAt, {
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
  // Each choir section pages independently, mirroring the desktop table, so the
  // phone keeps a page number per section rather than one for the whole list.
  const [mobilePages, setMobilePages] = useState<Record<string, number>>({})
  const [collapsedMobile, setCollapsedMobile] = useState<Record<string, boolean>>(
    {},
  )

  const [formOpen, setFormOpen] = useState(false)
  const [pdfSetupOpen, setPdfSetupOpen] = useState(false)
  const [wordSetupOpen, setWordSetupOpen] = useState(false)
  const [attendanceSetupOpen, setAttendanceSetupOpen] = useState(false)
  const { exportPreview, requestExport } = useExportPreview()
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [actionTarget, setActionTarget] = useState<Member | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    member: Member
    kind: LifecycleFormKind
  } | null>(null)
  // null closes the sheet; otherwise it names the one filter being edited.
  const [filterSheetSection, setFilterSheetSection] =
    useState<MobileFilterSection | null>(null)

  // References are built from this choir's persisted roster so M-001 codes
  // never shift for the remaining members when someone is transferred out. The
  // two choirs are separate lists, so each one numbers from M-001.
  const references = useMemo(() => buildMemberReferences(members), [members])
  // A formal transfer moves the member off the Master List entirely — they
  // live on the Members History page from then on — so every list-scoped read
  // (counts, filters, table, exports) works from this narrowed roster.
  const directoryMembers = useMemo(
    () => members.filter(belongsInMasterList),
    [members],
  )
  const stats = useMemo(
    () => computeDirectoryStats(directoryMembers, trainees, voices, dutyRoles),
    [directoryMembers, trainees, voices, dutyRoles],
  )

  const filteredMembers = useMemo(
    () =>
      filterMembers(
        directoryMembers,
        filters,
        voices,
        dutyRoles,
        references,
        effectiveSort,
      ),
    [directoryMembers, filters, voices, dutyRoles, references, effectiveSort],
  )

  // Match count for the filter sheet's Apply button, evaluated against the
  // in-progress edits rather than the filters that are already applied.
  const previewCount = (candidate: MemberDirectoryFilters) =>
    filterMembers(
      directoryMembers,
      candidate,
      voices,
      dutyRoles,
      references,
      effectiveSort,
    ).length

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
  // The phone mirrors the desktop's two choir sections, each paged on its own.
  // `paginate` clamps, so a stale page left over from a wider filter set cannot
  // blank a section.
  const mobileSections = useMemo(() => {
    const { women, men } = groupMembersByGender(filteredMembers)
    return [
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
    ]
      .filter((section) => section.members.length > 0)
      .map((section) => ({
        ...section,
        page: paginate(section.members, mobilePages[section.key] ?? 1, pageSize),
      }))
  }, [filteredMembers, mobilePages, pageSize])
  const anyMobilePaged = mobileSections.some(
    (section) => section.page.pageCount > 1,
  )
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
      navigate(CHOIR_PAGES.trainees[choir])
      return
    }
    setFilters(
      action === 'all'
        ? EMPTY_DIRECTORY_FILTERS
        : { ...EMPTY_DIRECTORY_FILTERS, status: action },
    )
    setMobilePages({})
  }

  const openAddDialog = () => {
    setEditingMember(null)
    setFormOpen(true)
  }

  const openEditDialog = (member: Member) => {
    setEditingMember(member)
    setFormOpen(true)
  }

  const handleExport = (format: 'csv' | 'excel') => {
    if (filteredCount === 0) {
      toast.error('No members to export.')
      return
    }
    const fileName = exportFileName(
      masterListExportDocumentName(filters.gender, choir),
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
      choir,
    )
    try {
      if (format === 'csv') {
        exportCSVRows(rows, fileName)
      } else {
        await exportMasterListExcel(rows, fileName)
      }
      toast.success(
        `Exported the ${documentName} as ${format.toUpperCase()}.`,
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
    setLocaleName(name)
    const fileName = exportFileName(documentName, 'pdf')
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
        choir,
      )
      toast.success(`${documentName} exported as PDF.`)
    } catch (error) {
      console.error(error)
      toast.error(`Could not export the ${documentName} PDF.`)
    }
  }

  const handleWordExport = async (
    name: string,
    paperSize: MasterListPaperSize,
  ) => {
    setWordSetupOpen(false)
    setLocaleName(name)
    const fileName = exportFileName(documentName, 'docx')
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
        choir,
      )
      toast.success(`${documentName} exported as Word.`)
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? `Word export failed: ${error.message}`
          : `Could not export the ${documentName} Word document.`,
      )
    }
  }

  const handleAttendanceGenerate = (
    options: Pick<
      MasterListAttendanceOptions,
      | 'dates'
      | 'title'
      | 'groupByVoice'
      | 'selectedVoiceIds'
      | 'includeNagsasanayMen'
      | 'includeNagsasanayWomen'
      | 'lastNameFirst'
      | 'paperSize'
      | 'orientation'
      | 'pangulongName'
    >,
    format: MasterListAttendanceExportFormat,
  ) => {
    const extension = format === 'pdf' ? 'pdf' : 'docx'
    const fileName = exportFileName(options.title, extension)
    requestExport({
      filename: fileName,
      confirmLabel: `Export ${format === 'pdf' ? 'PDF' : 'Word'}`,
      onConfirm: () => {
        void (async () => {
          try {
            const exportOptions: MasterListAttendanceOptions = {
              ...options,
              members: directoryMembers,
              trainees,
              voices,
              filename: fileName,
              choir,
            }
            if (format === 'pdf') {
              await exportMasterListAttendancePdf(exportOptions)
            } else {
              await exportMasterListAttendanceWord(exportOptions)
            }
            toast.success(
              `Attendance sheet exported as ${format === 'pdf' ? 'PDF' : 'Word'}.`,
            )
          } catch (error) {
            console.error(error)
            toast.error(
              error instanceof Error
                ? `Attendance sheet ${format === 'pdf' ? 'PDF' : 'Word'} export failed: ${error.message}`
                : `Could not export the attendance sheet as ${format === 'pdf' ? 'PDF' : 'Word'}.`,
            )
          }
        })()
      },
    })
  }

  const directoryProps = {
    members: filteredMembers,
    voices,
    references,
    sort,
    dutyRoles,
    // PNK is a single-voice choir, so its table drops the voice column.
    showVoice: !isPnk,
    onEdit: openEditDialog,
    onTransfer: (member: Member) =>
      setLifecycleTarget({ member, kind: 'transfer' }),
    onDelete: setDeleteTarget,
    canEdit: canEditMembers,
    canTransfer: canManageHistory,
    canDelete: canDeleteMembers,
    hasAnyMembers: directoryMembers.length > 0,
    onClearFilters: clearFilters,
  }

  return (
    <div className="flex flex-col gap-4">
      {exportPreview}
      <MobileDirectoryHeader
        title={documentName}
        description={`Updated ${lastUpdatedLabel}`}
        onOpenMenu={() => setMobileDrawerOpen(true)}
        actions={
          <>
            {canAddMembers && (
              <Button
                size="icon"
                aria-label="Add member"
                title="Add member"
                onClick={openAddDialog}
              >
                <Plus className="size-4" />
              </Button>
            )}
            {canExportDocuments && (
              <ExportMenu
                compact
                onCsv={() => handleExport('csv')}
                onExcel={() => handleExport('excel')}
                onWord={() => setWordSetupOpen(true)}
                onPdf={() => setPdfSetupOpen(true)}
                onAttendance={() => setAttendanceSetupOpen(true)}
              />
            )}
          </>
        }
      />

      <PageHeader
        eyebrow={choir === 'pnk' ? 'Pagsamba ng Kabataan' : 'Adult Worship Service'}
        title={documentName}
        description={`Updated ${lastUpdatedLabel}`}
        className="hidden md:flex"
        actions={
          <>
            {canAddMembers && (
              <Button onClick={openAddDialog}>
                <Plus className="size-4" />
                Add Member
              </Button>
            )}
            {canExportDocuments && (
              <ExportMenu
                onCsv={() => handleExport('csv')}
                onExcel={() => handleExport('excel')}
                onWord={() => setWordSetupOpen(true)}
                onPdf={() => setPdfSetupOpen(true)}
                onAttendance={() => setAttendanceSetupOpen(true)}
              />
            )}
          </>
        }
      />

      <StatCards stats={stats} selected={selectedStat} onSelect={selectStat} />

      {/* Search & filter toolbar. The direct filters live here (choir segment,
          voices, positions, sort); status is owned by the KPI strip above, so
          it is not repeated as a control. Sticky under the screen header so
          the filters stay with you while the list scrolls. */}
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

            {!isPnk && (
              <Select
                value={filters.voices[0] ?? ''}
                onValueChange={(v) =>
                  setFilter('voices', v === CLEAR_FILTER ? [] : [v])
                }
              >
                <SelectTrigger
                  aria-label="Filter by voice position"
                  className={cn(
                    'h-9 w-[11.5rem] bg-background text-[0.8125rem]',
                    filters.voices.length > 0 &&
                      'border-brand-teal/40 bg-brand-teal-soft text-brand-teal',
                  )}
                >
                  <Music2 className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Voice Positions" />
                </SelectTrigger>
                <SelectContent>
                  {voices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      {voice.name}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem
                    value={CLEAR_FILTER}
                    disabled={filters.voices.length === 0}
                  >
                    Clear
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            <Select
              value={filters.positions[0] ?? ''}
              onValueChange={(v) =>
                setFilter('positions', v === CLEAR_FILTER ? [] : [v])
              }
            >
              <SelectTrigger
                aria-label="Filter by choir position"
                className={cn(
                  'h-9 w-[11.5rem] bg-background text-[0.8125rem]',
                  filters.positions.length > 0 &&
                    'border-brand-teal/40 bg-brand-teal-soft text-brand-teal',
                )}
              >
                <ShieldCheck className="size-4 text-muted-foreground" />
                <SelectValue placeholder="Choir Positions" />
              </SelectTrigger>
              <SelectContent>
                {dutyRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem
                  value={CLEAR_FILTER}
                  disabled={filters.positions.length === 0}
                >
                  Clear
                </SelectItem>
              </SelectContent>
            </Select>

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
              size="icon-lg"
              aria-label="Reset filters"
              title="Reset filters"
              disabled={!filtersActive}
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
        </div>

        {/* Mobile filter chips: one focused bottom sheet each, so the toolbar
            never needs a permanently visible column of controls. The chips
            share the row equally; Clear only ever takes its own edge. */}
        <div className="flex items-center gap-2 md:hidden">
          <div
            className={cn(
              'grid flex-1 gap-2',
              mobileFilterSections.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {mobileFilterSections.map((section) => {
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

      </div>

      {/* Member directory */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
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

          {/* Sort sits with the heading on phones; desktop keeps it in the
              toolbar above. */}
          <div className="shrink-0 md:hidden">
            <Select
              value={effectiveSort}
              onValueChange={(v) => {
                setSort(v as MemberSort)
                if (filters.quick === 'recent') setFilter('quick', 'all')
              }}
            >
              <SelectTrigger
                aria-label="Sort members"
                className="h-9 w-[9.5rem] bg-background text-[0.8125rem]"
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
        </div>

        <div className="flex flex-col">
          {/* Mobile card list, grouped into the same two choir sections as the
              desktop table. */}
          <div className="md:hidden">
            {filteredMembers.length === 0 ? (
              <MemberDirectoryEmptyState
                hasAnyMembers={totalCount > 0}
                onClearFilters={clearFilters}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {anyMobilePaged ? (
                  <div className="flex items-center justify-end">
                    <PageSizeControl
                      value={pageSize}
                      onChange={(size) => {
                        // A new page size invalidates every section's cursor;
                        // start each one over at the top.
                        setMobilePages({})
                        setPageSize(size)
                      }}
                    />
                  </div>
                ) : null}

                {mobileSections.map((section) => (
                  <MobileChoirSection
                    key={section.key}
                    title={section.title}
                    icon={section.icon}
                    iconClass={section.iconClass}
                    page={section.page}
                    collapsed={collapsedMobile[section.key] ?? false}
                    onToggle={() =>
                      setCollapsedMobile((current) => ({
                        ...current,
                        [section.key]: !current[section.key],
                      }))
                    }
                    voices={voiceMap}
                    dutyRoles={dutyRoles}
                    references={references}
                    sort={sort}
                    showVoice={!isPnk}
                    hasActions={
                      canEditMembers ||
                      canManageHistory ||
                      canDeleteMembers
                    }
                    onOpenMenu={setActionTarget}
                    onPageChange={(page) =>
                      setMobilePages((current) => ({
                        ...current,
                        [section.key]: page,
                      }))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hidden min-w-0 md:block">
            <MemberDirectoryTable
              {...directoryProps}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      </section>

      {/* Mobile filter dialog */}
      <MobileFilterDialog
        open={filterSheetSection !== null}
        section={filterSheetSection ?? mobileFilterSections[0]}
        onOpenChange={(open) => {
          if (!open) setFilterSheetSection(null)
        }}
        filters={filters}
        onApply={setFilters}
        voices={voices}
        dutyRoles={dutyRoles}
        stats={stats}
        sections={mobileFilterSections}
        previewCount={previewCount}
      />

      {/* Member actions, from a card tap or its kebab */}
      <MemberActionDialog
        member={actionTarget}
        reference={
          actionTarget ? references.get(actionTarget.id) : undefined
        }
        voices={voiceMap}
        dutyRoles={dutyRoles}
        sort={sort}
        onOpenChange={(open) => {
          if (!open) setActionTarget(null)
        }}
        onEdit={(member) => {
          setActionTarget(null)
          openEditDialog(member)
        }}
        onTransfer={(member) => {
          setActionTarget(null)
          setLifecycleTarget({ member, kind: 'transfer' })
        }}
        onDelete={(member) => {
          setActionTarget(null)
          setDeleteTarget(member)
        }}
        canEdit={canEditMembers}
        canTransfer={canManageHistory}
        canDelete={canDeleteMembers}
      />

      {isMobile ? (
        <MobileMemberFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          member={editingMember}
          reference={
            editingMember ? references.get(editingMember.id) : undefined
          }
          choir={choir}
        />
      ) : (
        <MemberFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          member={editingMember}
          choir={choir}
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
      {attendanceSetupOpen && (
        <MasterListAttendanceDialog
          open={attendanceSetupOpen}
          onOpenChange={setAttendanceSetupOpen}
          choir={choir}
          members={directoryMembers}
          trainees={trainees}
          voices={voices}
          dutyRoles={dutyRoles}
          onGenerate={handleAttendanceGenerate}
        />
      )}

      {lifecycleTarget && (
        <MemberLifecycleDialog
          open
          onOpenChange={(open: boolean) => {
            if (!open) setLifecycleTarget(null)
          }}
          member={lifecycleTarget.member}
          kind={lifecycleTarget.kind}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete member?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete {deleteTarget?.firstName}{' '}
              {deleteTarget?.lastName}? This removes them from the Master List
              and Members History and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                if (!deleteTarget) return
                removeMember(deleteTarget.id)
                toast.success(
                  `${deleteTarget.firstName} ${deleteTarget.lastName} deleted.`,
                )
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * One export menu for both headers: labelled on desktop, icon-only on phones.
 * Spreadsheet items export the current filtered view; Word and PDF always
 * export the full Master List, so the two groups stay visually separate.
 */
function ExportMenu({
  compact = false,
  onCsv,
  onExcel,
  onWord,
  onPdf,
  onAttendance,
}: {
  compact?: boolean
  onCsv: () => void
  onExcel: () => void
  onWord: () => void
  onPdf: () => void
  onAttendance: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant="outline"
            size="icon"
            aria-label="Export"
            title="Export"
          >
            <Download className="size-4" />
          </Button>
        ) : (
          <Button variant="outline">
            <Download className="size-4" />
            Export
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Current view</DropdownMenuLabel>
        <DropdownMenuItem onClick={onCsv}>CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onExcel}>Excel</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Full Master List</DropdownMenuLabel>
        <DropdownMenuItem onClick={onWord}>Word</DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf}>PDF</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onAttendance}>
          <FileDown className="size-4" />
          Attendance Sheet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
