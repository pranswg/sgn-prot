import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Sigma,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  ALL_WORSHIP_SCHEDULES,
  allSchedulesOf,
  findPresetByKey,
  type WorshipSchedule,
} from '@/core/constants/worshipSchedules'
import { useAssignmentPresetStore } from '@/store/assignmentPresetStore'
import { useWorshipScheduleCategories } from '@/store/worshipScheduleStore'
import { formatDateKey } from '@/lib/phDate'
import { totalAssigned, type SuguanDraft } from './builderState'
import { cn } from '@/lib/utils'

interface SchedulesStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
}

/** Human-readable worship block for a suggested schedule, derived from its time. */
function scheduleDescription(sched: WorshipSchedule): string {
  return sched.scheduleTime.includes('AM')
    ? 'Morning Worship Service'
    : 'Evening Worship Service'
}

/** Detail line for an included schedule: the detected calendar date for a
 * one-week section, the configured schedule's description, or the custom
 * day/time/description, whichever is relevant. */
function includedDetailFor(
  section: SuguanDraft['schedules'][number],
  knownSchedules: readonly WorshipSchedule[] = ALL_WORSHIP_SCHEDULES,
): string {
  if (section.scheduleDate) {
    const bits = [
      formatDateKey(section.scheduleDate),
      section.scheduleTime,
      section.description,
    ]
    return bits.filter(Boolean).join(' · ')
  }
  const known = knownSchedules.find((s) => s.id === section.scheduleKey)
  if (known) return scheduleDescription(known)
  return (
    [section.scheduleDay, section.scheduleTime, section.description]
      .filter(Boolean)
      .join(' · ') || 'Custom schedule'
  )
}

export function SchedulesStep({ draft, patch }: SchedulesStepProps) {
  const presets = useAssignmentPresetStore((s) => s.presets)
  const scheduleCategories = useWorshipScheduleCategories()
  const [customOpen, setCustomOpen] = useState(false)
  const [customSheetOpen, setCustomSheetOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customDay, setCustomDay] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [reorderOpen, setReorderOpen] = useState(false)
  const [moveAnim, setMoveAnim] = useState<{
    id: string
    dir: 'up' | 'down'
    seq: number
  } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDay, setEditDay] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const suggested = useMemo<WorshipSchedule[]>(() => {
    if (draft.coverage?.template === 'midweek-2w')
      return [...scheduleCategories.midweek]
    if (draft.coverage?.template === 'weekend-2w')
      return [...scheduleCategories.weekend]
    return [...allSchedulesOf(scheduleCategories)]
  }, [draft.coverage?.template, scheduleCategories])

  const addedKeys = useMemo(
    () =>
      new Set(
        draft.schedules
          .map((s) => s.scheduleKey)
          .filter((k): k is NonNullable<typeof k> => Boolean(k)),
      ),
    [draft.schedules],
  )

  const addSchedule = (sched: WorshipSchedule) => {
    if (addedKeys.has(sched.id)) return
    const preset = findPresetByKey(presets, sched.id)
    const now = new Date().toISOString()
    const assignments = (preset?.assignments ?? []).map((a) => ({
      memberId: a.memberId,
      memberName: a.memberName,
      voicePosition: a.voicePosition,
      assignedAt: now,
    }))
    const schedules = [
      ...draft.schedules,
      {
        id: nanoid(),
        scheduleKey: sched.id,
        scheduleLabel: sched.label,
        scheduleDay: sched.scheduleDay,
        scheduleTime: sched.scheduleTime,
        assignments,
      },
    ]
    patch({
      schedules,
      assignments: schedules.flatMap((s) => s.assignments),
    })
    toast.success(
      preset
        ? `Added ${sched.label} with preset "${preset.name}".`
        : `Added ${sched.label}.`,
    )
  }

  const clearCustom = () => {
    setCustomLabel('')
    setCustomDay('')
    setCustomTime('')
    setCustomDescription('')
  }

  const closeCustom = () => {
    setCustomOpen(false)
    setCustomSheetOpen(false)
  }

  const addCustom = () => {
    const label = customLabel.trim()
    if (!label) {
      toast.error('Give the schedule a label first.')
      return
    }
    const schedules = [
      ...draft.schedules,
      {
        id: nanoid(),
        scheduleLabel: label,
        scheduleDay: customDay.trim(),
        scheduleTime: customTime.trim(),
        description: customDescription.trim() || undefined,
        assignments: [],
      },
    ]
    patch({
      schedules,
      assignments: schedules.flatMap((s) => s.assignments),
    })
    clearCustom()
    closeCustom()
    toast.success(`Added ${label}.`)
  }

  const removeSchedule = (id: string) => {
    const schedules = draft.schedules.filter((s) => s.id !== id)
    patch({
      schedules,
      assignments: schedules.flatMap((s) => s.assignments),
    })
  }

  const moveSchedule = (id: string, dir: -1 | 1) => {
    const idx = draft.schedules.findIndex((s) => s.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= draft.schedules.length) return
    const list = [...draft.schedules]
    const [item] = list.splice(idx, 1)
    list.splice(target, 0, item)
    patch({
      schedules: list,
      assignments: list.flatMap((s) => s.assignments),
    })
    setMoveAnim((prev) => ({
      id,
      dir: dir === -1 ? 'up' : 'down',
      seq: (prev?.seq ?? 0) + 1,
    }))
  }

  const openEdit = (section: (typeof draft.schedules)[number]) => {
    setEditId(section.id)
    setEditLabel(section.scheduleLabel)
    setEditDay(section.scheduleDay ?? '')
    setEditTime(section.scheduleTime ?? '')
    setEditDescription(section.description ?? '')
  }

  const saveEdit = () => {
    if (!editId) return
    const label = editLabel.trim()
    if (!label) {
      toast.error('Give the schedule a label first.')
      return
    }
    const schedules = draft.schedules.map((s) =>
      s.id === editId
        ? {
            ...s,
            scheduleLabel: label,
            scheduleDay: editDay.trim(),
            scheduleTime: editTime.trim(),
            description: editDescription.trim() || undefined,
          }
        : s,
    )
    patch({ schedules })
    setEditId(null)
    toast.success('Schedule updated.')
  }

  const suggestedCount = suggested.filter((s) => addedKeys.has(s.id)).length
  const scheduleCount = draft.schedules.length
  const assigned = totalAssigned(draft)

  const suggestedCard = (sched: WorshipSchedule, added: boolean) => (
    <div
      key={sched.id}
      className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy-soft text-brand-navy">
        <CalendarDays className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {sched.label}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {scheduleDescription(sched)}
        </span>
      </span>
      {added ? (
        <Badge className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          <Check className="size-3" />
          Added
        </Badge>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="shrink-0 px-2.5"
          onClick={() => addSchedule(sched)}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop layout — unchanged */}
      <div className="hidden md:block">
        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card xl:rounded-lg">
          <header className="flex items-start gap-2.5 border-b border-border/70 px-4 py-3">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-brand-navy/70" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Schedules</h3>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                Choose the worship schedules to include, then assign members in the
                center panel.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-5 p-4">
            <div className="flex flex-col gap-3">
              {scheduleCount === 0 && (
                <p className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  Add at least one worship schedule before assigning members.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {draft.schedules.map((section, i) => {
                  const detail = includedDetailFor(section, allSchedulesOf(scheduleCategories))
                  return (
                    <div
                      key={
                        moveAnim?.id === section.id
                          ? `${section.id}:${moveAnim.seq}`
                          : section.id
                      }
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5',
                        moveAnim?.id === section.id &&
                          (moveAnim.dir === 'up'
                            ? 'animate-in slide-in-from-bottom-2 duration-200 ease-out motion-reduce:animate-none'
                            : 'animate-in slide-in-from-top-2 duration-200 ease-out motion-reduce:animate-none'),
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {section.scheduleLabel}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {detail}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <Check className="size-3" />
                          Added
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Edit schedule info"
                          onClick={() => openEdit(section)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Move up"
                          onClick={() => moveSchedule(section.id, -1)}
                          disabled={i === 0}
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Move down"
                          onClick={() => moveSchedule(section.id, 1)}
                          disabled={i === scheduleCount - 1}
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Remove schedule"
                          className="hover:text-destructive"
                          onClick={() => removeSchedule(section.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    </div>
                  )
                })}
                {suggested
                  .filter((sched) => !addedKeys.has(sched.id))
                  .map((sched) => {
                    const preset = findPresetByKey(presets, sched.id)
                    return (
                      <div
                        key={sched.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {sched.label}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {scheduleDescription(sched)}
                          </span>
                          {preset && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              preset: {preset.name}
                            </span>
                          )}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addSchedule(sched)}
                        >
                          <Plus className="size-4" />
                          Add
                        </Button>
                      </div>
                    )
                  })}
              </div>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomOpen(true)}
                >
                  <Plus className="size-4" />
                  Add custom schedule
                </Button>
              </div>
            </div>

            {scheduleCount > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Total assignments
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Across {scheduleCount} schedule
                    {scheduleCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-lg font-semibold tabular-nums text-brand-navy">
                  {assigned}
                </span>
              </div>
            )}

            <Dialog open={customOpen} onOpenChange={setCustomOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Add custom schedule</DialogTitle>
                </DialogHeader>
                <CustomScheduleFields
                  idPrefix="custom"
                  label={customLabel}
                  day={customDay}
                  time={customTime}
                  description={customDescription}
                  onLabel={setCustomLabel}
                  onDay={setCustomDay}
                  onTime={setCustomTime}
                  onDescription={setCustomDescription}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCustomOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addCustom}>Add schedule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={editId !== null} onOpenChange={(o) => !o && setEditId(null)}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Edit schedule info</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-label">Label</Label>
                    <Input
                      id="edit-label"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="e.g. MIYERKULES, 7:00 PM"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="edit-day">Day (optional)</Label>
                      <Input
                        id="edit-day"
                        value={editDay}
                        onChange={(e) => setEditDay(e.target.value)}
                        placeholder="LINGGO"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="edit-time">Time (optional)</Label>
                      <Input
                        id="edit-time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        placeholder="8:00 PM"
                      />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="edit-description">Description (optional)</Label>
                    <Input
                      id="edit-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="e.g. Special worship service"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditId(null)}>
                    Cancel
                  </Button>
                  <Button onClick={saveEdit}>Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      </div>

      {/* Mobile layout — native scheduling app style */}
      <div className="flex flex-col gap-4 md:hidden">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,42,67,0.04)]">
          <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-navy-soft text-brand-navy">
              <CalendarClock className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Schedules</h3>
              <p className="text-xs text-muted-foreground">
                Choose the worship schedules to include.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-5 p-4">
            {scheduleCount === 0 && (
              <p className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Add at least one worship schedule before assigning members.
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suggested Schedules
                </p>
                <Badge variant="outline" className="tabular-nums">
                  {suggestedCount}/{suggested.length}
                </Badge>
              </div>
              {suggested.map((sched) => suggestedCard(sched, addedKeys.has(sched.id)))}
            </div>

            <Button
              variant="outline"
              className="w-full border-primary/20 bg-brand-navy-soft/70 py-2.5 text-brand-navy-deep hover:bg-brand-navy-soft"
              onClick={() => setCustomSheetOpen(true)}
            >
              <Plus className="size-4" />
              Add Custom Schedule
            </Button>

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Included Schedules ({scheduleCount})
                </p>
                {scheduleCount >= 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-brand-navy-deep dark:text-blue-300"
                    onClick={() => setReorderOpen((o) => !o)}
                  >
                    {reorderOpen ? 'Done' : 'Reorder'}
                  </Button>
                )}
              </div>

              {scheduleCount === 0 && (
                <p className="px-1 text-xs text-muted-foreground">
                  Nothing included yet. Add one above.
                </p>
              )}

              {draft.schedules.map((section, i) => (
                <div
                  key={section.id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3"
                >
                  <span
                    className={cn(
                      'shrink-0 text-muted-foreground/40',
                      reorderOpen && 'text-brand-navy',
                    )}
                  >
                    <GripVertical className="size-4.5" />
                  </span>
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground"
                  >
                    {i + 1}
                  </span>
                  {reorderOpen ? (
                    <>
                      <span className="min-w-0 flex-1 py-0.5">
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => openEdit(section)}
                        >
                          <span className="block truncate text-sm font-medium text-foreground">
                            {section.scheduleLabel}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {section.assignments.length} member
                            {section.assignments.length !== 1 ? 's' : ''}
                          </span>
                        </button>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Move up"
                          onClick={() => moveSchedule(section.id, -1)}
                          disabled={i === 0}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Move down"
                          onClick={() => moveSchedule(section.id, 1)}
                          disabled={i === scheduleCount - 1}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Remove schedule"
                          className="hover:text-destructive"
                          onClick={() => removeSchedule(section.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => openEdit(section)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {section.scheduleLabel}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {section.assignments.length} member
                          {section.assignments.length !== 1 ? 's' : ''}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0 tabular-nums">
                        {section.assignments.length}
                      </Badge>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-primary/20 bg-brand-navy-soft/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
                <Sigma className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Total Assignments
                </p>
                <p className="text-xs text-muted-foreground">
                  Across {scheduleCount} schedule
                  {scheduleCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <span className="text-3xl font-bold tabular-nums text-brand-navy">
              {assigned}
            </span>
          </div>
        </section>
      </div>

      {/* Add custom schedule — mobile bottom sheet */}
      <Sheet open={customSheetOpen} onOpenChange={setCustomSheetOpen}>
        <SheetContent
          side="bottom"
          className="gap-3 rounded-t-3xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden"
        >
          <span
            aria-hidden
            className="mx-auto mt-0.5 h-1.5 w-10 shrink-0 rounded-full bg-muted"
          />
          <SheetHeader className="p-0 pr-8">
            <SheetTitle>Add Custom Schedule</SheetTitle>
            <SheetDescription>
              Create a custom worship schedule for this Suguan.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-1 grid gap-3">
            <CustomScheduleFields
              idPrefix="sheet"
              label={customLabel}
              day={customDay}
              time={customTime}
              description={customDescription}
              onLabel={setCustomLabel}
              onDay={setCustomDay}
              onTime={setCustomTime}
              onDescription={setCustomDescription}
            />
          </div>
          <SheetFooter className="mt-1 flex-row gap-2 p-0">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCustomSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button className="flex-1" onClick={addCustom}>
              Add Schedule
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

function CustomScheduleFields({
  idPrefix,
  label,
  day,
  time,
  description,
  onLabel,
  onDay,
  onTime,
  onDescription,
}: {
  idPrefix: string
  label: string
  day: string
  time: string
  description: string
  onLabel: (v: string) => void
  onDay: (v: string) => void
  onTime: (v: string) => void
  onDescription: (v: string) => void
}) {
  return (
    <>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-label`}>Schedule Name</Label>
        <Input
          id={`${idPrefix}-label`}
          value={label}
          onChange={(e) => onLabel(e.target.value)}
          placeholder="e.g. Linggo, 8:00 PM"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Description (Optional)</Label>
        <Input
          id={`${idPrefix}-description`}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="e.g. Special worship service"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-day`}>Day</Label>
          <Input
            id={`${idPrefix}-day`}
            value={day}
            onChange={(e) => onDay(e.target.value)}
            placeholder="LINGGO"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-time`}>Time</Label>
          <Input
            id={`${idPrefix}-time`}
            value={time}
            onChange={(e) => onTime(e.target.value)}
            placeholder="8:00 PM"
          />
        </div>
      </div>
    </>
  )
}