import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, CalendarPlus, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useNavStore } from '@/store/navStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useMemberStore } from '@/store/memberStore'
import { defaultCapacities } from '@/core/constants/serviceTypes'
import { getVoiceName } from '@/core/constants/voicePositions'
import type { SuguanAssignment, SuguanDutyRole, Suguan } from '@/core/types/suguan'
import { cn } from '@/lib/utils'
import { VoiceAssignmentsStep } from './VoiceAssignmentsStep'
import { DutyRolesStep } from './DutyRolesStep'
import { ReviewStep } from './ReviewStep'

export interface SuguanDraft {
  date: string
  time: string
  serviceTypeId: string
  location: string
  notes: string
  voiceCapacities: Record<string, number>
  assignments: SuguanAssignment[]
  dutyRoles: SuguanDutyRole[]
}

const STEPS = [
  { id: 0, title: 'Service', short: 'Service' },
  { id: 1, title: 'Capacities', short: 'Capacities' },
  { id: 2, title: 'Assignments', short: 'Assignments' },
  { id: 3, title: 'Duty Roles', short: 'Duty Roles' },
  { id: 4, title: 'Review', short: 'Review' },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function SuguanBuilderPage() {
  const navigate = useNavStore((s) => s.navigate)
  const builderSuguanId = useNavStore((s) => s.builderSuguanId)
  const suguan = useSuguanStore((s) => s.suguan)
  const createSuguan = useSuguanStore((s) => s.createSuguan)
  const updateSuguan = useSuguanStore((s) => s.updateSuguan)
  const publishSuguan = useSuguanStore((s) => s.publishSuguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const members = useMemberStore((s) => s.members)

  const existing = useMemo<Suguan | null>(
    () => suguan.find((s) => s.id === builderSuguanId) ?? null,
    [suguan, builderSuguanId],
  )

  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<SuguanDraft>({
    date: todayISO(),
    time: '09:00',
    serviceTypeId: 'linggo-am',
    location: '',
    notes: '',
    voiceCapacities: defaultCapacities(voices),
    assignments: [],
    dutyRoles: [],
  })

  useEffect(() => {
    if (existing && existing.status === 'draft') {
      setDraft({
        date: existing.date,
        time: existing.time,
        serviceTypeId: existing.serviceTypeId,
        location: existing.location ?? '',
        notes: existing.notes ?? '',
        voiceCapacities: existing.voiceCapacities,
        assignments: existing.assignments,
        dutyRoles: existing.dutyRoles,
      })
      setStep(2)
    }
  }, [existing])

  const patch = (p: Partial<SuguanDraft>) => setDraft((d) => ({ ...d, ...p }))

  const canGoNext = (() => {
    if (step === 0) return draft.date && draft.time && draft.serviceTypeId
    if (step === 2) return draft.assignments.length > 0
    return true
  })()

  const handleFinish = (mode: 'draft' | 'publish') => {
    if (!draft.date || !draft.time || !draft.serviceTypeId) {
      toast.error('Please configure the service first.')
      return
    }
    if (existing) {
      updateSuguan(existing.id, {
        date: draft.date,
        time: draft.time,
        serviceTypeId: draft.serviceTypeId,
        location: draft.location || undefined,
        notes: draft.notes || undefined,
        voiceCapacities: draft.voiceCapacities,
        assignments: draft.assignments,
        dutyRoles: draft.dutyRoles,
      })
      if (mode === 'publish') publishSuguan(existing.id)
      toast.success(
        mode === 'publish'
          ? 'Suguan published.'
          : 'Draft saved.',
      )
    } else {
      const created = createSuguan({
        date: draft.date,
        time: draft.time,
        serviceTypeId: draft.serviceTypeId,
        location: draft.location || undefined,
        notes: draft.notes || undefined,
      })
      updateSuguan(created.id, {
        voiceCapacities: draft.voiceCapacities,
        assignments: draft.assignments,
        dutyRoles: draft.dutyRoles,
      })
      if (mode === 'publish') publishSuguan(created.id)
      toast.success(
        mode === 'publish'
          ? 'Suguan created and published.'
          : 'Suguan saved as draft.',
      )
    }
    navigate('suguan-history')
  }

  const cancel = () => {
    if (existing && existing.status === 'draft') {
      navigate('suguan-history')
      return
    }
    navigate('dashboard')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={existing ? 'Edit Draft Suguan' : 'Suguan Builder'}
        description="Create and schedule a complete Suguan step by step."
        actions={
          <Button variant="ghost" onClick={cancel}>
            <X className="size-4" />
            Cancel
          </Button>
        }
      />

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => i < step && setStep(i)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              i === step
                ? 'bg-primary text-primary-foreground'
                : i < step
                  ? 'text-primary hover:bg-accent'
                  : 'text-muted-foreground',
            )}
          >
            {i < step ? (
              <Check className="size-4" />
            ) : (
              <span className="flex size-5 items-center justify-center rounded-full border text-xs">
                {i + 1}
              </span>
            )}
            {s.title}
          </button>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Service Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={draft.date}
                    onChange={(e) => patch({ date: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={draft.time}
                    onChange={(e) => patch({ time: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Service Type</Label>
                  <Select
                    value={draft.serviceTypeId}
                    onValueChange={(v) => patch({ serviceTypeId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allServiceTypes().map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={draft.location}
                    onChange={(e) => patch({ location: e.target.value })}
                    placeholder="e.g. Lokal ng Kamuning"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={draft.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Optional notes for this service"
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Target Voice Capacities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Set the target number of members for each voice position. Sections
              below target show a warning but do not block publication.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(draft.voiceCapacities).map(([voiceId, capacity]) => {
                const assigned = draft.assignments.filter(
                  (a) => a.voicePosition === voiceId,
                ).length
                return (
                  <div
                    key={voiceId}
                    className={cn(
                      'grid gap-2 rounded-md border p-3',
                      assigned > capacity &&
                        'border-amber-400 bg-amber-50 dark:bg-amber-950/30',
                    )}
                  >
<Label className="text-xs uppercase tracking-wide text-muted-foreground">
  {getVoiceName(voiceId, voices)}
</Label>
                    <Input
                      type="number"
                      min={0}
                      value={capacity}
                      onChange={(e) =>
                        patch({
                          voiceCapacities: {
                            ...draft.voiceCapacities,
                            [voiceId]: Math.max(0, Number(e.target.value) || 0),
                          },
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {assigned} assigned now
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <VoiceAssignmentsStep draft={draft} patch={patch} members={members} />
      )}

      {step === 3 && (
        <DutyRolesStep draft={draft} patch={patch} members={members} />
      )}

      {step === 4 && <ReviewStep draft={draft} />}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {step === 4 ? (
            <>
              <Button variant="outline" onClick={() => handleFinish('draft')}>
                Save as Draft
              </Button>
              <Button onClick={() => handleFinish('publish')}>
                <CalendarPlus className="size-4" />
                Publish Suguan
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canGoNext}
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}