import { useMemo, useState } from 'react'
import { nanoid } from 'nanoid'
import { Check, ChevronDown, ChevronUp, Plus, Trash2, Users } from 'lucide-react'
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

interface SchedulesStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
}

export function SchedulesStep({ draft, patch }: SchedulesStepProps) {
  const presets = useAssignmentPresetStore((s) => s.presets)
  const [customOpen, setCustomOpen] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [customDay, setCustomDay] = useState('')
  const [customTime, setCustomTime] = useState('')

  const isSpecial = draft.type === 'special'

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
  }

  return (
    <div className="flex flex-col gap-5">
      {isSpecial ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Special occasions use a single roster instead of weekly worship
          schedules. You will assign members in the next step.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold">Suggested schedules</h2>
              <p className="text-xs text-muted-foreground">
                Based on the {draft.coverage?.template === 'midweek-2w'
                  ? 'midweek'
                  : draft.coverage?.template === 'weekend-2w'
                    ? 'weekend'
                    : 'chosen'}{' '}
                coverage. Matching assignment presets are loaded automatically.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {suggested.map((sched) => {
                const added = addedKeys.has(sched.id)
                const preset = findPresetByKey(presets, sched.id)
                return (
                  <div
                    key={sched.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {sched.label}
                      </span>
                      {preset && (
                        <span className="block truncate text-[11px] text-muted-foreground">
                          preset: {preset.name}
                        </span>
                      )}
                    </span>
                    {added ? (
                      <Badge className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <Check className="size-3" />
                        Added
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addSchedule(sched)}
                      >
                        <Plus className="size-4" />
                        Add
                      </Button>
                    )}
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

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Included schedules ({draft.schedules.length})
            </h3>
            {draft.schedules.length === 0 && (
              <p className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                Add at least one worship schedule before assigning members.
              </p>
            )}
            {draft.schedules.map((section, i) => (
              <div
                key={section.id}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {section.scheduleLabel}
                    </span>
                    {section.scheduleDay || section.scheduleTime ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {[section.scheduleDay, section.scheduleTime]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Badge variant="outline" className="gap-1 tabular-nums">
                    <Users className="size-3" />
                    {section.assignments.length}
                  </Badge>
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
                    onClick={() => removeSchedule(section.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {draft.type === 'regular' && draft.schedules.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalAssigned(draft)} member assignments across{' '}
          {draft.schedules.length} schedule
          {draft.schedules.length !== 1 ? 's' : ''}.
        </p>
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
    </div>
  )
}
