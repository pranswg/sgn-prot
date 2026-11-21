import { useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileDown,
  FileText,
  MoreHorizontal,
  Music2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAttendanceStore, type AttendanceSheet } from '@/store/attendanceStore'
import { useSettingsStore, type StoredVoice } from '@/store/settingsStore'
import {
  dayOfMonthKey,
  daysBetween,
  formatDateKey,
  formatPHTDateTime,
  formatWeekday,
  monthShortKey,
  toDateKeyFromInstant,
  todayPHT,
} from '@/lib/phDate'
import type { Choir, Member, Trainee } from '@/core/types/member'
import { CHOIR_LABELS, membersOf, traineesOf } from '@/lib/choirs'
import { useExportPreview } from '@/hooks/useExportPreview'
import { exportMasterListAttendancePdf } from './masterListAttendancePdf'
import { exportMasterListAttendanceWord } from './masterListAttendanceWord'
import type { MasterListAttendanceOptions } from './masterListAttendancePdf'
import { exportFileName } from '@/lib/exportNaming'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  attendancePersonKey,
  computeSheetProgress,
  percentOf,
  sheetRoster,
  type SheetProgress,
  type SheetState,
} from './attendanceProgress'

interface AttendanceHistoryProps {
  choir: Choir
  members: Member[]
  trainees: Trainee[]
  canEditMembers: boolean
  onOpen: (id: string) => void
  onCreate?: () => void
}

type LibraryFilter = 'all' | 'needs-marking' | 'exported'

interface LibraryRow {
  sheet: AttendanceSheet
  progress: SheetProgress
  rosterSize: number
}

const STATUS_META: Record<
  SheetState,
  { label: string; className: string; dotClassName: string }
> = {
  'not-started': {
    label: 'Not marked',
    className: 'bg-muted text-muted-foreground',
    dotClassName: 'bg-muted-foreground/50',
  },
  'in-progress': {
    label: 'Needs marking',
    className: 'bg-amber-100 text-amber-700',
    dotClassName: 'bg-amber-500',
  },
  complete: {
    label: 'Complete',
    className: 'bg-emerald-100 text-emerald-700',
    dotClassName: 'bg-emerald-500',
  },
}

/** `Nov 9`, the compact label used in headers and chips. */
function dayLabel(date: string): string {
  return `${monthShortKey(date)} ${dayOfMonthKey(date)}`
}

/** `Sun, Nov 9`, matching the library's date column. */
function shortDate(date: string): string {
  return `${formatWeekday(date).slice(0, 3)}, ${dayLabel(date)}`
}

function Dot() {
  return <span className="size-[3px] rounded-full bg-muted-foreground/50" />
}

function ProgressBar({ percent, state }: { percent: number; state: SheetState }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          state === 'complete' && 'bg-emerald-500',
          state === 'in-progress' && 'bg-amber-500',
          state === 'not-started' && 'bg-slate-300',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

function KpiCard({
  label,
  value,
  detail,
  icon,
  accent = false,
}: {
  label: string
  value: string
  detail: string
  icon: ReactNode
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/70 bg-card p-3.5',
        accent &&
          'border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card',
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 truncate text-2xl font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

export function AttendanceHistory({
  choir,
  members,
  trainees,
  canEditMembers,
  onOpen,
  onCreate,
}: AttendanceHistoryProps) {
  const sheets = useAttendanceStore((s) => s.sheets)
  const voices = useSettingsStore((s) => s.voices)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const { exportPreview, requestExport } = useExportPreview()

  const choirSheets = useMemo(
    () =>
      sheets
        .filter((sheet) => sheet.choir === choir)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sheets, choir],
  )

  const roster = useMemo(
    () => membersOf(members, choir).filter((member) => member.isActive),
    [members, choir],
  )
  const activeTrainees = traineesOf(trainees, choir).filter(
    (trainee) => trainee.status === 'active',
  )

  const rows = useMemo<LibraryRow[]>(
    () =>
      choirSheets.map((sheet) => ({
        sheet,
        progress: computeSheetProgress(sheet, roster),
        rosterSize: sheetRoster(sheet, roster).length,
      })),
    [choirSheets, roster],
  )

  const needsMarking = rows.filter((row) => row.progress.state !== 'complete')
  const exportedCount = rows.filter((row) => row.sheet.lastExportedAt).length

  const totals = rows.reduce(
    (acc, row) => ({
      marked: acc.marked + row.progress.marked,
      total: acc.total + row.progress.total,
    }),
    { marked: 0, total: 0 },
  )
  const overallPercent = percentOf(totals.marked, totals.total)

  const recentSessions = choirSheets.filter((sheet) => {
    const age = daysBetween(toDateKeyFromInstant(new Date(sheet.createdAt)), todayPHT())
    return age >= 0 && age <= 30
  }).length

  const nextNeedsMarking = needsMarking[0]
  const nextNeedsMarkingDetail = nextNeedsMarking
    ? `${dayLabel(nextNeedsMarking.sheet.dates[0] ?? '')} · ${nextNeedsMarking.progress.marked} of ${nextNeedsMarking.progress.total} marks`
    : 'Everything on record is fully marked'

  const voiceStats = useMemo(() => {
    const stats = new Map<string, { name: string; marked: number; total: number }>()
    for (const { sheet } of rows) {
      if (!sheet.groupByVoice) continue
      for (const voiceId of sheet.voiceIds) {
        const sectionMembers = roster.filter(
          (member) => member.voicePosition === voiceId,
        )
        if (sectionMembers.length === 0) continue
        const entry = stats.get(voiceId) ?? {
          name: voices.find((voice) => voice.id === voiceId)?.name ?? voiceId,
          marked: 0,
          total: 0,
        }
        entry.total += sectionMembers.length * sheet.dates.length
        entry.marked += sectionMembers.reduce(
          (sum, member) =>
            sum +
            (sheet.present[attendancePersonKey(member.id)] ?? []).filter((date) =>
              sheet.dates.includes(date),
            ).length,
          0,
        )
        stats.set(voiceId, entry)
      }
    }
    let best: { name: string; percent: number } | null = null
    for (const entry of stats.values()) {
      if (entry.total === 0) continue
      const percent = percentOf(entry.marked, entry.total)
      if (!best || percent > best.percent) best = { name: entry.name, percent }
    }
    return best
  }, [rows, roster, voices])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter === 'needs-marking' && row.progress.state === 'complete') {
        return false
      }
      if (filter === 'exported' && !row.sheet.lastExportedAt) return false
      if (!needle) return true
      const haystack = [
        row.sheet.title,
        CHOIR_LABELS[row.sheet.choir],
        ...row.sheet.dates.map((date) => `${formatDateKey(date)} ${shortDate(date)}`),
        ...row.sheet.voiceIds.map(
          (id) => voices.find((voice) => voice.id === id)?.name ?? id,
        ),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(needle)
    })
  }, [rows, query, filter, voices])

  const handleExportFromHistory = (
    sheet: AttendanceSheet,
    format: 'pdf' | 'word',
  ) => {
    const extension = format === 'pdf' ? 'pdf' : 'docx'
    const fileName = exportFileName(sheet.title, extension)
    requestExport({
      filename: fileName,
      confirmLabel: `Export ${format === 'pdf' ? 'PDF' : 'Word'}`,
      onConfirm: () => {
        void (async () => {
          try {
            const options: MasterListAttendanceOptions = {
              ...sheet,
              members: roster,
              trainees: activeTrainees,
              voices,
              selectedVoiceIds: sheet.voiceIds,
              filename: fileName,
              choir,
            }
            if (format === 'pdf') {
              await exportMasterListAttendancePdf(options)
            } else {
              await exportMasterListAttendanceWord(options)
            }
            useAttendanceStore.getState().markExported(sheet.id)
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

  const handleDelete = () => {
    if (!deleteTarget) return
    useAttendanceStore.getState().deleteSheet(deleteTarget)
    setDeleteTarget(null)
    toast.success('Attendance sheet deleted.')
  }

  const deleteTitle =
    choirSheets.find((sheet) => sheet.id === deleteTarget)?.title ?? 'this sheet'

  if (choirSheets.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <CalendarDays className="size-6" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              No attendance sessions yet
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create a session for the dates you meet, then mark the roster. Every
              session keeps its own progress, so you can see which one still needs
              you.
            </p>
          </div>
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="size-4" /> New session
            </Button>
          )}
        </div>
      </section>
    )
  }

  const filters: { key: LibraryFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'needs-marking', label: 'Needs marking', count: needsMarking.length },
    { key: 'exported', label: 'Exported', count: exportedCount },
  ]

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Attendance library
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} session{rows.length === 1 ? '' : 's'} for{' '}
            {CHOIR_LABELS[choir]} · newest first
          </p>
        </div>
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus className="size-4" /> New session
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiCard
          accent
          label="Overall attendance"
          value={`${overallPercent}%`}
          detail={`${totals.marked} of ${totals.total} marks recorded`}
          icon={<CheckCircle2 className="size-3.5" />}
        />
        <KpiCard
          label="Sessions on record"
          value={String(rows.length)}
          detail={`${recentSessions} in the last 30 days`}
          icon={<CalendarDays className="size-3.5" />}
        />
        <KpiCard
          label="Needs marking"
          value={String(needsMarking.length)}
          detail={nextNeedsMarkingDetail}
          icon={<Clock3 className="size-3.5" />}
        />
        <KpiCard
          label="Most consistent voice"
          value={voiceStats?.name ?? '—'}
          detail={
            voiceStats
              ? `${voiceStats.percent}% average across sessions`
              : 'No voice-split sessions yet'
          }
          icon={<Music2 className="size-3.5" />}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-2 border-b border-border/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sessions, dates, voices…"
              aria-label="Search attendance sessions"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex w-fit rounded-lg bg-muted p-0.5">
            {filters.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={filter === entry.key}
                onClick={() => setFilter(entry.key)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  filter === entry.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {entry.label}
                <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
                  {entry.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            No sessions match this search.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {filteredRows.map((row) => (
              <SheetRow
                key={row.sheet.id}
                row={row}
                voices={voices}
                canEditMembers={canEditMembers}
                onOpen={onOpen}
                onExport={handleExportFromHistory}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
          Showing {filteredRows.length} of {rows.length} sessions
          <span className="ml-auto">Rows open the marking workspace</span>
        </div>
      </div>

      {deleteTarget && (
        <AlertDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete attendance sheet?</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete “{deleteTitle}”? Its attendance marks are
                removed and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {exportPreview}
    </section>
  )
}

function SheetRow({
  row,
  voices,
  canEditMembers,
  onOpen,
  onExport,
  onDelete,
}: {
  row: LibraryRow
  voices: StoredVoice[]
  canEditMembers: boolean
  onOpen: (id: string) => void
  onExport: (sheet: AttendanceSheet, format: 'pdf' | 'word') => void
  onDelete: (id: string) => void
}) {
  const { sheet, progress, rosterSize } = row
  const status = STATUS_META[progress.state]
  const shownDates = sheet.dates.slice(0, 2)
  const extraDates = sheet.dates.length - shownDates.length
  const voiceNames = sheet.voiceIds.map(
    (id) => voices.find((voice) => voice.id === id)?.name ?? id,
  )

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/30 md:grid-cols-[auto_minmax(0,1fr)_11rem_10rem_auto] md:items-center md:gap-4">
      <span
        className={cn(
          'grid size-9 place-items-center rounded-lg',
          progress.state === 'complete'
            ? 'bg-primary/10 text-primary'
            : 'bg-amber-50 text-amber-600',
        )}
      >
        <CalendarDays className="size-4" />
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(sheet.id)}
            className="truncate text-left text-sm font-semibold tracking-tight underline-offset-4 hover:text-primary hover:underline"
          >
            {sheet.title}
          </button>
          <span
            className={cn(
              'rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
              sheet.choir === 'aws'
                ? 'bg-primary/10 text-primary'
                : 'bg-rose-100 text-rose-700',
            )}
          >
            {sheet.choir === 'aws' ? 'AWS' : 'PNK'}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            {sheet.dates.length} {sheet.dates.length === 1 ? 'date' : 'dates'}
          </span>
          <Dot />
          <span>{rosterSize} members</span>
          <Dot />
          <span>
            {sheet.groupByVoice
              ? `${voiceNames.length} voice${voiceNames.length === 1 ? '' : 's'}`
              : 'All members'}
          </span>
          <Dot />
          <span>
            created{' '}
            {formatPHTDateTime(new Date(sheet.createdAt), {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          {sheet.lastExportedAt && (
            <>
              <Dot />
              <span className="text-emerald-700">
                exported{' '}
                {formatPHTDateTime(new Date(sheet.lastExportedAt), {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="col-span-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground md:col-span-1 md:flex-col md:gap-1">
        {shownDates.map((date) => (
          <span key={date} className="flex items-center gap-1.5">
            <Clock3 className="size-3 shrink-0" />
            <span className="truncate">{shortDate(date)}</span>
            <span className="tabular-nums text-[11px] text-muted-foreground/80">
              {progress.dateCounts[date] ?? 0}/{rosterSize}
            </span>
          </span>
        ))}
        {extraDates > 0 && (
          <span className="text-[11px] text-muted-foreground/80">
            +{extraDates} more date{extraDates === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="col-span-2 md:col-span-1">
        <ProgressBar percent={progress.percent} state={progress.state} />
        <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold tabular-nums text-foreground">
            {rosterSize === 0 ? 'No active members' : `${progress.percent}% present`}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {progress.marked} / {progress.total} marks
          </span>
        </div>
      </div>

      <div className="col-span-2 flex items-center gap-2 md:col-span-1 md:justify-end">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            status.className,
          )}
        >
          <span className={cn('size-1.5 rounded-full', status.dotClassName)} />
          {status.label}
        </span>
        <Button size="sm" variant="outline" onClick={() => onOpen(sheet.id)}>
          Open
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onExport(sheet, 'pdf')}>
              <FileDown className="mr-2 size-4" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport(sheet, 'word')}>
              <FileText className="mr-2 size-4" />
              Export Word
            </DropdownMenuItem>
            {canEditMembers && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(sheet.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}
