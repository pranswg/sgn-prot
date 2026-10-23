import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarRange,
  Check,
  FileText,
  Music,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DisclosureSection } from '@/components/DisclosureSection'
import { FieldCard, FieldCardGroup } from '@/components/FieldCard'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  allSchedulesOf,
  worshipDayName,
} from '@/core/constants/worshipSchedules'
import {
  assignmentsFromSchedules,
  formatEventDate,
  generateEventsFromCoverage,
  schedulesForTemplate,
  suggestPagtupadBlock,
  worshipWeekSchedules,
} from '@/lib/suguanUtils'
import {
  firstDateKey,
  formatDateKeyNumeric,
  isDateKey,
  laterDateKey,
} from '@/lib/phDate'
import { useWorshipScheduleCategories } from '@/store/worshipScheduleStore'
import type {
  SuguanCoverage,
  SuguanCoverageTemplate,
  SuguanGroup,
} from '@/core/types/suguan'
import { DocumentSetupStep } from './DocumentSetupStep'
import { weekScheduleSections, type SuguanDraft } from './builderState'

interface CoverageStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
}

/**
 * The three coverages, named for the block of services they cover. What that
 * block actually holds is not written here: the row under the choices reads the
 * configured schedules, so a time the admin changed in Settings shows up as it
 * is, and nothing has to be re-typed in this file.
 */
const COVERAGES: {
  id: SuguanCoverageTemplate
  label: string
  meta: string
}[] = [
  { id: 'midweek-2w', label: 'Midweek', meta: '2 weeks' },
  { id: 'weekend-2w', label: 'Weekend', meta: '2 weeks' },
  { id: 'one-week', label: 'One week', meta: '1 week' },
]

const CHOIRS: { value: SuguanGroup; label: string; meta: string }[] = [
  { value: 'babae', label: 'Babae', meta: "Women's Choir" },
  { value: 'lalaki', label: 'Lalaki', meta: "Men's Choir" },
  { value: 'mixed', label: 'Mixed', meta: 'Both choirs' },
]

/** One choice in a segmented row: the name, and what picking it means. */
function ChoiceButton({
  active,
  onClick,
  label,
  meta,
}: {
  active: boolean
  onClick: () => void
  label: string
  meta?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:bg-accent/50',
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      {meta && (
        <span className="text-[11px] text-muted-foreground">{meta}</span>
      )}
    </button>
  )
}

/**
 * Step 1 of the Choir Suguan builder: the service, the coverage, the
 * Pagsasanay/Pagtupad dates, the choir, and the document setup.
 *
 * The whole step is one `FieldCardGroup` plus one `DisclosureSection`, so the
 * fields are not nested in a second card and a phone gets one column of choices
 * instead of a page of prose. Nothing here explains what a choice *is*: the row
 * under the coverage reads back the schedules it covers, and the printed
 * Pagsasanay/Pagtupad columns appear as chips under the dates they come from.
 */
export function CoverageStep({ draft, patch }: CoverageStepProps) {
  const fallbackCoverage = useMemo<SuguanCoverage>(
    () => ({ template: 'midweek-2w', startDate: '' }),
    [],
  )
  const coverage = draft.coverage ?? fallbackCoverage
  const scheduleCategories = useWorshipScheduleCategories()

  /** Document setup stays folded, as it does on the Extra Occasion screens. */
  const [documentSetupOpen, setDocumentSetupOpen] = useState(false)

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

  /**
   * What the chosen coverage covers, in one line: the configured schedules of a
   * two-week template (day and time, so an admin's edited time is right), or for
   * One Week the worship days, since the exact week follows the date.
   */
  const coverageDays = useMemo(() => {
    if (coverage.template === 'one-week') {
      return Array.from(
        new Set(
          allSchedulesOf(scheduleCategories).map((schedule) =>
            worshipDayName(schedule.weekday),
          ),
        ),
      ).join(', ')
    }
    return schedulesForTemplate(coverage.template, scheduleCategories)
      .map((schedule) => `${worshipDayName(schedule.weekday)} ${schedule.scheduleTime}`)
      .join(' · ')
  }, [coverage.template, scheduleCategories])

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

  const coverageField = (
    <FieldCard icon={CalendarRange} label="Coverage" tone="violet">
      <div className="grid grid-cols-3 gap-2">
        {COVERAGES.map((option) => (
          <ChoiceButton
            key={option.id}
            active={coverage.template === option.id}
            onClick={() => selectTemplate(option.id)}
            label={option.label}
            meta={option.meta}
          />
        ))}
      </div>
      {coverageDays && (
        <p className="text-xs text-muted-foreground">{coverageDays}</p>
      )}
    </FieldCard>
  )

  /** The printed Pagsasanay/Pagtupad columns, as the sheet will word them. */
  const printedColumns = events.length > 0 && (
    <div className="flex flex-col gap-2">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Printed columns
      </p>
      <div className="flex flex-wrap gap-1.5">
        {events.map((event) => (
          <span
            key={event.id}
            className={cn(
              'inline-flex flex-wrap items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              event.type === 'pagsasanay'
                ? 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200',
            )}
          >
            {event.type === 'pagsasanay' ? 'Pagsasanay' : 'Pagtupad'}
            <span className="font-normal opacity-80">
              {formatEventDate(event)}
            </span>
          </span>
        ))}
      </div>
    </div>
  )

  const pagsasanayDateInput = (
    value: string,
    onChange: (next: string) => void,
    id: string,
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        Pagsasanay date
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )

  const datesField = (
    <FieldCard
      icon={CalendarDays}
      label="Pagsasanay & Pagtupad"
      required
      tone="amber"
    >
      {coverage.template === 'one-week' ? (
        <div className="flex flex-col gap-3">
          {pagsasanayDateInput(
            oneWeekTrainingDate,
            applyOneWeekTrainingDate,
            'cw-ow-psd',
          )}
          {detectedWeek.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Detected week
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {detectedWeek.map(({ schedule, date }) => (
                  <div
                    key={`${schedule.id}-${date}`}
                    className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1.5"
                  >
                    <Check
                      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                      {worshipDayName(schedule.weekday)} · {schedule.scheduleTime}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatDateKeyNumeric(date)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {printedColumns}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,1fr)]">
            {pagsasanayDateInput(
              coverage.startDate,
              (startDate) => applyCoverage({ ...coverage, startDate }),
              'cw-start',
            )}
            {/* Side by side on a phone, where a third stacked date would cost a
                screen row; `contents` hands them to the parent grid from sm up. */}
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="cw-ptd-2w-start"
                  className="text-xs font-medium text-muted-foreground"
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
                      pagtupadStartOverride: e.target.value || undefined,
                    })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="cw-ptd-2w-end"
                  className="text-xs font-medium text-muted-foreground"
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
          </div>

          {/* The disabled Pagtupad inputs are the only thing that needs saying
              here, and only until the date they follow exists. */}
          {!hasPagsasanay && (
            <p className="text-xs text-muted-foreground">
              Pagtupad dates are suggested from the Pagsasanay date.
            </p>
          )}
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
                {suggestedService.days.map((d) => worshipDayName(d)).join(' & ')} (
                {formatDateKeyNumeric(suggestedService.start)}
                {suggestedService.end !== suggestedService.start &&
                  `–${formatDateKeyNumeric(suggestedService.end)}`}
                )
              </Button>
            )}
          {printedColumns}
        </div>
      )}
    </FieldCard>
  )

  const choirField = (
    <FieldCard icon={Music} label="Choir" required tone="rose">
      <div className="grid grid-cols-3 gap-2">
        {CHOIRS.map((option) => (
          <ChoiceButton
            key={option.value}
            active={draft.group === option.value}
            onClick={() => patch({ group: option.value })}
            label={option.label}
            meta={option.meta}
          />
        ))}
      </div>
    </FieldCard>
  )

  return (
    <div className="flex flex-col gap-4">
      <FieldCardGroup>
        {coverageField}
        {datesField}
        {choirField}
      </FieldCardGroup>

      <DisclosureSection
        open={documentSetupOpen}
        onToggle={() => setDocumentSetupOpen((open) => !open)}
        icon={FileText}
        title="Document setup"
      >
        <div className="p-4">
          <DocumentSetupStep
            value={draft.docFormat}
            onChange={(docFormat) => patch({ docFormat })}
            embedded
          />
        </div>
      </DisclosureSection>
    </div>
  )
}
