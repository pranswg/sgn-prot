import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Info, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSuguanStore } from '@/store/suguanStore'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { detectConflicts, type Conflict } from '@/lib/conflicts'
import { formatDateLong, formatTime } from '@/lib/format'
import { PAPER_SIZE_LABELS, coverageLabel } from '@/lib/suguanUtils'
import { koroVoiceColor } from '@/lib/koro'
import { cn } from '@/lib/utils'
import type { Suguan } from '@/core/types/suguan'
import type { SuguanDraft } from './SuguanBuilderPage'
import { estimateSuguanPages } from '@/lib/suguanExport'
import { SuguanSheetPreview } from './SuguanSheetPreview'

interface ReviewStepProps {
  draft: SuguanDraft
}

const MAX_VISIBLE_CONFLICTS = 5

export function ReviewStep({ draft }: ReviewStepProps) {
  const suguan = useSuguanStore((s) => s.suguan)
  const members = useMemberStore((s) => s.members)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const allDutyRoles = useSettingsStore((s) => s.allDutyRoles)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const dutyRoleName = (id: string) => {
    const match = allDutyRoles().find((r) => r.id === id)
    if (match) return match.name
    if (id === 'oic') return 'OIC'
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ')
  }

  const pseudoSuguan: Suguan = useMemo(
    () => ({
      id: '__pending__',
      date: draft.date,
      time: draft.time,
      serviceTypeId: draft.serviceTypeId,
      type: draft.type === 'special' ? 'special' : 'regular',
      eventTitle: draft.type === 'special' ? draft.eventTitle : undefined,
      group: draft.group,
      docFormat: draft.docFormat,
      coverage: draft.coverage,
      formation: draft.formation,
      events: draft.events,
      voiceCapacities: draft.voiceCapacities,
      assignments: draft.assignments,
      schedules:
        draft.schedules.length > 0
          ? draft.schedules
          : [
              {
                id: '__pending',
                scheduleLabel: draft.type === 'regular' ? 'SUGUAN' : 'SPECIAL',
                scheduleDay: '',
                scheduleTime: '',
                assignments: draft.assignments,
              },
            ],
      dutyRoles: draft.dutyRoles,
      destinadoName: draft.destinadoName,
      createdAt: '',
      updatedAt: '',
    }),
    [draft],
  )

  const conflicts = useMemo(
    () => detectConflicts({ suguan: pseudoSuguan, members, allSuguan: suguan }),
    [pseudoSuguan, members, suguan],
  )

  const errors = conflicts.filter((c) => c.severity === 'error')
  const warnings = conflicts.filter((c) => c.severity === 'warning')

  const isSpecial = draft.type === 'special'

  const serviceName = isSpecial
    ? draft.eventTitle.trim() || 'Special Occasion'
    : allServiceTypes().find((t) => t.id === draft.serviceTypeId)?.name ??
      draft.serviceTypeId

  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of suguan) {
      if (s.id === pseudoSuguan.id) continue
      for (const a of s.assignments) {
        counts.set(a.memberId, (counts.get(a.memberId) ?? 0) + 1)
      }
    }
    return counts
  }, [suguan, pseudoSuguan.id])

  const totalAssigned = draft.assignments.length

  const pageEstimate = useMemo(
    () => estimateSuguanPages(pseudoSuguan, members, draft.docFormat),
    [pseudoSuguan, members, draft.docFormat],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Date: </span>
              <span className="font-medium">{formatDateLong(draft.date)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Time: </span>
              <span className="font-medium">{formatTime(draft.time)}</span>
            </p>
            <p>
              <span className="text-muted-foreground">
                {isSpecial ? 'Event: ' : 'Service: '}
              </span>
              <span className="font-medium">{serviceName}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Group: </span>
              <span className="font-medium">
                {draft.group === 'babae'
                  ? 'Babae'
                  : draft.group === 'lalaki'
                    ? 'Lalaki'
                    : 'Mixed (Babae & Lalaki)'}
              </span>
            </p>
            {draft.location && (
              <p>
                <span className="text-muted-foreground">Location: </span>
                <span className="font-medium">{draft.location}</span>
              </p>
            )}
            {draft.notes && (
              <p className="text-muted-foreground">Note: {draft.notes}</p>
            )}
            <p className="pt-2">
              <Badge variant="outline">{totalAssigned} members assigned</Badge>
            </p>
          </CardContent>
        </Card>

        {draft.type === 'regular' && draft.schedules.length > 0 && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Schedule Sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {draft.schedules.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate font-medium">
                    {i + 1}. {s.scheduleLabel}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {s.assignments.length} assigned
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Voice Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {voices.map((v) => {
                const capacity = draft.voiceCapacities[v.id] ?? 0
                const count = draft.assignments.filter(
                  (a) => a.voicePosition === v.id,
                ).length
                const state =
                  count > capacity
                    ? 'over'
                    : count === capacity
                      ? 'full'
                      : 'under'
                return (
                  <div
                    key={v.id}
                    className={cn(
                      'rounded-md border p-2 text-center',
                      state === 'full' && 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30',
                      state === 'over' && 'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
                    )}
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {v.shortName}
                    </p>
                    <p className="text-lg font-semibold">
                      {count}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{capacity}
                      </span>
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Print Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <SuguanSheetPreview
            suguan={pseudoSuguan}
            members={members}
            docFormat={draft.docFormat}
            previewWidth={760}
          />
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Paper size</span>
              <span className="font-medium">
                {PAPER_SIZE_LABELS[draft.docFormat.paperSize].short}
                {draft.docFormat.paperSize === 'custom' && ' (custom)'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Orientation</span>
              <span className="font-medium">
                {draft.docFormat.orientation === 'landscape' ? 'Landscape' : 'Portrait'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Font size</span>
              <span className="font-medium">
                {draft.docFormat.fontSize.charAt(0).toUpperCase() + draft.docFormat.fontSize.slice(1)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Estimated pages</span>
              <span className="font-medium">
                {pageEstimate.pages} page{pageEstimate.pages > 1 ? 's' : ''}
              </span>
            </div>
            {draft.type === 'regular' && draft.coverage && (
              <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Coverage</span>
                <span className="font-medium">{coverageLabel(draft.coverage)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isSpecial && draft.formation && draft.formation.cells.some(Boolean) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              Koro Formation Preview
              <Badge variant="outline" className="ml-auto">
                {draft.formation.rows}×{draft.formation.cols}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="mx-auto grid max-w-xl gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${draft.formation.cols}, minmax(0, 1fr))`,
              }}
            >
              {draft.formation.cells.map((cell, i) => (
                <div
                  key={i}
                  className="flex min-h-8 items-center justify-center rounded border px-1 text-center text-[10px] font-semibold"
                  style={
                    cell
                      ? { borderColor: koroVoiceColor(cell.voicePosition) }
                      : { borderColor: 'rgba(100,116,139,0.25)' }
                  }
                >
                  {cell ? cell.memberName : ''}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
  <CardHeader>
    <CardTitle>Duty Roles & Leadership</CardTitle>
  </CardHeader>
  <CardContent>
    {draft.dutyRoles.length === 0 && !draft.destinadoName ? (
      <p className="text-sm text-muted-foreground">
        No duty roles assigned.
      </p>
    ) : (
      <div className="flex flex-col gap-1 text-sm">
        {draft.dutyRoles.map((d) => (
          <div
            key={d.dutyRoleId}
            className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
          >
            <span className="text-muted-foreground">{dutyRoleName(d.dutyRoleId)}</span>
            <span className="font-medium">{d.memberName}</span>
          </div>
        ))}
        {draft.destinadoName && (
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-muted-foreground">Destinado</span>
            <span className="font-medium">{draft.destinadoName}</span>
          </div>
        )}
      </div>
    )}
  </CardContent>
</Card>

        <Card>
          <CardHeader>
            <CardTitle>Duty Balance Hint</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Recent assignment counts (from Suguan history) for members in this
              Suguan. Consider giving priority to those with fewer past duties.
            </p>
            <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto text-sm">
              {draft.assignments.map((a) => {
                const count = assignmentCounts.get(a.memberId) ?? 0
                return (
                  <div
                    key={`${a.memberId}-${a.voicePosition}`}
                    className="flex items-center justify-between rounded px-2 py-1"
                  >
                    <span className="truncate text-muted-foreground">
                      {a.memberName}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        count >= 5
                          ? ''
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                      )}
                    >
                      {count} prior
                    </Badge>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cn(errors.length > 0 && 'border-red-400')}>
        <CardHeader>
          <CardTitle>Conflict Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.length === 0 && warnings.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              No conflicts detected.
            </p>
          )}

          {errors.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-red-300/60 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20">
              <div className="flex items-center gap-2 px-3 pb-2 pt-3 text-sm font-semibold text-red-800 dark:text-red-200">
                <XCircle className="size-4" />
                Errors ({errors.length})
              </div>
              <div className="space-y-2 px-3 pb-3">
                <ConflictList conflicts={errors} tone="error" />
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-amber-300/60 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 px-3 pb-2 pt-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <Info className="size-4" />
                Warnings ({warnings.length})
              </div>
              <div className="space-y-2 px-3 pb-3">
                <ConflictList conflicts={warnings} tone="warning" />
              </div>
            </div>
          )}

          {(errors.length > 0 || warnings.length > 0) && (
            <p className="pt-1 text-xs text-muted-foreground">
              Errors should be resolved before saving. Warnings (such as
              under-filled sections) do not block saving.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ConflictList({
  conflicts,
  tone,
}: {
  conflicts: Conflict[]
  tone: 'error' | 'warning'
}) {
  const [expanded, setExpanded] = useState(false)
  const hidden = conflicts.length - MAX_VISIBLE_CONFLICTS

  return (
    <>
      {conflicts.slice(0, MAX_VISIBLE_CONFLICTS).map((c, i) => (
        <ConflictRow key={`${tone}-${i}`} conflict={c} />
      ))}

      {hidden > 0 && (
        <>
          <div
            className={cn(
              'grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out',
              expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="min-h-0 space-y-2">
              {conflicts.slice(MAX_VISIBLE_CONFLICTS).map((c, i) => (
                <ConflictRow
                  key={`${tone}-${MAX_VISIBLE_CONFLICTS + i}`}
                  conflict={c}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                'size-3.5 transition-transform duration-300',
                expanded && 'rotate-180',
              )}
            />
            {expanded ? 'Show less' : `Show all (${hidden} more)`}
          </button>
        </>
      )}
    </>
  )
}

function ConflictRow({ conflict }: { conflict: Conflict }) {
  const Icon = conflict.severity === 'error' ? XCircle : Info
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
        conflict.severity === 'error'
          ? 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'
          : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="flex items-center gap-2 font-medium">
          {conflict.severity === 'error' ? 'Error' : 'Warning'}
          <span className="text-xs font-normal opacity-70">
            {conflict.type.replace(/-/g, ' ')}
          </span>
        </p>
        <p className={cn(conflict.severity === 'error' ? 'opacity-90' : 'opacity-80')}>
          {conflict.message}
        </p>
      </div>
    </div>
  )
}