import { Fragment, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileDown,
  FileText,
  Search,
  UserMinus,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { MobileDirectoryHeader } from '@/components/MobileDirectoryHeader'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAttendanceStore } from '@/store/attendanceStore'
import {
  compareDateKeys,
  dayOfMonthKey,
  formatDateKey,
  formatPHTDateTime,
  formatWeekday,
  monthShortKey,
  todayPHT,
  type DateKey,
} from '@/lib/phDate'
import type { Choir, Member, Trainee } from '@/core/types/member'
import type { AttendanceSheet } from '@/store/attendanceStore'
import type { StoredVoice } from '@/store/settingsStore'
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
  countAttendanceChanges,
  defaultFocusDate,
  percentOf,
} from './attendanceProgress'

interface AttendanceRecordViewProps {
  sheet: AttendanceSheet
  choir: Choir
  members: Member[]
  trainees: Trainee[]
  voices: StoredVoice[]
  canEditMembers: boolean
  onClose: () => void
}

const AVATAR_TONES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
]

function dayLabel(date: DateKey): string {
  return `${monthShortKey(date)} ${dayOfMonthKey(date)}`
}

function shortDate(date: DateKey): string {
  return `${formatWeekday(date).slice(0, 3)}, ${dayLabel(date)}`
}

function initialsOf(member: Member): string {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()
}

function formatAttendanceName(member: Member, lastNameFirst: boolean): string {
  const given = [member.firstName, member.middleName].filter(Boolean).join(' ')
  const parts = lastNameFirst
    ? [member.lastName, given].filter(Boolean)
    : [given, member.lastName].filter(Boolean)
  return [...parts, member.suffix].filter(Boolean).join(' ')
}

function MarkButton({
  present,
  future,
  disabled,
  label,
  onToggle,
}: {
  present: boolean
  future: boolean
  disabled: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={present}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'mx-auto grid size-7 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        present && 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
        !present &&
          future &&
          'border-dashed border-border bg-muted/40 text-muted-foreground/60 hover:border-muted-foreground/40',
        !present &&
          !future &&
          'border-border bg-background text-transparent hover:border-muted-foreground/50 hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {present ? (
        <Check className="size-4" strokeWidth={3} />
      ) : future ? (
        <span className="h-0.5 w-2 rounded-full bg-current" />
      ) : null}
    </button>
  )
}

export function AttendanceRecordView({
  sheet,
  choir,
  members,
  trainees,
  voices,
  canEditMembers,
  onClose,
}: AttendanceRecordViewProps) {
  const attendanceStore = useAttendanceStore()
  const isMobile = useIsMobile()
  const { exportPreview, requestExport } = useExportPreview()

  const roster = useMemo(
    () =>
      membersOf(members, choir)
        .filter((member) => member.isActive)
        .sort(
          (a, b) =>
            a.lastName.localeCompare(b.lastName) ||
            a.firstName.localeCompare(b.firstName) ||
            a.id.localeCompare(b.id),
        ),
    [members, choir],
  )

  const [draft, setDraft] = useState<Record<string, string[]>>(
    () => ({ ...sheet.present }),
  )
  const [loadedSheetId, setLoadedSheetId] = useState(sheet.id)
  // A new sheet resets the draft; a save (or a rolled-back save) must not, or a
  // failed write would silently discard the marks the user just made.
  if (loadedSheetId !== sheet.id) {
    setLoadedSheetId(sheet.id)
    setDraft({ ...sheet.present })
  }

  const [focusDate, setFocusDate] = useState<DateKey>(() =>
    defaultFocusDate(sheet, roster),
  )
  const [onlyAbsent, setOnlyAbsent] = useState(false)
  const [query, setQuery] = useState('')
  const [voiceFilter, setVoiceFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const voicesById = useMemo(
    () => new Map(voices.map((voice) => [voice.id, voice.name])),
    [voices],
  )

  const progress = useMemo(
    () => computeSheetProgress(sheet, roster),
    [sheet, roster],
  )

  const changes = useMemo(
    () => countAttendanceChanges(draft, sheet.present),
    [draft, sheet.present],
  )
  const dirty = changes > 0

  const sections = useMemo(
    () =>
      sheet.groupByVoice
        ? sheet.voiceIds.map((voiceId) => ({
            id: voiceId,
            label: voicesById.get(voiceId) ?? voiceId,
            members: roster.filter((member) => member.voicePosition === voiceId),
          }))
        : [{ id: 'all', label: 'All members', members: roster }],
    [sheet.groupByVoice, sheet.voiceIds, roster, voicesById],
  )

  const isPresent = (key: string, date: DateKey) =>
    (draft[key] ?? []).includes(date)

  const toggle = (key: string, date: DateKey, checked: boolean) => {
    if (!canEditMembers) return
    setSaveFailed(false)
    setDraft((prev) => {
      const next = { ...prev }
      const marked = [...(prev[key] ?? [])]
      if (checked) {
        if (!marked.includes(date)) marked.push(date)
      } else {
        const index = marked.indexOf(date)
        if (index !== -1) marked.splice(index, 1)
      }
      if (marked.length === 0) delete next[key]
      else next[key] = marked.sort(compareDateKeys)
      return next
    })
  }

  const needle = query.trim().toLowerCase()
  const scopedSections =
    voiceFilter === 'all'
      ? sections
      : sections.filter((section) => section.id === voiceFilter)
  const filtering = needle.length > 0 || onlyAbsent
  const visibleSections = scopedSections
    .map((section) => ({
      ...section,
      visible: section.members.filter((member) => {
        if (needle) {
          const name =
            `${member.firstName} ${member.middleName ?? ''} ${member.lastName} ${member.suffix ?? ''}`.toLowerCase()
          if (!name.includes(needle)) return false
        }
        if (onlyAbsent && isPresent(attendancePersonKey(member.id), focusDate)) {
          return false
        }
        return true
      }),
    }))
    .filter((section) => section.visible.length > 0 || !filtering)

  const visibleCount = visibleSections.reduce(
    (sum, section) => sum + section.visible.length,
    0,
  )

  const sectionTotals = (sectionMembers: Member[]) => {
    let marked = 0
    for (const date of sheet.dates) {
      for (const member of sectionMembers) {
        if (isPresent(attendancePersonKey(member.id), date)) marked += 1
      }
    }
    return { marked, total: sectionMembers.length * sheet.dates.length }
  }

  const markAllForFocus = () => {
    if (!canEditMembers || !focusDate) return
    const keys = visibleSections.flatMap((section) =>
      section.visible.map((member) => attendancePersonKey(member.id)),
    )
    if (keys.length === 0) return
    setSaveFailed(false)
    setDraft((prev) => {
      const next = { ...prev }
      for (const key of keys) {
        const dates = new Set(next[key] ?? [])
        dates.add(focusDate)
        next[key] = [...dates].sort(compareDateKeys)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!canEditMembers || !dirty || saving) return
    setSaving(true)
    setSaveFailed(false)
    const accepted = await attendanceStore.updatePresent(sheet.id, draft)
    setSaving(false)
    setSaveFailed(!accepted)
  }

  const handleExport = (format: 'pdf' | 'word') => {
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
              trainees: traineesOf(trainees, choir).filter(
                (trainee) => trainee.status === 'active',
              ),
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
            attendanceStore.markExported(sheet.id)
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

  const today = todayPHT()
  const focusCount = progress.dateCounts[focusDate] ?? 0
  const focusPercent = percentOf(focusCount, roster.length)
  const unmarkedDateCount = sheet.dates.filter(
    (date) => (progress.dateCounts[date] ?? 0) === 0,
  ).length
  const absentMembers = roster.filter(
    (member) => !isPresent(attendancePersonKey(member.id), focusDate),
  )

  const saveLabel = saving
    ? 'Saving…'
    : saveFailed
      ? 'Save failed — changes kept'
      : dirty
        ? 'Unsaved changes'
        : 'All changes saved'

  const saveTone = saving
    ? 'text-muted-foreground'
    : saveFailed
      ? 'text-destructive'
      : dirty
        ? 'text-amber-600'
        : 'text-emerald-700'

  const saveDot = saving
    ? 'bg-muted-foreground animate-pulse'
    : saveFailed
      ? 'bg-destructive'
      : dirty
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  const saveState = (
    <span
      className={cn('flex items-center gap-1.5 text-xs font-medium', saveTone)}
      aria-live="polite"
    >
      <span className={cn('size-1.5 rounded-full', saveDot)} />
      {saveLabel}
    </span>
  )

  const exportMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={isMobile ? 'icon' : 'default'}>
          <Download className={cn('size-4', !isMobile && 'mr-2')} />
          {!isMobile && (
            <>
              Export
              <ChevronDown className="ml-1.5 size-3.5 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileDown className="mr-2 size-4" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('word')}>
          <FileText className="mr-2 size-4" />
          Word
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const backButton = (
    <Button variant="ghost" size="sm" className="w-fit" onClick={onClose}>
      <ArrowLeft className="size-4" /> Attendance
    </Button>
  )

  if (isMobile) {
    return (
      <section className="flex flex-col gap-3 pb-24">
        <div className="flex items-center gap-2">
          {backButton}
          <span className="ml-auto">{saveState}</span>
        </div>

        <MobileDirectoryHeader
          title={sheet.title}
          description={`${CHOIR_LABELS[choir]} · ${roster.length} members`}
          onOpenMenu={() => {
            // no-op; the mobile drawer is opened from the shell hamburger
          }}
        />

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Present', value: `${focusCount}`, hint: `of ${roster.length}` },
            { label: 'Absent', value: `${absentMembers.length}`, hint: formatWeekday(focusDate).slice(0, 3) },
            { label: 'Rate', value: `${focusPercent}%`, hint: 'this date' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border/70 bg-card px-2.5 py-2"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-lg font-semibold leading-tight tabular-nums">
                {stat.value}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {stat.hint}
              </p>
            </div>
          ))}
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {sheet.dates.map((date) => {
            const count = progress.dateCounts[date] ?? 0
            const active = date === focusDate
            return (
              <button
                key={date}
                type="button"
                aria-pressed={active}
                onClick={() => setFocusDate(date)}
                className={cn(
                  'min-w-16 flex-1 rounded-lg border px-2 py-1.5 text-center',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/70 bg-card text-foreground',
                )}
              >
                <span
                  className={cn(
                    'block text-[9px] font-medium',
                    active
                      ? 'text-primary-foreground/75'
                      : 'text-muted-foreground',
                  )}
                >
                  {formatWeekday(date).slice(0, 3)}
                </span>
                <span className="block text-[11px] font-semibold">
                  {dayLabel(date)}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block text-[9px] tabular-nums',
                    active
                      ? 'text-primary-foreground/75'
                      : 'text-muted-foreground/80',
                  )}
                >
                  {count}/{roster.length}
                </span>
              </button>
            )
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="flex items-center gap-2 border-b border-border/70 p-2.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a member…"
                aria-label="Find a member"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={onlyAbsent}
              onClick={() => setOnlyAbsent((value) => !value)}
              className={cn(
                onlyAbsent && 'border-amber-300 bg-amber-50 text-amber-800',
              )}
            >
              Absent
            </Button>
          </div>

          {visibleSections.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No members match this filter.
            </p>
          ) : (
            visibleSections.map((section) => {
              const totals = sectionTotals(section.members)
              return (
                <div key={section.id}>
                  <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground/70">
                    <span>
                      {section.label} · {section.members.length}
                    </span>
                    <span className="tabular-nums">
                      {percentOf(totals.marked, totals.total)}%
                    </span>
                  </div>
                  {section.visible.map((member, index) => {
                    const key = attendancePersonKey(member.id)
                    const present = isPresent(key, focusDate)
                    const future = compareDateKeys(focusDate, today) > 0
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-b-0"
                      >
                        <span
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                            AVATAR_TONES[index % AVATAR_TONES.length] ?? '',
                          )}
                        >
                          {initialsOf(member)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                          {formatAttendanceName(member, sheet.lastNameFirst)}
                        </span>
                        <MarkButton
                          present={present}
                          future={future}
                          disabled={!canEditMembers}
                          label={`${formatAttendanceName(member, sheet.lastNameFirst)} on ${shortDate(focusDate)}`}
                          onToggle={() => toggle(key, focusDate, !present)}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        <div className="sticky bottom-2 z-20 flex items-center gap-2 rounded-xl border border-border/70 bg-card/95 p-2 shadow-lg backdrop-blur">
          <Button
            className="flex-1"
            disabled={!canEditMembers || !dirty || saving}
            onClick={() => void handleSave()}
          >
            <Check className="size-4" />
            {saving
              ? 'Saving…'
              : dirty
                ? `Save ${changes} change${changes === 1 ? '' : 's'}`
                : 'Saved'}
          </Button>
          {exportMenu}
        </div>

        {exportPreview}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      {backButton}

      <PageHeader
        eyebrow={CHOIR_LABELS[choir]}
        title={sheet.title}
        description={`${sheet.dates.map(shortDate).join(' · ')} · ${roster.length} members${
          sheet.groupByVoice ? ` · ${sections.length} voices` : ''
        }`}
        actions={
          <>
            <span className="hidden lg:flex">{saveState}</span>
            {exportMenu}
            <Button
              disabled={!canEditMembers || !dirty || saving}
              onClick={() => void handleSave()}
            >
              <Check className="size-4" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
          <div
            className="relative size-11 shrink-0 rounded-full"
            style={{
              background: `conic-gradient(#059669 0 ${progress.percent}%, #e8eef6 ${progress.percent}% 100%)`,
            }}
          >
            <span className="absolute inset-[7px] grid place-items-center rounded-full bg-card text-[10px] font-bold tabular-nums">
              {progress.percent}%
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              Overall attendance
            </p>
            <p className="text-lg font-semibold leading-tight tabular-nums">
              {progress.marked}{' '}
              <span className="text-xs font-medium text-muted-foreground">
                / {progress.total} marks
              </span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {unmarkedDateCount === 0
                ? 'Every date has marks'
                : `${unmarkedDateCount} date${unmarkedDateCount === 1 ? '' : 's'} not marked`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Users className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              Present · {formatWeekday(focusDate).slice(0, 3)}
            </p>
            <p className="text-lg font-semibold leading-tight tabular-nums">
              {focusCount}{' '}
              <span className="text-xs font-medium text-muted-foreground">
                of {roster.length}
              </span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {formatDateKey(focusDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <UserMinus className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              Absent · {formatWeekday(focusDate).slice(0, 3)}
            </p>
            <p className="text-lg font-semibold leading-tight tabular-nums">
              {absentMembers.length}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              of {roster.length} members
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-card p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Clock3 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              Last saved
            </p>
            <p className="truncate text-sm font-semibold leading-tight">
              {formatPHTDateTime(new Date(sheet.updatedAt), {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {sheet.createdBy ? `by ${sheet.createdBy}` : 'No author recorded'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
            <div className="relative min-w-0 flex-1 sm:max-w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a member…"
                aria-label="Find a member"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-pressed={onlyAbsent}
              onClick={() => setOnlyAbsent((value) => !value)}
              className={cn(
                onlyAbsent && 'border-amber-300 bg-amber-50 text-amber-800',
              )}
            >
              Only absent
            </Button>
            {sections.length > 1 && (
              <Select value={voiceFilter} onValueChange={setVoiceFilter}>
                <SelectTrigger
                  className="h-9 w-36 text-xs"
                  aria-label="Filter by voice"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All voices</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              disabled={!canEditMembers || !focusDate}
              onClick={markAllForFocus}
            >
              Mark all · {dayLabel(focusDate)}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 w-10 border-b border-border/70 bg-card/95 py-2 pl-3 pr-2 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground backdrop-blur">
                    #
                  </th>
                  <th className="sticky top-0 z-10 border-b border-border/70 bg-card/95 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground backdrop-blur">
                    Member
                  </th>
                  {sheet.dates.map((date) => {
                    const count = progress.dateCounts[date] ?? 0
                    const active = date === focusDate
                    return (
                      <th
                        key={date}
                        className={cn(
                          'sticky top-0 z-10 w-28 border-b border-l border-border/70 bg-card/95 p-0 align-bottom backdrop-blur',
                          active && 'bg-primary/5',
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setFocusDate(date)}
                          className="w-full px-2 py-2 text-center"
                        >
                          <span
                            className={cn(
                              'block text-xs font-semibold',
                              active ? 'text-primary' : 'text-foreground',
                            )}
                          >
                            {dayLabel(date)}
                          </span>
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            {formatWeekday(date).slice(0, 3)}
                          </span>
                          <span
                            className={cn(
                              'mt-1 inline-flex rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
                              count > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {count > 0 ? `${count} / ${roster.length}` : 'Not marked'}
                          </span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleSections.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + sheet.dates.length}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No members match this filter.
                    </td>
                  </tr>
                ) : (
                  visibleSections.map((section) => {
                    const totals = sectionTotals(section.members)
                    const percent = percentOf(totals.marked, totals.total)
                    return (
                      <Fragment key={section.id}>
                        <tr>
                          <td
                            colSpan={2 + sheet.dates.length}
                            className="border-b border-border/70 bg-muted/40 px-3 py-1.5"
                          >
                            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground/70">
                              {section.label}
                              <span className="font-medium normal-case tracking-normal text-muted-foreground">
                                · {section.members.length} members
                              </span>
                              <span className="ml-auto flex items-center gap-2 font-medium normal-case tracking-normal text-muted-foreground">
                                <span className="h-1 w-16 overflow-hidden rounded-full bg-border">
                                  <span
                                    className="block h-full rounded-full bg-emerald-500"
                                    style={{ width: `${percent}%` }}
                                  />
                                </span>
                                <span className="tabular-nums">{percent}%</span>
                              </span>
                            </div>
                          </td>
                        </tr>
                        {section.visible.map((member, index) => {
                          const key = attendancePersonKey(member.id)
                          const name = formatAttendanceName(
                            member,
                            sheet.lastNameFirst,
                          )
                          return (
                            <tr key={member.id} className="hover:bg-muted/30">
                              <td className="border-b border-border/60 py-1.5 pl-3 pr-2 align-middle text-[11px] tabular-nums text-muted-foreground/80">
                                {index + 1}
                              </td>
                              <td className="border-b border-border/60 px-3 py-1.5 align-middle">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={cn(
                                      'grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                                      AVATAR_TONES[index % AVATAR_TONES.length] ??
                                        '',
                                    )}
                                  >
                                    {initialsOf(member)}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-[13px] font-semibold leading-tight">
                                      {name}
                                    </span>
                                    <span className="block truncate text-[11px] font-normal text-muted-foreground">
                                      {voicesById.get(member.voicePosition) ??
                                        'No voice set'}
                                    </span>
                                  </span>
                                </div>
                              </td>
                              {sheet.dates.map((date) => {
                                const present = isPresent(key, date)
                                const future = compareDateKeys(date, today) > 0
                                return (
                                  <td
                                    key={date}
                                    className={cn(
                                      'border-b border-l border-border/60 px-2 py-1.5 text-center align-middle',
                                      date === focusDate && 'bg-primary/[0.03]',
                                    )}
                                  >
                                    <MarkButton
                                      present={present}
                                      future={future}
                                      disabled={!canEditMembers}
                                      label={`${name} on ${shortDate(date)}`}
                                      onToggle={() =>
                                        toggle(key, date, !present)
                                      }
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              Showing {visibleCount} of {roster.length} members
            </span>
            {filtering && (
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setQuery('')
                  setOnlyAbsent(false)
                }}
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-3.5">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-600" />
                Present
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-border bg-background" />
                Absent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full border border-dashed border-border bg-muted/40" />
                Not marked yet
              </span>
            </span>
          </div>
        </div>

        <aside className="hidden flex-col gap-3 xl:flex">
          <div className="rounded-xl border border-border/70 bg-card">
            <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
              <h3 className="text-xs font-semibold">Session summary</h3>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {sheet.dates.length} dates
              </span>
            </div>
            <div className="px-3.5 py-3">
              {sheet.dates.map((date) => {
                const count = progress.dateCounts[date] ?? 0
                const percent = percentOf(count, roster.length)
                const active = date === focusDate
                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFocusDate(date)}
                    className={cn(
                      '-mx-1 mb-2.5 block w-[calc(100%+0.5rem)] rounded-md px-1 py-0.5 text-left last:mb-0',
                      active && 'bg-primary/5',
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2 text-[11px]">
                      <b
                        className={cn(
                          'font-semibold',
                          active && 'text-primary',
                        )}
                      >
                        {shortDate(date)}
                      </b>
                      <span className="tabular-nums text-muted-foreground">
                        {count} / {roster.length} · {percent}%
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          percent === 100 ? 'bg-emerald-500' : 'bg-amber-500',
                        )}
                        style={{ width: `${Math.max(percent, 2)}%` }}
                      />
                    </span>
                  </button>
                )
              })}

              {sections.length > 1 && (
                <>
                  <div className="my-3 h-px bg-border/70" />
                  <p className="text-[11px] font-semibold">By voice</p>
                  <p className="mb-2 text-[10px] text-muted-foreground">
                    Live, including unsaved marks
                  </p>
                  {sections.map((section) => {
                    const totals = sectionTotals(section.members)
                    const percent = percentOf(totals.marked, totals.total)
                    return (
                      <div
                        key={section.id}
                        className="mb-1.5 flex items-center gap-2 text-[11px] last:mb-0"
                      >
                        <span className="w-16 truncate font-medium text-foreground/80">
                          {section.label}
                        </span>
                        <span className="h-1 flex-1 overflow-hidden rounded bg-muted">
                          <span
                            className="block h-full bg-emerald-500"
                            style={{ width: `${percent}%` }}
                          />
                        </span>
                        <span className="w-8 text-right tabular-nums text-muted-foreground">
                          {percent}%
                        </span>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card">
            <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
              <h3 className="text-xs font-semibold">
                Absent on {dayLabel(focusDate)}
              </h3>
              <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold tabular-nums text-amber-700">
                {absentMembers.length}
              </span>
            </div>
            <div className="px-3.5 py-2.5">
              {absentMembers.length === 0 ? (
                <p className="py-1 text-[11px] text-muted-foreground">
                  Everyone is marked present for this date.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {absentMembers.slice(0, 8).map((member, index) => (
                    <li
                      key={member.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-bold',
                          AVATAR_TONES[index % AVATAR_TONES.length] ?? '',
                        )}
                      >
                        {initialsOf(member)}
                      </span>
                      <span className="min-w-0 truncate">
                        {formatAttendanceName(member, sheet.lastNameFirst)}
                      </span>
                    </li>
                  ))}
                  {absentMembers.length > 8 && (
                    <li className="text-[11px] text-muted-foreground">
                      +{absentMembers.length - 8} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card px-3.5 py-3">
            <h3 className="text-xs font-semibold">Export</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Prints this session's blank sheet for signing.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleExport('pdf')}
              >
                PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => handleExport('word')}
              >
                Word
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {exportPreview}
    </section>
  )
}
