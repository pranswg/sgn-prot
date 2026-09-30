import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  FileUp,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowDownAZ,
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
import type { ChoirPosition, Member } from '@/core/types/member'
import { POSITION_LABELS } from '@/core/constants/choirPositions'
import { exportCSV, exportExcel, membersToRows } from '@/lib/export'
import {
  EMPTY_DIRECTORY_FILTERS,
  MEMBER_SORT_LABEL,
  buildMemberReferences,
  computeDirectoryStats,
  countActiveDirectoryFilters,
  countMembersByPosition,
  filterMembers,
  formatMemberName,
  hasActiveDirectoryFilters,
  toggleInList,
  type MemberDirectoryFilters,
  type MemberSort,
} from '@/lib/memberDirectory'
import { cn } from '@/lib/utils'
import { todayPHT } from '@/lib/phDate'
import { MemberFormDialog } from './MemberFormDialog'
import { MemberDetailDialog } from './MemberDetailDialog'
import { ImportRosterDialog } from './ImportRosterDialog'
import { DirectorySummaryCards } from './DirectorySummaryCards'
import { DirectoryFilterPanel } from './DirectoryFilterPanel'
import {
  MemberDirectoryTable,
  MemberDirectoryEmptyState,
} from './MemberDirectoryTable'
import { MemberDirectoryGrid } from './MemberDirectoryGrid'
import { MobileStatCards } from './MobileStatCards'
import { MobileMemberCard } from './MobileMemberCard'
import { MemberActionSheet } from './MemberActionSheet'
import { MobileFilterSheet } from './MobileFilterSheet'
import { MemberProfileSheet } from './MemberProfileSheet'
import { MobileMemberFormSheet } from './MobileMemberFormSheet'

type ViewMode = 'list' | 'grid'

const GENDER_LABEL: Record<string, string> = {
  female: "Women's Choir",
  male: "Men's Choir",
}

export function MasterListPage() {
  const members = useMemberStore((s) => s.members)
  const trainees = useMemberStore((s) => s.trainees)
  const removeMember = useMemberStore((s) => s.removeMember)
  const voices = useSettingsStore((s) => s.voices)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const isMobile = useIsMobile()

  const voiceMap = useMemo(() => allVoices(), [allVoices])

  const [filters, setFilters] = useState<MemberDirectoryFilters>(
    EMPTY_DIRECTORY_FILTERS,
  )
  const [view, setView] = useState<ViewMode>('list')
  const [sort, setSort] = useState<MemberSort>('last-name')

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [profileTarget, setProfileTarget] = useState<Member | null>(null)
  const [desktopDetailTarget, setDesktopDetailTarget] = useState<Member | null>(
    null,
  )
  const [actionTarget, setActionTarget] = useState<Member | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const references = useMemo(() => buildMemberReferences(members), [members])
  const stats = useMemo(
    () => computeDirectoryStats(members, trainees, voices),
    [members, trainees, voices],
  )
  const positionCounts = useMemo(
    () => countMembersByPosition(members),
    [members],
  )

  const filteredMembers = useMemo(
    () => filterMembers(members, filters, voices, references, sort),
    [members, filters, voices, references, sort],
  )

  const filtersActive = hasActiveDirectoryFilters(filters)
  const activeFilterCount = countActiveDirectoryFilters(filters)
  const filteredCount = filteredMembers.length
  const totalCount = members.length

  const setFilter = <K extends keyof MemberDirectoryFilters>(
    key: K,
    value: MemberDirectoryFilters[K],
  ) => setFilters((f) => ({ ...f, [key]: value }))

  const clearFilters = () => setFilters(EMPTY_DIRECTORY_FILTERS)

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
      `Suguan Builder ready — assign ${formatMemberName(member, sort)} to a slot.`,
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
      {/* Mobile home header */}
      <div className="flex flex-col md:hidden">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-brand-teal">
          Choir Registry
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Master List
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your choir members, trainees, and choir positions.
        </p>
      </div>

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

      <MobileStatCards stats={stats} />
      <DirectorySummaryCards stats={stats} />

      {/* Mobile primary actions */}
      <div className="flex flex-col gap-2 md:hidden">
        <Button
          size="lg"
          className="h-12 w-full text-[0.9375rem]"
          onClick={openAddDialog}
        >
          <Plus className="size-5" />
          Add Member
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12"
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="size-4" />
            Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg" className="h-12 w-full">
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
        </div>
      </div>

      {/* Search & filter toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(e) => setFilter('query', e.target.value)}
              placeholder="Search by name, ID, or position"
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

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-12 flex-1 md:hidden"
              onClick={() => setFilterSheetOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
              Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
            </Button>

            {/* Mobile sort */}
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as MemberSort)}
            >
              <SelectTrigger
                aria-label="Sort members"
                className="h-12 flex-1 rounded-lg bg-background text-[0.8125rem] md:hidden"
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

            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <Select
                value={filters.gender}
                onValueChange={(v) =>
                  setFilter('gender', v as MemberDirectoryFilters['gender'])
                }
              >
                <SelectTrigger
                  aria-label="Filter by gender"
                  className="h-9 w-[10.5rem] bg-background text-[0.8125rem]"
                >
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="female">{GENDER_LABEL.female}</SelectItem>
                  <SelectItem value="male">{GENDER_LABEL.male}</SelectItem>
                </SelectContent>
              </Select>

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

              <Select
                value={sort}
                onValueChange={(v) => setSort(v as MemberSort)}
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
        </div>

        {filtersActive && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
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
                label={filters.quick}
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

          <div
            role="group"
            aria-label="Directory view"
            className="flex items-center gap-0.5 self-start rounded-lg border border-border bg-card p-0.5"
          >
            {(
              [
                { value: 'list' as const, label: 'List View', icon: List },
                {
                  value: 'grid' as const,
                  label: 'Grid View',
                  icon: LayoutGrid,
                },
              ] satisfies {
                value: ViewMode
                label: string
                icon: typeof List
              }[]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={view === option.value}
                aria-label={option.label}
                title={option.label}
                onClick={() => setView(option.value)}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                  view === option.value
                    ? 'bg-brand-navy-soft text-brand-navy'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <option.icon className="size-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[14.5rem_minmax(0,1fr)]">
          <DirectoryFilterPanel
            quick={filters.quick}
            onQuickChange={(value) => setFilter('quick', value)}
            voices={voices}
            selectedVoices={filters.voices}
            onVoiceToggle={(id) =>
              setFilter('voices', toggleInList(filters.voices, id))
            }
            selectedPositions={filters.positions}
            onPositionToggle={(id) =>
              setFilter('positions', toggleInList(filters.positions, id))
            }
            stats={stats}
            positionCounts={positionCounts}
            className="hidden lg:flex"
          />

          {/* Mobile card list / grid */}
          <div className="md:hidden">
            {filteredMembers.length === 0 ? (
              <MemberDirectoryEmptyState
                hasAnyMembers={totalCount > 0}
                onImport={() => setImportOpen(true)}
                onClearFilters={clearFilters}
              />
            ) : view === 'list' ? (
              <ul className="flex flex-col gap-2">
                {filteredMembers.map((member, index) => (
                  <MobileMemberCard
                    key={member.id}
                    member={member}
                    reference={references.get(member.id)}
                    number={index + 1}
                    voices={voiceMap}
                    sort={sort}
                    onOpenMenu={setActionTarget}
                  />
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {filteredMembers.map((member, index) => (
                  <MobileMemberCard
                    key={member.id}
                    member={member}
                    reference={references.get(member.id)}
                    number={index + 1}
                    voices={voiceMap}
                    sort={sort}
                    onOpenMenu={setActionTarget}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card md:block">
            {view === 'list' ? (
              <MemberDirectoryTable {...directoryProps} />
            ) : (
              <MemberDirectoryGrid {...directoryProps} />
            )}
          </div>
        </div>
      </section>

      {/* Mobile filter sheet */}
      <MobileFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onApply={setFilters}
        voices={voices}
        stats={stats}
        matchCount={filteredCount}
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
        member={isMobile ? profileTarget : null}
        reference={
          isMobile && profileTarget
            ? references.get(profileTarget.id)
            : undefined
        }
        sort={sort}
        onOpenChange={(open) => {
          if (!open) setProfileTarget(null)
        }}
        onEdit={(member) => {
          setProfileTarget(null)
          openEditDialog(member)
        }}
        onAssign={(member) => {
          setProfileTarget(null)
          handleAssign(member)
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
