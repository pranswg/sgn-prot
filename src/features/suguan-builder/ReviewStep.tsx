import { useMemo } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useSuguanStore } from '@/store/suguanStore'
import { useMemberStore } from '@/store/memberStore'
import { useSettingsStore } from '@/store/settingsStore'
import { detectConflicts, type Conflict } from '@/lib/conflicts'
import { formatDateLong, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Suguan } from '@/core/types/suguan'
import type { SuguanDraft } from './SuguanBuilderPage'

interface ReviewStepProps {
  draft: SuguanDraft
}

export function ReviewStep({ draft }: ReviewStepProps) {
  const suguan = useSuguanStore((s) => s.suguan)
  const members = useMemberStore((s) => s.members)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()

  const pseudoSuguan: Suguan = useMemo(
    () => ({
      id: '__pending__',
      date: draft.date,
      time: draft.time,
      serviceTypeId: draft.serviceTypeId,
      status: 'draft',
      voiceCapacities: draft.voiceCapacities,
      assignments: draft.assignments,
      dutyRoles: draft.dutyRoles,
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

  const serviceName =
    allServiceTypes().find((t) => t.id === draft.serviceTypeId)?.name ??
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
              <span className="text-muted-foreground">Service: </span>
              <span className="font-medium">{serviceName}</span>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Special Duty Roles</CardTitle>
          </CardHeader>
          <CardContent>
            {draft.dutyRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No special duty roles assigned.
              </p>
            ) : (
              <div className="flex flex-col gap-1 text-sm">
                {draft.dutyRoles.map((d) => (
                  <div
                    key={d.dutyRoleId}
                    className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
                  >
                    <span className="text-muted-foreground">{d.dutyRoleId}</span>
                    <span className="font-medium">{d.memberName}</span>
                  </div>
                ))}
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
        <CardContent className="space-y-2">
          {errors.length === 0 && warnings.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              No conflicts detected.
            </p>
          )}
          {errors.map((c, i) => (
            <ConflictRow key={`e-${i}`} conflict={c} />
          ))}
          {warnings.map((c, i) => (
            <ConflictRow key={`w-${i}`} conflict={c} />
          ))}
          {errors.length > 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              Errors should be resolved before publishing. Warnings (such as
              under-filled sections) do not block publication.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
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