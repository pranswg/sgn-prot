import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Lock,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNavStore } from '@/store/navStore'
import { useSuguanStore } from '@/store/suguanStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useMemberStore } from '@/store/memberStore'
import type { Suguan } from '@/core/types/suguan'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { groupLabel } from '@/lib/suguanUtils'
import { CoverageStep } from './CoverageStep'
import { DocumentSetupStep } from './DocumentSetupStep'
import { SchedulesStep } from './SchedulesStep'
import { AssignmentWorkspace } from './AssignmentWorkspace'
import { PreviewStep } from './PreviewStep'
import { StartModeDialog } from './StartModeDialog'
import {
  BUILDER_STEPS,
  createCopyDraft,
  createDraftFromSuguan,
  createEmptyDraft,
  isStepComplete,
  maxReachableStep,
  saveBlockers,
  type SuguanDraft,
} from './builderState'

export type { SuguanDraft } from './builderState'

export function SuguanBuilderPage() {
  const navigate = useNavStore((s) => s.navigate)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const builderSuguanId = useNavStore((s) => s.builderSuguanId)
  const suguanList = useSuguanStore((s) => s.suguan)
  const createSuguan = useSuguanStore((s) => s.createSuguan)
  const updateSuguan = useSuguanStore((s) => s.updateSuguan)
  const allVoices = useSettingsStore((s) => s.allVoices)
  const voices = allVoices()
  const members = useMemberStore((s) => s.members)

  // `editingId` is what we will write back to. It starts as the store's target so
  // deep links still work, but choosing "start new" or copying detaches it so a
  // fresh draft can never overwrite the Suguan that was opened.
  const [editingId, setEditingId] = useState<string | null>(
    builderSuguanId ?? null,
  )

  const existing = useMemo<Suguan | null>(
    () => suguanList.find((s) => s.id === editingId) ?? null,
    [suguanList, editingId],
  )

  const initialKey = editingId ?? '__new__'
  const [loadedKey, setLoadedKey] = useState(initialKey)
  const [step, setStep] = useState(existing ? 4 : 0)
  const [draft, setDraft] = useState<SuguanDraft>(() =>
    existing ? createDraftFromSuguan(existing, voices) : createEmptyDraft(voices),
  )
  const [startOpen, setStartOpen] = useState(!existing)

  if (loadedKey !== initialKey) {
    setLoadedKey(initialKey)
    setDraft(
      existing ? createDraftFromSuguan(existing, voices) : createEmptyDraft(voices),
    )
    setStep(existing ? 4 : 0)
    setStartOpen(!existing)
  }

  const patch = (p: Partial<SuguanDraft>) =>
    setDraft((d) => ({ ...d, ...p }))

  const reach = maxReachableStep(draft)
  const isLast = step === BUILDER_STEPS.length - 1
  const stepComplete = isStepComplete(draft, step)

  const goNext = () => {
    if (!stepComplete) {
      toast.error('Finish the required fields in this step first.')
      return
    }
    setStep((s) => Math.min(BUILDER_STEPS.length - 1, s + 1))
  }

  const handleSave = () => {
    const blockers = saveBlockers(draft)
    if (blockers.length > 0) {
      toast.error(blockers[0])
      return
    }

    const payload = {
      date: draft.date,
      time: draft.time,
      serviceTypeId: draft.serviceTypeId || '',
      eventTitle: draft.type === 'special' ? draft.eventTitle.trim() : undefined,
      group: draft.group,
      docFormat: draft.docFormat,
      coverage: draft.type === 'regular' ? draft.coverage : undefined,
      events: draft.type === 'regular' ? draft.events : [],
      pagsasanayDate:
        draft.type === 'regular' && draft.pagsasanayDate
          ? draft.pagsasanayDate
          : undefined,
      pagtupadDate:
        draft.type === 'regular' && draft.pagtupadDate
          ? draft.pagtupadDate
          : undefined,
      formation: draft.type === 'special' ? draft.formation : undefined,
      voiceCapacities: draft.voiceCapacities,
      assignments: draft.assignments,
      schedules: draft.schedules,
      dutyRoles: draft.dutyRoles,
      destinadoName: draft.destinadoName.trim() || undefined,
    }

    if (existing) {
      updateSuguan(existing.id, payload)
      toast.success('Suguan updated.')
      openSuguanDetail(existing.id)
      return
    }

    const created = createSuguan({
      date: draft.date,
      time: draft.time,
      serviceTypeId: draft.serviceTypeId || '',
      type: draft.type,
      eventTitle: draft.type === 'special' ? draft.eventTitle.trim() : undefined,
      group: draft.group,
      docFormat: draft.docFormat,
      coverage: draft.type === 'regular' ? (draft.coverage ?? undefined) : undefined,
      events: draft.type === 'regular' ? draft.events : [],
      pagsasanayDate:
        draft.type === 'regular' && draft.pagsasanayDate
          ? draft.pagsasanayDate
          : undefined,
      pagtupadDate:
        draft.type === 'regular' && draft.pagtupadDate
          ? draft.pagtupadDate
          : undefined,
      destinadoName: draft.destinadoName.trim() || undefined,
    })
    updateSuguan(created.id, {
      formation: draft.type === 'special' ? draft.formation : undefined,
      voiceCapacities: draft.voiceCapacities,
      assignments: draft.assignments,
      schedules: draft.schedules,
      dutyRoles: draft.dutyRoles,
    })
    toast.success('Suguan saved.')
    openSuguanDetail(created.id)
  }

  const title =
    existing
      ? 'Edit Suguan'
      : draft.type === 'special'
        ? 'Special Occasion Suguan'
        : 'Worship Service Suguan'

  const subtitle =
    draft.type === 'special'
      ? draft.eventTitle.trim() || 'New special occasion'
      : draft.date
        ? formatDate(draft.date)
        : 'New Suguan'

  return (
    <div className="flex flex-col gap-4 pb-24 xl:pb-0">
      {/* Page header */}
      <div className="flex flex-col gap-3.5 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                Suguan Builder
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Create and manage your choir service schedules and assignments.
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="truncate font-medium text-foreground">
                  {title} · {subtitle}
                </span>
                <span>·</span>
                <span>{groupLabel(draft.group)}</span>
                <span>·</span>
                <span>
                  Step {step + 1} of {BUILDER_STEPS.length}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="tabular-nums">
              {draft.schedules.length > 0
                ? `${draft.schedules.length} schedule${draft.schedules.length !== 1 ? 's' : ''}`
                : draft.type === 'special'
                  ? 'Special occasion'
                  : 'No schedule'}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setStartOpen(true)}>
              <Plus className="size-4" />
              Start new / copy
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Close builder"
              onClick={() => navigate('dashboard')}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Stepper */}
        <ol className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
          {BUILDER_STEPS.map((s, i) => {
            const complete = isStepComplete(draft, i)
            const reachable = i <= reach
            const isCurrent = i === step
            return (
              <li key={s.id} className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => reachable && setStep(i)}
                  title={s.description}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    isCurrent
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : 'border-border/70 bg-background hover:border-brand-teal/50 hover:bg-brand-teal-soft/40',
                    !reachable && 'cursor-not-allowed opacity-50 hover:border-border/70 hover:bg-background',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold',
                      isCurrent
                        ? 'bg-white/15 text-white ring-1 ring-inset ring-white/25'
                        : complete
                          ? 'bg-brand-teal-soft text-brand-teal ring-1 ring-inset ring-brand-teal/25'
                          : 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
                    )}
                  >
                    {complete && !isCurrent ? (
                      <Check className="size-3.5" />
                    ) : !reachable ? (
                      <Lock className="size-3" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate text-[0.8125rem] font-semibold leading-tight',
                        isCurrent ? 'text-white' : 'text-foreground',
                      )}
                    >
                      {s.title}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 hidden truncate text-[0.625rem] leading-tight sm:block',
                        isCurrent ? 'text-white/65' : 'text-muted-foreground',
                      )}
                    >
                      {s.description}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Step body */}
      {step === 3 ? (
        <AssignmentWorkspace
          draft={draft}
          patch={patch}
          members={members}
          editingId={editingId}
        />
      ) : (
        <div
          className={cn(
            'min-w-0 rounded-xl border border-border/70 bg-card p-4',
            // Form-only step: keep the column readable instead of stretching
            // inputs across very wide monitors. Schedules and review are dense
            // tables and should use the full width.
            step === 0 && 'mx-auto w-full xl:max-w-5xl',
          )}
        >
          {step === 0 && <CoverageStep draft={draft} patch={patch} />}
          {step === 1 && (
            <DocumentSetupStep
              value={draft.docFormat}
              onChange={(docFormat) => patch({ docFormat })}
            />
          )}
          {step === 2 && <SchedulesStep draft={draft} patch={patch} />}
          {step === 4 && (
            <PreviewStep
              draft={draft}
              onSave={handleSave}
              isExisting={Boolean(existing)}
              editingId={editingId}
            />
          )}
        </div>
      )}

      {/* Bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur xl:hidden">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        {!existing && !startOpen && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Start over"
            aria-label="Start over"
            onClick={startNewSuguan}
          >
            <RotateCcw className="size-4" />
          </Button>
        )}
        {isLast ? (
          <Button className="flex-1" onClick={handleSave}>
            <Check className="size-4" />
            Save
          </Button>
        ) : (
          <Button className="flex-1" onClick={goNext} disabled={!stepComplete}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <div className="hidden items-center justify-between gap-3 xl:flex">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          {!existing && !startOpen && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={startNewSuguan}
            >
              <RotateCcw className="size-4" />
              Start over
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isLast && !stepComplete && (
            <p className="text-xs text-muted-foreground">
              Complete the required fields for this step to continue.
            </p>
          )}
          {isLast ? (
            <Button onClick={handleSave} disabled={saveBlockers(draft).length > 0}>
              <Check className="size-4" />
              Save Suguan
            </Button>
          ) : (
            <Button onClick={goNext} disabled={!stepComplete}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <StartModeDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        suguan={suguanList}
        onStartNew={() => {
          setEditingId(null)
          setLoadedKey('__new__')
          setDraft(createEmptyDraft(voices))
          setStep(0)
          setStartOpen(false)
        }}
        onCopy={(source) => {
          setEditingId(null)
          setLoadedKey('__new__')
          setDraft(createCopyDraft(source, voices))
          setStep(0)
          setStartOpen(false)
          toast.success(`Copied "${source.eventTitle || source.date}".`)
        }}
      />
    </div>
  )
}
