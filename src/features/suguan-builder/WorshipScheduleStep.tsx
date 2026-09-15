import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { nanoid } from 'nanoid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  MIDWEEK_SCHEDULES,
  WEEKEND_SCHEDULES,
  findPresetByKey,
  type WorshipSchedule,
} from '@/core/constants/worshipSchedules'
import { useAssignmentPresetStore } from '@/store/assignmentPresetStore'
import type { WorshipScheduleKey } from '@/core/types/suguan'
import type { SuguanDraft } from './SuguanBuilderPage'

interface WorshipScheduleStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
}

export function WorshipScheduleStep({ draft, patch }: WorshipScheduleStepProps) {
  const presets = useAssignmentPresetStore((s) => s.presets)

  const pool =
    draft.coverage?.template === 'midweek-2w'
      ? MIDWEEK_SCHEDULES
      : WEEKEND_SCHEDULES

  const addedKeys = new Set<WorshipScheduleKey>(
    draft.schedules
      .map((s) => s.scheduleKey)
      .filter((k) => Boolean(k)) as WorshipScheduleKey[],
  )

  const syncMirror = draft.schedules.flatMap((s) => s.assignments)

  const addSchedule = (sched: WorshipSchedule) => {
    if (addedKeys.has(sched.id)) return
    const preset = findPresetByKey(presets, sched.id)
    const now = new Date().toISOString()
    const assignments =
      preset?.assignments.map((a) => ({
        memberId: a.memberId,
        memberName: a.memberName,
        voicePosition: a.voicePosition,
        assignedAt: now,
      })) ?? []
    patch({
      schedules: [
        ...draft.schedules,
        {
          id: nanoid(),
          scheduleKey: sched.id,
          scheduleLabel: sched.label,
          scheduleDay: sched.scheduleDay,
          scheduleTime: sched.scheduleTime,
          assignments,
        },
      ],
      assignments: [...syncMirror, ...assignments],
    })
    toast.info(
      preset
        ? `Added ${sched.label} and loaded preset "${preset.name}".`
        : `Added ${sched.label}. No matching preset found — you can build its roster in the Assignments step.`,
    )
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
    if (idx < 0) return
    const list = [...draft.schedules]
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    list[idx] = list[target]
    list[target] = draft.schedules[idx]
    const schedules = list
    patch({
      schedules,
      assignments: schedules.flatMap((s) => s.assignments),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Worship Schedule Sections</h2>
        <p className="text-sm text-muted-foreground">
          Pick the worship schedules to include in this Suguan. Each one becomes
          its own section on the sheet, with its own roster. A matching
          assignment preset is loaded automatically when available.
        </p>
      </div>

      {draft.schedules.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Included sections ({draft.schedules.length})
          </h3>
          {draft.schedules.map((section, i) => {
            const preset = section.scheduleKey
              ? findPresetByKey(presets, section.scheduleKey)
              : null
            return (
              <Card key={section.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {section.scheduleLabel}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      {section.assignments.length} assigned
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Move up"
                      onClick={() => moveSchedule(section.id, -1)}
                      disabled={i === 0}
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Move down"
                      onClick={() => moveSchedule(section.id, 1)}
                      disabled={i === draft.schedules.length - 1}
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 text-muted-foreground hover:text-red-600"
                      title="Remove section"
                      onClick={() => removeSchedule(section.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-xs text-muted-foreground">
                  {preset
                    ? `Auto-loaded preset: "${preset.name}" — fine-tune its roster in the Assignments step.`
                    : 'No matching preset — build its roster in the Assignments step.'}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {pool.map((sched) => {
          const added = addedKeys.has(sched.id)
          return (
            <div
              key={sched.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{sched.label}</span>
              </div>
              {added ? (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <Check className="size-3" />
                  Added
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={() => addSchedule(sched)}>
                  <Plus className="size-4" />
                  Add
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {pool.length === 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          No known schedules for this coverage. Add at least one section to
          continue.
        </div>
      )}
    </div>
  )
}