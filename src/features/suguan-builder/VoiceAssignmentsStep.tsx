import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getVoiceName } from '@/core/constants/voicePositions'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { Member } from '@/core/types/member'
import type { SuguanDraft } from './SuguanBuilderPage'
import { MemberSelector } from './MemberSelector'

interface VoiceAssignmentsStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
  members: Member[]
}

export function VoiceAssignmentsStep({
  draft,
  patch,
  members,
}: VoiceAssignmentsStepProps) {
  const allSuguan = useSuguanStore((s) => s.suguan)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const [pickerVoice, setPickerVoice] = useState<string | null>(null)

  const assignedIds = useMemo(
    () => new Set(draft.assignments.map((a) => a.memberId)),
    [draft.assignments],
  )

  const doubleBookedIds = useMemo(() => {
    const ids = new Set<string>()
    const thisMillis = new Date(`${draft.date}T${draft.time || '00:00'}`).getTime()
    for (const s of allSuguan) {
      if (s.id === undefined) continue
      const millis = new Date(`${s.date}T${s.time || '00:00'}`).getTime()
      if (millis === thisMillis) {
        for (const a of s.assignments) ids.add(a.memberId)
      }
    }
    return ids
  }, [allSuguan, draft.date, draft.time])

  const womanVoices = voices.filter((v) => v.gender === 'female')
  const manVoices = voices.filter((v) => v.gender === 'male')

  const renderVoice = (voiceId: string) => {
    const capacity = draft.voiceCapacities[voiceId] ?? 0
    const sectionMembers = draft.assignments.filter(
      (a) => a.voicePosition === voiceId,
    )
    const count = sectionMembers.length
    const isFull = count >= capacity
    const isOver = count > capacity

    return (
      <Card key={voiceId} className={cn(isOver && 'border-amber-400')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold">
            {getVoiceName(voiceId, voices)}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              isOver
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : isFull
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {count}/{capacity}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-col gap-1">
            {sectionMembers.length === 0 && (
              <p className="py-1 text-xs text-muted-foreground">
                No members assigned yet.
              </p>
            )}
            {sectionMembers.map((a) => {
              const conflicting = doubleBookedIds.has(a.memberId)
              return (
                <div
                  key={`${a.memberId}-${a.voicePosition}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{a.memberName}</span>
                    {conflicting && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="size-3" />
                        double-booked
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 text-muted-foreground hover:text-red-600"
                    onClick={() =>
                      patch({
                        assignments: draft.assignments.filter(
                          (x) =>
                            !(x.memberId === a.memberId && x.voicePosition === a.voicePosition),
                        ),
                      })
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setPickerVoice(voiceId)}
          >
            <Plus className="size-4" />
            Add Member
          </Button>
        </CardContent>
      </Card>
    )
  }

  const pickerVoiceMeta = pickerVoice
    ? (voices.find((v) => v.id === pickerVoice) ?? null)
    : null

  const eligibleCandidates = useMemo(() => {
    if (!pickerVoiceMeta) return []
    return members
      .filter((m) => m.isActive)
      .filter((m) => m.gender === pickerVoiceMeta.gender)
      .filter((m) => m.voicePosition === pickerVoice)
  }, [pickerVoice, pickerVoiceMeta, members])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">Voice Assignments</h2>
        <p className="text-sm text-muted-foreground">
          Assign members to each voice position. Only active members with the
          matching voice are offered as candidates.
        </p>
      </div>

      {draft.assignments.length === 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          No members are assigned yet. Add members to at least one voice
          position before continuing.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Women's Choir
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">{womanVoices.map((v) => renderVoice(v.id))}</div>
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Men's Choir
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">{manVoices.map((v) => renderVoice(v.id))}</div>
        </div>
      </div>

      <Dialog open={!!pickerVoice} onOpenChange={(o) => !o && setPickerVoice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pickerVoice ? getVoiceName(pickerVoice, voices) : ''} — Add Member
            </DialogTitle>
          </DialogHeader>
          {pickerVoice && (
            <MemberSelector
              candidates={eligibleCandidates}
              excludedIds={Array.from(assignedIds)}
              conflictIds={doubleBookedIds}
              onSelect={(member: Member) => {
                patch({
                  assignments: [
                    ...draft.assignments,
                    {
                      memberId: member.id,
                      memberName: `${member.firstName} ${member.lastName}`,
                      voicePosition: pickerVoice,
                      assignedAt: new Date().toISOString(),
                    },
                  ],
                })
                setPickerVoice(null)
              }}
              onClose={() => setPickerVoice(null)}
              emptyMessage="No eligible active members with this voice position."
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}