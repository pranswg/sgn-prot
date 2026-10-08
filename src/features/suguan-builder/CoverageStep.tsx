import { useMemo } from 'react'
import { CalendarDays, CalendarRange, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { allSchedulesOf } from '@/core/constants/worshipSchedules'
import {
  assignmentsFromSchedules,
  formatEventDate,
  generateEventsFromCoverage,
  schedulesForTemplate,
  suggestPagtupadBlock,
  worshipWeekFromRehearsal,
  worshipWeekSchedules,
} from '@/lib/suguanUtils'
import {
  WEEKDAY_LONG,
  firstDateKey,
  formatDateKeyLongDate,
  formatDateKeyNumeric,
  isDateKey,
  laterDateKey,
} from '@/lib/phDate'
import { useSettingsStore } from '@/store/settingsStore'
import { useWorshipScheduleCategories } from '@/store/worshipScheduleStore'
import type {
  SuguanCoverage,
  SuguanCoverageTemplate,
  SuguanGroup,
} from '@/core/types/suguan'
import { weekScheduleSections, type SuguanDraft } from './builderState'

interface CoverageStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
}

const DURATIONS: {
  id: SuguanCoverageTemplate
  title: string
  dates: string
  description: string
  duration: string
}[] = [
  {
    id: 'midweek-2w',
    title: 'Two Week — Midweek',
    duration: '2 weeks',
    dates: 'Miyerkules 7:00 PM · Huwebes 6:00 AM · Huwebes 7:00 PM',
    description: 'Pagsasanay and Pagtupad for two consecutive weeks.',
  },
  {
    id: 'weekend-2w',
    title: 'Two Week — Weekend',
    duration: '2 weeks',
    dates: 'Sabado 6:00 PM · Linggo 6:00 AM · Linggo 10:00 AM',
    description: 'Pagsasanay and Pagtupad for two consecutive weeks.',
  },
  {
    id: 'one-week',
    title: 'One Week',
    duration: '1 week',
    dates: 'The whole detected week around one date',
    description:
      'One Pagsasanay date detects the full worship week — Wednesday, Thursday, Saturday and Sunday.',
  },
]

const GENDERS: { value: SuguanGroup; label: string; hint: string }[] = [
  { value: 'babae', label: 'Babae', hint: "Women's Choir" },
  { value: 'lalaki', label: 'Lalaki', hint: "Men's Choir" },
  { value: 'mixed', label: 'Mixed', hint: 'Both choirs' },
]

function SelectionCard({
  active,
  onClick,
  title,
  meta,
  description,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  meta?: string
  description: string
  icon?: typeof CalendarDays
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:bg-accent/50',
      )}
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-primary" />}
        <span className="text-sm font-semibold">{title}</span>
        {meta && (
          <Badge variant="outline" className="ml-auto shrink-0">
            {meta}
          </Badge>
        )}
        {!meta && active && (
          <Check className="ml-auto size-4 shrink-0 text-primary" />
        )}
      </span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}

export function CoverageStep({ draft, patch }: CoverageStepProps) {
  const allServiceTypes = useSettingsStore((s) => s.allServiceTypes)
  const fallbackCoverage = useMemo<SuguanCoverage>(
    () => ({ template: 'midweek-2w', startDate: '' }),
    [],
  )
  const coverage = draft.coverage ?? fallbackCoverage
  const scheduleCategories = useWorshipScheduleCategories()

  const events = useMemo(
    () => generateEventsFromCoverage(coverage, scheduleCategories),
    [coverage, scheduleCategories],
  )

  /** The auto-suggested Pagtupad date for the currently entered Pagsasanay date. */
  const suggestedService = useMemo(
    () =>
      isDateKey(coverage.startDate)
        ? suggestPagtupadBlock(
            coverage.startDate,
            schedulesForTemplate(coverage.template, scheduleCategories),
          )
        : null,
    [coverage.startDate, coverage.template, scheduleCategories],
  )

  /** The first Pagtupad range actually in effect, including any manual override. */
  const currentPagtupad = events.find((e) => e.type === 'pagtupad')

  /**
   * The Pagtupad range is derived from the Pagsasanay date, so its inputs stay
   * disabled until that date exists. Editing them earlier would have nothing to
   * attach the override to.
   */
  const hasPagsasanay = isDateKey(coverage.startDate)

  /**
   * The one-week template's training date is shared by all three spellings:
   * `startDate` (the canonical route) mirrors `oneWeekPagsasanayDate`, and
   * legacy records may live in `oneWeekDate`.
   */
  const oneWeekTrainingDate = useMemo(
    () =>
      firstDateKey(
        isDateKey(coverage.startDate) ? coverage.startDate : '',
        coverage.oneWeekPagsasanayDate,
        coverage.oneWeekDate,
      ),
    [coverage.startDate, coverage.oneWeekPagsasanayDate, coverage.oneWeekDate],
  )

  /** Every configured worship schedule of the detected week, with concrete dates. */
  const detectedWeek = useMemo(
    () =>
      worshipWeekSchedules(oneWeekTrainingDate, allSchedulesOf(scheduleCategories)),
    [oneWeekTrainingDate, scheduleCategories],
  )

  const weekRange = useMemo(
    () => worshipWeekFromRehearsal(oneWeekTrainingDate),
    [oneWeekTrainingDate],
  )

  /**
   * Writes the coverage plus the derived `pagsasanayDate` / `pagtupadDate`
   * that the sheet and the Suguan Detail page read.
   *
   * The Pagsasanay date is stored exactly as the user entered it. The Pagtupad
   * range is only *suggested* — both of its dates stay editable so an unusual
   * service week can still be entered by hand.
   */
  const applyCoverage = (next: SuguanCoverage) => {
    const nextEvents = generateEventsFromCoverage(next, scheduleCategories)
    const pagsasanay = nextEvents.find((e) => e.type === 'pagsasanay')?.date
    const pagtupad = nextEvents.find((e) => e.type === 'pagtupad')?.date

    patch({
      coverage: next,
      events: nextEvents,
      date: laterDateKey(pagtupad, pagsasanay, next.startDate),
      // Written unconditionally so clearing the Pagsasanay date also clears
      // the derived dates. Otherwise a stale `pagsasanayDate` would outlive
      // the coverage it came from.
      pagsasanayDate: pagsasanay ?? '',
      pagtupadDate: pagtupad ?? '',
    })
  }

  /**
   * The one-week training date is stored exactly as entered, mirrored in both
   * `startDate` (the shared route the sheet, save-blockers, copy and detail all
   * read) and `oneWeekPagsasanayDate`. Changing it regenerates the whole
   * detected week's schedules; assignments from a slot that survives the date
   * change (a midweek stays a midweek) are carried over.
   */
  const applyOneWeekTrainingDate = (value: string) => {
    if (value === oneWeekTrainingDate) return
    const next: SuguanCoverage = {
      ...coverage,
      startDate: value,
      oneWeekPagsasanayDate: value,
    }
    const nextSchedules = weekScheduleSections(
      next,
      draft.schedules,
      scheduleCategories,
    )
    const nextEvents = generateEventsFromCoverage(next, scheduleCategories)
    const pagsasanay = nextEvents.find((e) => e.type === 'pagsasanay')?.date
    const pagtupad = nextEvents.find((e) => e.type === 'pagtupad')?.date
    patch({
      coverage: next,
      events: nextEvents,
      date: laterDateKey(pagtupad, pagsasanay, next.startDate),
      pagsasanayDate: pagsasanay ?? '',
      pagtupadDate: pagtupad ?? '',
      schedules: nextSchedules,
      assignments: assignmentsFromSchedules(nextSchedules),
    })
  }

  const selectTemplate = (template: SuguanCoverageTemplate) => {
    if (template === 'one-week') {
      // A training date entered under Midweek carries over. The whole detected
      // week is auto-populated into the Schedules step immediately, keeping
      // any assignments by schedule key; when no date exists yet the week stays
      // empty until the user picks one.
      const trainingDate = firstDateKey(
        isDateKey(coverage.startDate) ? coverage.startDate : '',
        coverage.oneWeekPagsasanayDate,
        coverage.oneWeekDate,
      )
      const next: SuguanCoverage = {
        ...coverage,
        template,
        oneWeekPagsasanayDate: trainingDate,
        startDate: trainingDate,
      }
      const nextSchedules = weekScheduleSections(
        next,
        draft.schedules,
        scheduleCategories,
      )
      const nextEvents = generateEventsFromCoverage(next, scheduleCategories)
      const pagsasanay = nextEvents.find((e) => e.type === 'pagsasanay')?.date
      const pagtupad = nextEvents.find((e) => e.type === 'pagtupad')?.date
      patch({
        coverage: next,
        events: nextEvents,
        date: laterDateKey(pagtupad, pagsasanay, next.startDate),
        time: draft.time,
        pagsasanayDate: pagsasanay ?? '',
        pagtupadDate: pagtupad ?? '',
        schedules: nextSchedules,
        assignments: assignmentsFromSchedules(nextSchedules),
      })
      return
    }
    // The rehearsal date is kept exactly as entered, including when it is blank.
    // Switching template only changes which worship block the Pagtupad range
    // snaps to once a date exists.
    const next: SuguanCoverage = {
      template,
      startDate: isDateKey(coverage.startDate) ? coverage.startDate : '',
    }
    const nextEvents = generateEventsFromCoverage(next, scheduleCategories)
    patch({
      coverage: next,
      events: nextEvents,
      date: next.startDate,
      time: template === 'midweek-2w' ? '19:00' : '18:00',
      pagsasanayDate: nextEvents.find((e) => e.type === 'pagsasanay')?.date ?? '',
      pagtupadDate: nextEvents.find((e) => e.type === 'pagtupad')?.date ?? '',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <StepHeading
          title="1. Service"
          hint="The service is used for the sheet title and file naming."
        />
        <div className="grid gap-3 rounded-lg border p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="serviceType">Service type</Label>
            <Select
              value={draft.serviceTypeId}
              onValueChange={(v) => patch({ serviceTypeId: v })}
            >
              <SelectTrigger id="serviceType" className="w-full">
                <SelectValue placeholder="Select a service" />
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
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <StepHeading
          title="2. Duration & coverage"
          hint="Coverage decides the Pagsasanay and Pagtupad columns printed on the sheet."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {DURATIONS.map((t) => (
            <SelectionCard
              key={t.id}
              active={coverage.template === t.id}
              onClick={() => selectTemplate(t.id)}
              title={t.title}
              meta={t.duration}
              description={t.description}
            />
          ))}
        </div>

        {coverage.template === 'one-week' ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,240px)_1fr] md:items-center">
              <div className="grid gap-1.5">
                <Label htmlFor="cw-ow-psd" className="text-xs text-foreground">
                  Petsa ng Pagsasanay
                </Label>
                <div className="flex items-center gap-2">
                  <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    id="cw-ow-psd"
                    type="date"
                    value={oneWeekTrainingDate}
                    onChange={(e) => applyOneWeekTrainingDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {detectedWeek.length === 0 ? (
                    <>
                      One Week automatically covers every worship day of the
                      calendar week around your Pagsasanay — Wednesday,
                      Thursday, Saturday and Sunday. Choose a date and the whole
                      week's schedules are added to the Schedules step.
                    </>
                  ) : (
                    <>
                      Pagsasanay on{' '}
                      <span className="font-medium text-foreground">
                        {formatDateKeyLongDate(oneWeekTrainingDate)}
                      </span>{' '}
                      detects the worship week{' '}
                      <span className="font-medium text-foreground">
                        {formatDateKeyNumeric(weekRange?.wednesday ?? '')}–
                        {formatDateKeyNumeric(weekRange?.sunday ?? '')}
                      </span>
                      . These {detectedWeek.length} schedules are added
                      automatically and stay editable in the Schedules step.
                    </>
                  )}
                </p>
              </div>
            </div>

            {detectedWeek.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {detectedWeek.map(({ schedule, date }) => (
                  <div
                    key={`${schedule.id}-${date}`}
                    className="flex items-start gap-2.5 rounded-lg border border-primary/15 bg-primary/[0.03] px-3 py-2.5"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <Check className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        Detected schedule
                      </span>
                      <span className="mt-0.5 block text-sm font-semibold text-foreground">
                        {WEEKDAY_LONG[schedule.weekday]}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatDateKeyLongDate(date)} · {schedule.scheduleTime}
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      Detected automatically
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {!hasPagsasanay ? (
                'Choose a Pagsasanay date to see the Pagtupad dates. Every date is kept exactly as entered.'
              ) : suggestedService === null ? (
                'No worship days are configured. Add a worship schedule in Settings to have the Pagtupad dates suggested automatically.'
              ) : (
                <>
                  Pagtupad covers{' '}
                  <span className="font-medium text-foreground">
                    {suggestedService.days
                      .map((d) => WEEKDAY_LONG[d])
                      .join(' and ')}
                  </span>{' '}
                  ({formatDateKeyNumeric(suggestedService.start)}
                  {suggestedService.end !== suggestedService.start &&
                    `–${formatDateKeyNumeric(suggestedService.end)}`}
                  ). The Pagsasanay date is kept exactly as entered, and
                  every date stays editable.
                </>
              )}
            </p>

            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,260px)_1fr] md:items-end">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="cw-start"
                  className="text-xs text-foreground"
                >
                  Petsa ng Pagsasanay
                </Label>
                <div className="flex items-center gap-2">
                  <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
                  <Input
                    id="cw-start"
                    type="date"
                    value={coverage.startDate}
                    onChange={(e) =>
                      applyCoverage({
                        ...coverage,
                        startDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="cw-ptd-2w-start"
                      className="text-xs text-foreground"
                    >
                      Pagtupad start
                    </Label>
                    <Input
                      id="cw-ptd-2w-start"
                      type="date"
                      disabled={!hasPagsasanay}
                      value={currentPagtupad?.date ?? ''}
                      onChange={(e) =>
                        applyCoverage({
                          ...coverage,
                          pagtupadStartOverride:
                            e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="cw-ptd-2w-end"
                      className="text-xs text-foreground"
                    >
                      Pagtupad end
                    </Label>
                    <Input
                      id="cw-ptd-2w-end"
                      type="date"
                      disabled={!hasPagsasanay}
                      value={currentPagtupad?.endDate ?? ''}
                      onChange={(e) =>
                        applyCoverage({
                          ...coverage,
                          pagtupadEndOverride: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                </div>
                {suggestedService &&
                  (suggestedService.start !== currentPagtupad?.date ||
                    suggestedService.end !== currentPagtupad?.endDate) && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto justify-start p-0 text-xs"
                      onClick={() =>
                        applyCoverage({
                          ...coverage,
                          pagtupadStartOverride: undefined,
                          pagtupadEndOverride: undefined,
                        })
                      }
                    >
                      Use{' '}
                      {suggestedService.days
                        .map((d) => WEEKDAY_LONG[d])
                        .join(' & ')}{' '}
                      ({formatDateKeyNumeric(suggestedService.start)}
                      {suggestedService.end !== suggestedService.start &&
                        `–${formatDateKeyNumeric(suggestedService.end)}`}
                      )
                    </Button>
                  )}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <StepHeading
          title="3. Choir"
          hint="Only members of the selected choir can be assigned."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {GENDERS.map((g) => (
            <SelectionCard
              key={g.value}
              active={draft.group === g.value}
              onClick={() => patch({ group: g.value })}
              title={g.label}
              meta={g.hint}
              description={`Assign members from the ${g.hint.toLowerCase()}.`}
            />
          ))}
        </div>
      </section>

      {events.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Signature columns
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((e) => (
              <div
                key={e.id}
                className={cn(
                  'rounded-md border px-3 py-2',
                  e.type === 'pagsasanay'
                    ? 'border-amber-300/60 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30'
                    : 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30',
                )}
              >
                <p className="text-xs font-bold uppercase">
                  {e.type === 'pagsasanay' ? 'Pagsasanay' : 'Pagtupad'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatEventDate(e)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}