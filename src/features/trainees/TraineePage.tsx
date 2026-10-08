import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowUpRight,
  GraduationCap,
  Mars,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  UserRoundX,
  Venus,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import type { Trainee } from '@/core/types/member'
import { getVoiceName } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'
import { formatAddedDate } from '@/lib/format'
import {
  GenderBadge,
  TraineeStatusBadge,
  VoiceBadge,
} from '@/components/StatusBadges'
import { cn } from '@/lib/utils'
import { TraineeFormDialog } from './TraineeFormDialog'

/** Matches the Master List table header styling. */
const headClass =
  'h-11 bg-background text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

/** Same choir segment the Master List uses, on both breakpoints. */
const CHOIR_SEGMENTS = [
  { value: 'all', label: 'All' },
  { value: 'female', label: 'Women' },
  { value: 'male', label: 'Men' },
] as const

export function TraineePage() {
  const trainees = useMemberStore((s) => s.trainees)
  const promoteTrainee = useMemberStore((s) => s.promoteTrainee)
  const removeTrainee = useMemberStore((s) => s.removeTrainee)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [choirFilter, setChoirFilter] = useState<'all' | 'female' | 'male'>(
    'all',
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Trainee | null>(null)
  const [promoteTarget, setPromoteTarget] = useState<Trainee | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Trainee | null>(null)

  const activeTrainees = trainees.filter(
    (t) => t.status === 'active' || t.status === 'inactive',
  )
  const promotedCount = trainees.filter((t) => t.status === 'promoted').length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activeTrainees
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        if (choirFilter !== 'all' && t.gender !== choirFilter) return false
        if (q && !`${t.firstName} ${t.lastName}`.toLowerCase().includes(q))
          return false
        return true
      })
      .sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      )
  }, [activeTrainees, query, statusFilter, choirFilter])

  const choirSections = [
    {
      key: 'women',
      title: "Women's Choir",
      members: filtered.filter((t) => t.gender === 'female'),
      icon: Venus,
      iconClass: 'text-pink-500',
    },
    {
      key: 'men',
      title: "Men's Choir",
      members: filtered.filter((t) => t.gender === 'male'),
      icon: Mars,
      iconClass: 'text-sky-500',
    },
  ].filter((section) => section.members.length > 0)

  const filtersActive =
    query.trim() !== '' || statusFilter !== 'all' || choirFilter !== 'all'

  const resetFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setChoirFilter('all')
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

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Nagsasanay / Trainees"
        description="Manage prospective choir members. Active trainees are not eligible for Suguan assignments."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Trainee List
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-medium tabular-nums text-foreground/80">
              {filtered.length}
            </span>{' '}
            of {activeTrainees.length} trainees
          </p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus className="size-4" />
          Add Trainee
        </Button>
      </div>

      {/* Search & filter toolbar, styled like the Master List toolbar and
          sticky under the screen header while the list scrolls. `top-14`
          matches the h-14 mobile bar Layout renders on this page. */}
      <div
        className={cn(
          'sticky top-14 z-20 -mx-4 flex flex-col gap-2.5 border-b border-border/70 bg-background px-4 py-2.5',
          'md:top-14 md:mx-0 md:gap-3 md:rounded-xl md:border md:px-3 md:py-3 md:bg-card',
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

          {/* Choir segment: promoted to the toolbar on desktop, exactly like
              the Master List. On mobile it sits under the list heading. */}
          <div
            role="group"
            aria-label="Filter by choir"
            className="hidden grid-cols-3 gap-0.5 rounded-lg border border-input bg-background p-0.5 md:grid"
          >
            {CHOIR_SEGMENTS.map((segment) => (
              <button
                key={segment.value}
                type="button"
                aria-pressed={choirFilter === segment.value}
                onClick={() => setChoirFilter(segment.value)}
                className={cn(
                  'h-8 rounded-md px-2.5 text-xs font-medium transition-colors',
                  choirFilter === segment.value
                    ? 'bg-brand-navy text-white'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {segment.label}
              </button>
            ))}
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
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            disabled={!filtersActive}
            onClick={resetFilters}
            className="hidden text-muted-foreground hover:text-foreground md:flex"
          >
            <SlidersHorizontal className="size-4" />
            Reset Filters
          </Button>
        </div>

        {/* Mobile choir segment, inside the search container under the
            search/status filters — scrolls with the toolbar like Master. */}
        <div
          role="group"
          aria-label="Filter by choir"
          className="grid grid-cols-3 gap-0.5 rounded-lg border border-border bg-card p-0.5 md:hidden"
        >
          {CHOIR_SEGMENTS.map((segment) => (
            <button
              key={segment.value}
              type="button"
              aria-pressed={choirFilter === segment.value}
              onClick={() => setChoirFilter(segment.value)}
              className={cn(
                'h-8 rounded-md text-xs font-medium transition-colors',
                choirFilter === segment.value
                  ? 'bg-brand-navy text-white'
                  : 'text-muted-foreground active:bg-muted',
              )}
            >
              {segment.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trainee table, matching the Master List layout. */}
      <section className="flex flex-col gap-3">
        {/* Mobile card list: name + Promote on top, gender | voice under it,
            then status with the edit/remove actions. */}
        <ul className="flex flex-col gap-2 md:hidden">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No trainees to display.
            </li>
          ) : (
            filtered.map((t, index) => (
              <li
                key={t.id}
                className="overflow-hidden rounded-xl border border-border/60 bg-card p-3.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                        {t.firstName} {t.lastName}
                      </span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <GenderBadge gender={t.gender} />
                      <span aria-hidden className="text-muted-foreground">
                        |
                      </span>
                      <VoiceBadge name={getVoiceName(t.voicePosition, voices)} />
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 text-xs"
                    onClick={() => setPromoteTarget(t)}
                    disabled={t.status !== 'active'}
                  >
                    <ArrowUpRight className="size-3.5" />
                    Promote
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <TraineeStatusBadge status={t.status} />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${t.firstName} ${t.lastName}`}
                      onClick={() => {
                        setEditing(t)
                        setFormOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${t.firstName} ${t.lastName}`}
                      className="text-red-600 hover:text-red-600"
                      onClick={() => setRemoveTarget(t)}
                    >
                      <UserRoundX className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={`${headClass} w-14 text-center`}>
                  #
                </TableHead>
                <TableHead className={headClass}>Name</TableHead>
                <TableHead className={headClass}>Gender</TableHead>
                <TableHead className={headClass}>Voice Position</TableHead>
                <TableHead className={headClass}>Status</TableHead>
                <TableHead className={`${headClass} hidden lg:table-cell`}>
                  Date Added
                </TableHead>
                <TableHead className={`${headClass} w-28 text-right`}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No trainees to display.
                  </TableCell>
                </TableRow>
              ) : (
                choirSections.map(({ key, title, members, icon: Icon, iconClass }) => (
                  <Fragment key={key}>
                    {/* Choir section divider, matching the Master List table. */}
                    <TableRow className="border-y border-border bg-background hover:bg-background">
                      <TableCell colSpan={7} className="px-4 py-2">
                        <div className="flex items-center gap-2.5">
                          <Icon className={cn('size-3.5', iconClass)} />
                          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-foreground/75">
                            {title}
                          </span>
                          <span className="rounded border border-border bg-background px-1.5 text-[0.625rem] font-semibold tabular-nums text-muted-foreground">
                            {members.length}
                          </span>
                          <span className="text-[0.625rem] tabular-nums text-muted-foreground/60">
                            #1-#{members.length}
                          </span>
                          <span aria-hidden className="h-px flex-1 bg-border/60" />
                        </div>
                      </TableCell>
                    </TableRow>

                    {members.map((t, index) => (
                      <TableRow
                        key={t.id}
                        className="h-14 border-b border-border transition-colors hover:bg-background"
                      >
                        <TableCell className="w-14 text-center align-middle">
                          <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {t.firstName} {t.lastName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <GenderBadge gender={t.gender} />
                        </TableCell>
                        <TableCell>
                          <VoiceBadge name={getVoiceName(t.voicePosition, voices)} />
                        </TableCell>
                        <TableCell>
                          <TraineeStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {formatAddedDate(t.dateAdded)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => setPromoteTarget(t)}
                              disabled={t.status !== 'active'}
                            >
                              <ArrowUpRight className="size-3.5" />
                              Promote
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setEditing(t)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-red-600 hover:text-red-600"
                              onClick={() => setRemoveTarget(t)}
                            >
                              <UserRoundX className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {promotedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {promotedCount} promoted to member{promotedCount === 1 ? '' : 's'}
        </p>
      )}

      <TraineeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        trainee={editing}
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
    </div>
  )
}