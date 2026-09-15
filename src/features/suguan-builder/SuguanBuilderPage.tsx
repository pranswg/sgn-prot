import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
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
import type {
  SuguanAssignment,
  SuguanDutyRole,
  Suguan,
  SuguanGroup,
  SuguanEvent,
  SuguanFormation,
  SuguanType,
  SuguanDocFormat,
  SuguanCoverage,
  SuguanScheduleSection,
} from '@/core/types/suguan'
import { todayISO, DEFAULT_DOC_FORMAT, inferCoverageFromEvents } from '@/lib/suguanUtils'
import { cn } from '@/lib/utils'
import { ModeSelectStep } from './ModeSelectStep'
import { DocumentSetupStep } from './DocumentSetupStep'
import { CoverageStep } from './CoverageStep'
import { WorshipScheduleStep } from './WorshipScheduleStep'
import { ScheduleAssignmentsStep } from './ScheduleAssignmentsStep'
import { VoiceAssignmentsStep } from './VoiceAssignmentsStep'
import { KoroMakerStep } from './KoroMakerStep'
import { ReviewStep } from './ReviewStep'

export interface SuguanDraft {
  type: SuguanType | ''
  docFormat: SuguanDocFormat
  coverage: SuguanCoverage | null
  date: string
  time: string
  serviceTypeId: string
  eventTitle: string
  location: string
  notes: string
  group: SuguanGroup
  events: SuguanEvent[]
  formation: SuguanFormation | null
  voiceCapacities: Record<string, number>
  assignments: SuguanAssignment[]
  schedules: SuguanScheduleSection[]
  dutyRoles: SuguanDutyRole[]
  destinadoName: string
}

const REGULAR_STEPS = [
  'Mode',
  'Document Setup',
  'Coverage',
  'Worship Schedules',
  'Service',
  'Assignments',
  'Review',
]

const SPECIAL_STEPS = [
  'Mode',
  'Document Setup',
  'Event Info',
  'Assignments',
  'Koro Maker',
  'Review',
]

export function SuguanBuilderPage() {
  const navigate = useNavStore((s) => s.navigate)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)
  const builderSuguanId = useNavStore((s) => s.builderSuguanId)
  const suguan = useSuguanStore((s) => s.suguan)
  const createSuguan = useSuguanStore((s) => s.createSuguan)
  const updateSuguan = useSuguanStore((s) => s.updateSuguan)
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const members = useMemberStore((s) => s.members)

  const existing = useMemo<Suguan | null>(
    () => suguan.find((s) => s.id === builderSuguanId) ?? null,
    [suguan, builderSuguanId],
  )

  const [step, setStep] = useState(existing ? 1 : 0)
  const [draft, setDraft] = useState<SuguanDraft>({
    type: existing ? existing.type : '',
    docFormat: existing?.docFormat ?? { ...DEFAULT_DOC_FORMAT },
    coverage:
      existing?.coverage ??
      (existing?.type === 'regular'
        ? inferCoverageFromEvents(existing?.events ?? [])
        : null),
    date: existing?.date ?? todayISO(),
    time: existing?.time ?? '09:00',
    serviceTypeId: existing?.serviceTypeId ?? 'linggo-am',
    eventTitle: existing?.eventTitle ?? '',
    location: existing?.location ?? '',
    notes: existing?.notes ?? '',
    group: existing?.group ?? 'babae',
    events: existing?.events ?? [],
    formation: existing?.formation ?? null,
    voiceCapacities: existing?.voiceCapacities ?? defaultCapacities(voices),
    assignments: existing?.assignments ?? [],
    schedules: existing?.schedules ?? [],
    dutyRoles: existing?.dutyRoles ?? [],
    destinadoName: existing?.destinadoName ?? '',
  })

  useEffect(() => {
    if (existing) {
      setDraft({
        type: existing.type,
        docFormat: existing.docFormat ?? { ...DEFAULT_DOC_FORMAT },
        coverage:
          existing.coverage ??
          (existing.type === 'regular'
            ? inferCoverageFromEvents(existing.events)
            : null),
        date: existing.date,
        time: existing.time,
        serviceTypeId: existing.serviceTypeId,
        eventTitle: existing.eventTitle ?? '',
        location: existing.location ?? '',
        notes: existing.notes ?? '',
        group: existing.group,
        events: existing.events,
        formation: existing.formation ?? null,
        voiceCapacities: existing.voiceCapacities,
        assignments: existing.assignments,
        schedules: existing.schedules ?? [],
        dutyRoles: existing.dutyRoles,
        destinadoName: existing.destinadoName ?? '',
      })
      setStep(1)
    }
  }, [existing])

  const patch = (p: Partial<SuguanDraft>) => setDraft((d) => ({ ...d, ...p }))

  const steps = draft.type === 'special' ? SPECIAL_STEPS : REGULAR_STEPS

  const isStepComplete = (i: number): boolean => {
    const totalAssigned =
      draft.schedules.length > 0
        ? draft.schedules.reduce((acc, s) => acc + s.assignments.length, 0)
        : draft.assignments.length
    switch (i) {
      case 0:
        return draft.type !== ''
      case 1:
        return Boolean(draft.docFormat.paperSize && draft.docFormat.orientation)
      case 2:
        if (draft.type === 'special') {
          return Boolean(draft.date && draft.eventTitle.trim())
        }
        return draft.coverage != null
      case 3:
        if (draft.type === 'special') return draft.assignments.length > 0
        return draft.schedules.length > 0
      case 4:
        return draft.type === 'regular' ? Boolean(draft.serviceTypeId) : true
      case 5:
        return draft.type === 'regular' ? totalAssigned > 0 : true
      default:
        return true
    }
  }

  const canGoNext = isStepComplete(step)

  let maxReachable = 0
  while (maxReachable < steps.length - 1 && isStepComplete(maxReachable)) {
    maxReachable++
  }

  const handleSave = () => {
    if (draft.type === 'regular') {
      if (!draft.coverage) {
        toast.error('Please choose a Suguan coverage first.')
        return
      }
      if (draft.events.length === 0) {
        toast.error('No schedule events were generated. Please check the coverage.')
        return
      }
      if (!draft.serviceTypeId) {
        toast.error('Please configure the service first.')
        return
      }
    } else {
      if (!draft.date || !draft.eventTitle.trim()) {
        toast.error('Please provide the event name and date.')
        return
      }
    }

    const patchData = {
      date: draft.date,
      time: draft.time,
      serviceTypeId: draft.serviceTypeId || '',
      eventTitle: draft.type === 'special' ? draft.eventTitle.trim() : undefined,
      group: draft.group,
      coverage: draft.type === 'regular' ? draft.coverage : undefined,
      location: draft.location || undefined,
      notes: draft.notes || undefined,
      docFormat: draft.docFormat,
      formation:
        draft.type === 'special' ? draft.formation : undefined,
      voiceCapacities: draft.voiceCapacities,
      assignments: draft.assignments,
      schedules: draft.schedules,
      dutyRoles: draft.dutyRoles,
      destinadoName: draft.destinadoName.trim() || undefined,
    }

    let savedId = existing ? existing.id : null
    if (existing) {
      updateSuguan(existing.id, patchData)
      toast.success('Suguan saved.')
    } else {
      const created = createSuguan({
        date: draft.date,
        time: draft.time,
        serviceTypeId: draft.serviceTypeId || '',
        location: draft.location || undefined,
        notes: draft.notes || undefined,
        type: draft.type === 'special' ? 'special' : 'regular',
        eventTitle: draft.type === 'special' ? draft.eventTitle.trim() : undefined,
        group: draft.group,
        docFormat: draft.docFormat,
        coverage: draft.type === 'regular' ? draft.coverage ?? undefined : undefined,
        events: draft.type === 'regular' ? draft.events : [],
        destinadoName: draft.destinadoName.trim() || undefined,
      })
      savedId = created.id
      updateSuguan(created.id, {
        formation: draft.type === 'special' ? draft.formation : undefined,
        voiceCapacities: draft.voiceCapacities,
        assignments: draft.assignments,
        schedules: draft.schedules,
        dutyRoles: draft.dutyRoles,
      })
      toast.success('Suguan saved.')
    }
    if (savedId) openSuguanDetail(savedId)
  }

  const cancel = () => {
    navigate('dashboard')
  }

  const titleLabel =
    step === 0
      ? 'Suguan Creator'
      : draft.type === 'special'
        ? 'Special Occasion Suguan'
        : 'Regular Worship Service Suguan'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={existing ? 'Edit Suguan' : titleLabel}
        description="Create and schedule a complete Suguan step by step."
        actions={
          <Button variant="ghost" onClick={cancel}>
            <X className="size-4" />
            Cancel
          </Button>
        }
      />

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((title, i) => {
          const clickable = i <= maxReachable
          const isPast = i < step
          return (
            <button
              key={title}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setStep(i)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : clickable
                    ? 'text-primary hover:bg-accent'
                    : 'cursor-not-allowed text-muted-foreground',
              )}
            >
              {isPast ? (
                <Check className="size-4" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full border text-xs">
                  {i + 1}
                </span>
              )}
              {title}
            </button>
          )
        })}
      </div>

      {step === 0 && (
        <ModeSelectStep
          value={draft.type}
          onSelect={(type) => {
            patch({ type })
            setStep((s) => Math.min(1, s + 1))
          }}
        />
      )}

      {step === 1 && (
        <DocumentSetupStep
          value={draft.docFormat}
          onChange={(f) => patch({ docFormat: f })}
        />
      )}

      {step === 2 && draft.type === 'special' && (
        <Card>
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="eventTitle">Event Name</Label>
                  <Input
                    id="eventTitle"
                    value={draft.eventTitle}
                    onChange={(e) => patch({ eventTitle: e.target.value })}
                    placeholder="e.g. 50th Anniversary, District Event"
                  />
                </div>
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
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Group</Label>
                  <Select
                    value={draft.group}
                    onValueChange={(v) => patch({ group: v as SuguanGroup })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="babae">Babae</SelectItem>
                      <SelectItem value="lalaki">Lalaki</SelectItem>
                      <SelectItem value="mixed">Mixed (Babae & Lalaki)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">Venue / Location</Label>
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
                  placeholder="Optional notes for this event"
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && draft.type === 'regular' && (
        <CoverageStep draft={draft} patch={patch} />
      )}

      {step === 3 && draft.type === 'regular' && (
        <WorshipScheduleStep draft={draft} patch={patch} />
      )}

      {step === 4 && draft.type === 'regular' && (
        <Card>
          <CardHeader>
            <CardTitle>Service Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
                  <Label>Group</Label>
                  <Select
                    value={draft.group}
                    onValueChange={(v) => patch({ group: v as SuguanGroup })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="babae">Babae</SelectItem>
                      <SelectItem value="lalaki">Lalaki</SelectItem>
                      <SelectItem value="mixed">Mixed (Babae & Lalaki)</SelectItem>
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

      {step === 3 && draft.type === 'special' && (
        <VoiceAssignmentsStep
          draft={draft}
          patch={patch}
          members={members}
          includeDutyRoles
        />
      )}

      {step === 5 && draft.type === 'regular' && (
        <ScheduleAssignmentsStep draft={draft} patch={patch} members={members} />
      )}

      {step === 5 && draft.type === 'special' && (
        <KoroMakerStep draft={draft} patch={patch} members={members} />
      )}

      {step === 6 && <ReviewStep draft={draft} />}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          {step !== steps.length - 1 && !canGoNext && (
            <p className="text-xs text-muted-foreground">
              Complete the required fields for this step to continue.
            </p>
          )}
          {step === steps.length - 1 ? (
            <Button onClick={handleSave}>
              <Check className="size-4" />
              Save Suguan
            </Button>
          ) : (
            <Button
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
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