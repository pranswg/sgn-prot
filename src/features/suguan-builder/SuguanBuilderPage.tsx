import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  Eye,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  UserRound,
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

const STEP_ICONS = [CalendarDays, CalendarClock, UserRound, Eye]

export function SuguanBuilderPage() {
  const navigate = useNavStore((s) => s.navigate)
  const openSuguanDetail = useNavStore((s) => s.openSuguanDetail)
  const startNewSuguan = useNavStore((s) => s.startNewSuguan)
  const dismissNewSuguan = useNavStore((s) => s.dismissNewSuguan)
  const clearBuilderReturnPage = useNavStore((s) => s.clearBuilderReturnPage)
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
  const [step, setStep] = useState(
    existing ? BUILDER_STEPS.length - 1 : 0,
  )
  const [draft, setDraft] = useState<SuguanDraft>(() =>
    existing ? createDraftFromSuguan(existing, voices) : createEmptyDraft(voices),
  )
  const [startOpen, setStartOpen] = useState(!existing)

  if (loadedKey !== initialKey) {
    setLoadedKey(initialKey)
    setDraft(
      existing ? createDraftFromSuguan(existing, voices) : createEmptyDraft(voices),
    )
    setStep(existing ? BUILDER_STEPS.length - 1 : 0)
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
      group: draft.group,
      docFormat: draft.docFormat,
      coverage: draft.coverage,
      events: draft.events,
      pagsasanayDate: draft.pagsasanayDate || undefined,
      pagtupadDate: draft.pagtupadDate || undefined,
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
      group: draft.group,
      docFormat: draft.docFormat,
      coverage: draft.coverage ?? undefined,
      events: draft.events,
pagsasanayDate: draft.pagsasanayDate || undefined,
      pagtupadDate: draft.pagtupadDate || undefined,
      copiedFromId: draft.copiedFromId || undefined,
      destinadoName: draft.destinadoName.trim() || undefined,
    })
    updateSuguan(created.id, {
      voiceCapacities: draft.voiceCapacities,
      assignments: draft.assignments,
      schedules: draft.schedules,
      dutyRoles: draft.dutyRoles,
    })
    toast.success('Suguan saved.')
    openSuguanDetail(created.id)
  }

  const title = existing ? 'Edit Suguan' : 'Worship Service Suguan'

  const subtitle = draft.date ? formatDate(draft.date) : 'New Suguan'

  return (
    <div className="flex flex-col gap-4 pb-24 xl:pb-0">
      {/* Page header */}
      <div className="flex flex-col gap-3.5 rounded-xl border border-border/70 bg-card p-4">
{/* Compact mobile header — schedules and assignments steps */}
        {(step === 1 || step === 2) && (
          <div className="-mx-4 -mt-4 border-b border-border/70 md:hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <Button
                variant="ghost"
                size="icon-sm"
                title="Back"
                aria-label="Back"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ArrowLeft className="size-4.5" />
              </Button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-sm font-semibold text-foreground">
                  Choir Suguan
                </p>
                <p className="truncate text-[0.6875rem] text-muted-foreground">
                  Suguan • INC Choir
                </p>
              </div>
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-navy-soft text-brand-navy ring-1 ring-inset ring-brand-navy/10"
              >
                <SlidersHorizontal className="size-4" />
              </span>
            </div>
            <p className="px-4 pb-3 text-center text-xs font-medium text-muted-foreground">
              Step {step + 1} of {BUILDER_STEPS.length} —{' '}
              {BUILDER_STEPS[step].title}
            </p>
          </div>
        )}

        <div
          className={cn(
            'flex flex-wrap items-start justify-between gap-3',
            (step === 1 || step === 2) && 'hidden md:flex',
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
<h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                Choir Suguan
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden xl:flex"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Badge variant="outline" className="tabular-nums">
              {draft.schedules.length > 0
                ? `${draft.schedules.length} schedule${draft.schedules.length !== 1 ? 's' : ''}`
                : 'No schedule'}
            </Badge>
            {!existing && !startOpen && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground xl:flex"
                onClick={startNewSuguan}
              >
                <RotateCcw className="size-4" />
                Start over
              </Button>
            )}
{!isLast && !stepComplete && (
              <p className="hidden text-xs text-muted-foreground xl:block">
                Complete the required fields for this step to continue.
              </p>
            )}
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

      </div>

      {/* Compact progress stepper */}
      <div className="sticky top-14 z-10 rounded-xl border border-border/70 bg-card px-2 py-3 shadow-[0_1px_2px_rgba(16,42,67,0.04)] sm:px-5">
        <ol className="flex items-start gap-0.5">
          {BUILDER_STEPS.map((s, i) => {
            const passed = i < step
            const isCurrent = i === step
            const reachable = i <= reach
            const StepIcon = STEP_ICONS[i]
            return (
              <Fragment key={s.id}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'mt-[18px] h-0.5 min-w-1.5 flex-1 rounded-full',
                      i <= step ? 'bg-brand-navy' : 'bg-border',
                    )}
                  />
                )}
                <li className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => reachable && setStep(i)}
                    title={s.description}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={cn(
                      'flex size-[38px] shrink-0 items-center justify-center rounded-full transition-all',
                      passed || isCurrent
                        ? 'bg-brand-navy text-white'
                        : 'bg-muted text-muted-foreground/70 hover:text-foreground',
                      isCurrent && 'ring-4 ring-brand-navy/15',
                      !reachable && 'cursor-not-allowed opacity-40',
                    )}
                  >
                      {passed ? (
                        <Check className="size-[18px]" />
                      ) : (
                        <StepIcon className="size-[18px]" />
                      )}
                  </button>
                  <span
                    className={cn(
                      'w-full truncate text-center text-xs font-medium leading-tight',
                      passed || isCurrent
                        ? 'text-brand-navy-deep dark:text-blue-300'
                        : 'text-muted-foreground',
                    )}
                  >
                    {s.short}
                  </span>
                </li>
              </Fragment>
            )
          })}
        </ol>
      </div>

      {/* Step body */}
      {step === 1 ? (
        <div className="min-w-0">
          <SchedulesStep draft={draft} patch={patch} />
        </div>
      ) : step === 2 ? (
        <div className="min-w-0">
          <AssignmentWorkspace
            draft={draft}
            patch={patch}
            members={members}
            editingId={editingId}
          />
        </div>
      ) : (
        <div className="min-w-0 rounded-xl border border-border/70 bg-card p-4">
          {step === 0 && (
            <div className="flex flex-col gap-6">
              <CoverageStep draft={draft} patch={patch} />
              <DocumentSetupStep
                value={draft.docFormat}
                onChange={(docFormat) => patch({ docFormat })}
              />
            </div>
          )}
          {step === 3 && (
            <PreviewStep
              draft={draft}
              onSave={handleSave}
              isExisting={Boolean(existing)}
            />
          )}
        </div>
      )}

{/* Primary action — bottom right on desktop; mobile uses the fixed bar */}
      <div className="hidden justify-end xl:flex">
        {isLast ? (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saveBlockers(draft).length > 0}
          >
            <Check className="size-4" />
            Save Suguan
          </Button>
        ) : (
          <Button size="sm" onClick={goNext} disabled={!stepComplete}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur xl:hidden">
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

      <StartModeDialog
        open={startOpen}
        onOpenChange={(next) => {
          // Dismissing means "never mind". Close the dialog, then put the user
          // back on the page they left, so Cancel and the backdrop behave the
          // same instead of dumping them on an empty builder. When there is no
          // remembered origin (a deliberate "start over" from inside the
          // builder) this just closes the dialog and leaves them here.
          setStartOpen(next)
          if (!next) dismissNewSuguan()
        }}
        suguan={suguanList}
        onStartNew={() => {
          setEditingId(null)
          setLoadedKey('__new__')
          setDraft(createEmptyDraft(voices))
          setStep(0)
          setStartOpen(false)
          clearBuilderReturnPage()
        }}
        onCopy={(source) => {
          setEditingId(null)
          setLoadedKey('__new__')
          setDraft(createCopyDraft(source, voices))
          setStep(0)
          setStartOpen(false)
          clearBuilderReturnPage()
          toast.success(`Copied "${source.date}".`)
        }}
      />
    </div>
  )
}

