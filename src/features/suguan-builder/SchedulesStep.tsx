import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
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
  ALL_WORSHIP_SCHEDULES,
  MIDWEEK_SCHEDULES,
  WEEKEND_SCHEDULES,
  findPresetByKey,
  type WorshipSchedule,
} from '@/core/constants/worshipSchedules'
import { useAssignmentPresetStore } from '@/store/assignmentPresetStore'
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

export function SchedulesStep({ draft, patch }: SchedulesStepProps) {
  const presets = useAssignmentPresetStore((s) => s.presets)
  const [customOpen, setCustomOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customDay, setCustomDay] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [moveAnim, setMoveAnim] = useState<{
    id: string
    dir: 'up' | 'down'
    seq: number
  } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDay, setEditDay] = useState('')
  const [editTime, setEditTime] = useState('')

  const suggested = useMemo<WorshipSchedule[]>(() => {
    if (draft.coverage?.template === 'midweek-2w') return MIDWEEK_SCHEDULES
    if (draft.coverage?.template === 'weekend-2w') return WEEKEND_SCHEDULES
    return ALL_WORSHIP_SCHEDULES
  }, [draft.coverage?.template])

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
        assignments: [],
      },
    ]
    patch({
      schedules,
      assignments: schedules.flatMap((s) => s.assignments),
    })
    setCustomLabel('')
    setCustomDay('')
    setCustomTime('')
    setCustomOpen(false)
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
          }
        : s,
    )
    patch({ schedules })
    setEditId(null)
    toast.success('Schedule updated.')
  }

  return (
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
          {draft.schedules.length === 0 && (
            <p className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Add at least one worship schedule before assigning members.
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {draft.schedules.map((section, i) => {
              const template = ALL_WORSHIP_SCHEDULES.find(
                (s) => s.id === section.scheduleKey,
              )
              const detail = template
                ? scheduleDescription(template)
                : [section.scheduleDay, section.scheduleTime]
                    .filter(Boolean)
                    .join(' · ') || 'Custom schedule'
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
                      disabled={i === draft.schedules.length - 1}
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

      {draft.schedules.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Total assignments
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Across {draft.schedules.length} schedule
              {draft.schedules.length !== 1 ? 's' : ''}
            </p>
          </div>
          <span className="text-lg font-semibold tabular-nums text-brand-navy">
            {totalAssigned(draft)}
          </span>
        </div>
      )}

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add custom schedule</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="custom-label">Label</Label>
              <Input
                id="custom-label"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Linggo, 8:00 PM"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="custom-day">Day (optional)</Label>
                <Input
                  id="custom-day"
                  value={customDay}
                  onChange={(e) => setCustomDay(e.target.value)}
                  placeholder="LINGGO"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="custom-time">Time (optional)</Label>
                <Input
                  id="custom-time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="8:00 PM"
                />
              </div>
            </div>
          </div>
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
  )
}
