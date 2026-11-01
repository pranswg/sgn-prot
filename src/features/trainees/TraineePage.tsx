import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  FileDown,
  GraduationCap,
  Mars,
  Plus,
  Search,
  SlidersHorizontal,
  Undo2,
  Venus,
  X,
} from 'lucide-react'
import { MobileDirectoryHeader } from '@/components/MobileDirectoryHeader'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMemberStore } from '@/store/memberStore'
import { useSidebarStore } from '@/store/sidebarStore'
import type { Choir, Trainee } from '@/core/types/member'
import { CHOIR_LABELS, membersOf, traineesOf } from '@/lib/choirs'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { TraineeFormDialog } from './TraineeFormDialog'
import { AttendanceSheetDialog } from './AttendanceSheetDialog'
import { TraineeTransferDialog } from './TraineeTransferForm'
import { TraineeSection } from './TraineeSection'

const TRAINEE_SECTIONS = [
  {
    key: 'women',
    title: "Women's Choir",
    icon: Venus,
    iconClass: 'text-pink-500',
    gender: 'female',
  },
  {
    key: 'men',
    title: "Men's Choir",
    icon: Mars,
    iconClass: 'text-sky-500',
    gender: 'male',
  },
] as const

export function TraineePage({ choir = 'aws' }: { choir?: Choir }) {
  const { can } = usePermissions()
  const setMobileDrawerOpen = useSidebarStore((s) => s.setMobileDrawerOpen)
  // Separate list, separate pool: everything below reads this choir only.
  const allTrainees = useMemberStore((s) => s.trainees)
  const allMembers = useMemberStore((s) => s.members)
  const trainees = useMemo(
    () => traineesOf(allTrainees, choir),
    [allTrainees, choir],
  )
  const masterListMembers = useMemo(
    () => membersOf(allMembers, choir),
    [allMembers, choir],
  )
  const promoteTrainee = useMemberStore((s) => s.promoteTrainee)
  const removeTrainee = useMemberStore((s) => s.removeTrainee)
  const restoreTrainee = useMemberStore((s) => s.restoreTrainee)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const localeName = useSettingsStore((s) => s.localeName)
  const dutyRoles = useSettingsStore((s) => s.allDutyRoles())
  const voices = allVoices()

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const [formOpen, setFormOpen] = useState(false)
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [editing, setEditing] = useState<Trainee | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<Trainee | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Trainee | null>(null)
  const [transferTarget, setTransferTarget] = useState<Trainee | null>(null)
  const [restoreTarget, setRestoreTarget] = useState<Trainee | null>(null)

  // Attendance excludes transferred-out trainees; the visible list keeps them
  // so a transfer can be undone from here.
  const activeTrainees = trainees.filter(
    (t) => t.status === 'active' || t.status === 'inactive',
  )
  const listedTrainees = trainees.filter(
    (t) =>
      t.status === 'active' ||
      t.status === 'inactive' ||
      t.status === 'transferred-out',
  )
  const promotedCount = trainees.filter((t) => t.status === 'promoted').length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return listedTrainees
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        if (q && !`${t.firstName} ${t.lastName}`.toLowerCase().includes(q))
          return false
        return true
      })
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      )
  }, [listedTrainees, query, statusFilter])

  const filtersActive = query.trim() !== '' || statusFilter !== 'all'

  const resetFilters = () => {
    setQuery('')
    setStatusFilter('all')
  }

  const openAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (trainee: Trainee) => {
    setEditing(trainee)
    setFormOpen(true)
  }

  const handlePromote = () => {
    if (!promoteTarget) return
    const member = promoteTrainee(promoteTarget.id)
    if (member) {
      toast.success(
        `${promoteTarget.firstName} ${promoteTarget.lastName} promoted to choir member.`,
      )
    }
    setPromoteTarget(null)
  }

  const countLine = [
    `${filtered.length}${filtersActive ? ` of ${listedTrainees.length}` : ''} ${
      filtered.length === 1 && !filtersActive ? 'trainee' : 'trainees'
    }`,
    promotedCount > 0 ? `${promotedCount} promoted` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const headerSubtitle = [
    `${listedTrainees.length} ${listedTrainees.length === 1 ? 'trainee' : 'trainees'}`,
    promotedCount > 0 ? `${promotedCount} promoted` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col gap-5">
      <MobileDirectoryHeader
        title={`${CHOIR_LABELS[choir]} Nagsasanay`}
        description={headerSubtitle}
        onOpenMenu={() => setMobileDrawerOpen(true)}
        actions={
          <>
            {can('export-documents') && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Generate attendance sheet"
                title="Generate attendance sheet"
                onClick={() => setAttendanceOpen(true)}
              >
                <FileDown className="size-4" />
              </Button>
            )}
            <Button size="icon" aria-label="Add trainee" onClick={openAdd}>
              <Plus className="size-4" />
            </Button>
          </>
        }
      />

      <PageHeader
        title={`${CHOIR_LABELS[choir]} Nagsasanay (Trainees)`}
        description="Prospective members preparing to join the choir."
        className="hidden md:flex"
        actions={
          <>
            {can('export-documents') && (
              <Button variant="outline" onClick={() => setAttendanceOpen(true)}>
                <FileDown className="size-4" />
                Attendance Sheet
              </Button>
            )}
            <Button onClick={openAdd}>
              <Plus className="size-4" />
              Add Trainee
            </Button>
          </>
        }
      />

      {/* Search & filter toolbar, sticky under the screen header. `top-14`
          matches both the mobile header and the desktop app bar. */}
      <div
        className={cn(
          'sticky top-14 z-20 -mx-4 flex flex-col gap-2.5 border-b border-border/70 bg-background px-4 py-2.5',
          'md:mx-0 md:gap-3 md:rounded-xl md:border md:bg-card md:px-3 md:py-3',
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search trainee name..."
              aria-label="Search trainees"
              className="h-12 rounded-lg bg-background pl-9 pr-9 md:h-10"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              aria-label="Filter by status"
              className="h-10 w-full bg-background text-[0.8125rem] md:h-9 md:w-[9.5rem]"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="transferred-out">Transferred Out</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset filters"
            title="Reset filters"
            disabled={!filtersActive}
            onClick={resetFilters}
            className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
          >
            <SlidersHorizontal className="size-4" />
          </Button>

          <p className="hidden shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground md:block">
            {countLine}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No trainees to display.
          </div>
        ) : (
          TRAINEE_SECTIONS.map((section) => {
            const members = filtered.filter((t) => t.gender === section.gender)
            if (members.length === 0) return null
            return (
              <TraineeSection
                key={section.key}
                title={section.title}
                icon={section.icon}
                iconClass={section.iconClass}
                trainees={members}
                voices={voices}
                collapsed={Boolean(collapsed[section.key])}
                onToggle={() =>
                  setCollapsed((current) => ({
                    ...current,
                    [section.key]: !current[section.key],
                  }))
                }
                onPromote={setPromoteTarget}
                onRestore={setRestoreTarget}
                onEdit={openEdit}
                onTransfer={setTransferTarget}
                onRemove={setRemoveTarget}
              />
            )
          })
        )}
      </section>

      <TraineeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trainee={editing}
        choir={choir}
      />

      <AttendanceSheetDialog
        open={attendanceOpen}
        onOpenChange={setAttendanceOpen}
        trainees={activeTrainees}
        members={masterListMembers}
        dutyRoles={dutyRoles}
        localeName={localeName}
      />

      <TraineeTransferDialog
        open={!!transferTarget}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(null)
        }}
        trainee={transferTarget}
      />

      <AlertDialog open={!!promoteTarget} onOpenChange={(o) => !o && setPromoteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote trainee?</AlertDialogTitle>
            <AlertDialogDescription>
              Promote {promoteTarget?.firstName} {promoteTarget?.lastName} to a
              regular choir member? The trainee record will be preserved and the
              person's history will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromote}>
              <GraduationCap className="mr-1 size-4" />
              Promote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove trainee?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.firstName} {removeTarget?.lastName}? This
              cannot be undone. Consider deactivating instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                if (removeTarget) {
                  removeTrainee(removeTarget.id)
                  toast.success('Trainee removed.')
                  setRemoveTarget(null)
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore trainee?</AlertDialogTitle>
            <AlertDialogDescription>
              Restore {restoreTarget?.firstName} {restoreTarget?.lastName} to
              the trainee list? They will return as{' '}
              {restoreTarget?.transferredWhenInactive ? 'inactive' : 'active'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (restoreTarget) {
                  restoreTrainee(restoreTarget.id)
                  toast.success('Trainee restored.')
                  setRestoreTarget(null)
                }
              }}
            >
              <Undo2 className="mr-1 size-4" />
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
