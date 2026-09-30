import { useMemo } from 'react'
import { CalendarDays, Sparkles, CalendarRange, Check } from 'lucide-react'
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
import {
  formatEventDate,
  generateEventsFromCoverage,
  schedulesForTemplate,
  suggestPagtupadBlock,
  todayPHT,
} from '@/lib/suguanUtils'
import {
  WEEKDAY_LONG,
  formatDateKeyNumeric,
  isDateKey,
  laterDateKey,
} from '@/lib/phDate'
import { useSettingsStore } from '@/store/settingsStore'
import type {
  SuguanCoverage,
  SuguanCoverageTemplate,
  SuguanGroup,
  SuguanType,
} from '@/core/types/suguan'
import type { SuguanDraft } from './builderState'

interface CoverageStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
}

const TYPES: {
  id: SuguanType
  title: string
  description: string
  icon: typeof CalendarDays
}[] = [
  {
    id: 'regular',
    title: 'Regular Worship Service',
    description:
      'Weekly service with Pagsasanay and Pagtupad columns and multiple worship schedules.',
    icon: CalendarDays,
  },
  {
    id: 'special',
    title: 'Special Occasion',
    description:
      'Anniversaries, district events, and choir presentations with a Koro formation.',
    icon: Sparkles,
  },
]

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
    dates: 'You choose the exact dates',
    description: 'A single Pagsasanay and Pagtupad for one worship service.',
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
    () => ({ template: 'midweek-2w', startDate: todayPHT() }),
    [],
  )
  const coverage = draft.coverage ?? fallbackCoverage

  const events = useMemo(
    () => (draft.type === 'regular' ? generateEventsFromCoverage(coverage) : []),
    [coverage, draft.type],
  )

  /** The auto-suggested Pagtupad date for the currently entered Pagsasanay date. */
  const suggestedService = useMemo(
    () =>
      isDateKey(coverage.startDate)
        ? suggestPagtupadBlock(
            coverage.startDate,
            schedulesForTemplate(coverage.template),
          )
        : null,
    [coverage.startDate, coverage.template],
  )

  /** The first Pagtupad range actually in effect, including any manual override. */
  const currentPagtupad = events.find((e) => e.type === 'pagtupad')

  /**
   * Writes the coverage plus the derived `pagsasanayDate` / `pagtupadDate`
   * that the sheet and the Suguan Detail page read.
   *
   * The Pagsasanay date is stored exactly as the user entered it. The Pagtupad
   * range is only *suggested* — both of its dates stay editable so an unusual
   * service week can still be entered by hand.
   */
  const applyCoverage = (next: SuguanCoverage) => {
    const nextEvents = generateEventsFromCoverage(next)
    const pagsasanay = nextEvents.find((e) => e.type === 'pagsasanay')?.date
    const pagtupad = nextEvents.find((e) => e.type === 'pagtupad')?.date

    patch({
      coverage: next,
      events: nextEvents,
      date: laterDateKey(pagtupad, pagsasanay, next.startDate),
      ...(draft.type === 'regular' && pagsasanay
        ? { pagsasanayDate: pagsasanay }
        : {}),
      ...(draft.type === 'regular' && pagtupad ? { pagtupadDate: pagtupad } : {}),
    })
  }

  const selectTemplate = (template: SuguanCoverageTemplate) => {
    const today = todayPHT()
    if (template === 'one-week') {
      // The one-week template uses every configured worship day, so the
      // suggested Pagtupad is the full block (midweek Wed+Thu or Sat+Sun).
      const block = suggestPagtupadBlock(today, schedulesForTemplate(template))
      const next: SuguanCoverage = {
        template,
        startDate: today,
        oneWeekDate: today,
        oneWeekPagsasanayDate: today,
        oneWeekPagtupadDate: block?.start,
        oneWeekPagtupadEndDate: block?.end,
      }
      patch({
        coverage: next,
        events: generateEventsFromCoverage(next),
        date: today,
        time: draft.time,
        pagsasanayDate: draft.type === 'regular' ? today : '',
        pagtupadDate: draft.type === 'regular' ? (block?.start ?? '') : '',
      })
      return
    }
    // The rehearsal date is kept as-is. Switching template only changes which
    // worship block the Pagtupad range snaps to.
    const next: SuguanCoverage = {
      template,
      startDate: isDateKey(coverage.startDate) ? coverage.startDate : today,
    }
    const nextEvents = generateEventsFromCoverage(next)
    patch({
      coverage: next,
      events: nextEvents,
      date: next.startDate,
      time: template === 'midweek-2w' ? '19:00' : '18:00',
      pagsasanayDate: nextEvents.find((e) => e.type === 'pagsasanay')?.date ?? '',
      pagtupadDate: nextEvents.find((e) => e.type === 'pagtupad')?.date ?? '',
    })
  }

  const isSpecial = draft.type === 'special'

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <StepHeading
          title="1. Suguan type"
          hint="Regular services build a signature sheet. Special occasions also get a Koro formation."
        />
        <div className="grid gap-3 md:grid-cols-2">
          {TYPES.map((t) => (
            <SelectionCard
              key={t.id}
              active={draft.type === t.id}
              onClick={() => patch({ type: t.id })}
              title={t.title}
              description={t.description}
              icon={t.icon}
            />
          ))}
        </div>
      </section>

      {isSpecial ? (
        <section className="flex flex-col gap-3">
          <StepHeading
            title="2. Event details"
            hint="The event name is printed on the sheet title."
          />
          <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="eventTitle">Event name</Label>
              <Input
                id="eventTitle"
                value={draft.eventTitle}
                onChange={(e) => patch({ eventTitle: e.target.value })}
                placeholder="e.g. 50th Anniversary, District Event"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={draft.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </div>
          </div>
        </section>
      ) : (
        <>
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
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="cw-date" className="text-xs text-muted-foreground">
                    Worship date
                  </Label>
                  <Input
                    id="cw-date"
                    type="date"
                    value={coverage.oneWeekDate ?? ''}
                    onChange={(e) =>
                      applyCoverage({ ...coverage, oneWeekDate: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cw-psd" className="text-xs text-muted-foreground">
                    Pagsasanay date
                  </Label>
                  <Input
                    id="cw-psd"
                    type="date"
                    value={coverage.oneWeekPagsasanayDate ?? ''}
                    onChange={(e) =>
                      applyCoverage({
                        ...coverage,
                        oneWeekPagsasanayDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cw-ptd" className="text-xs text-muted-foreground">
                    Pagtupad start
                  </Label>
                  <Input
                    id="cw-ptd"
                    type="date"
                    value={coverage.oneWeekPagtupadDate ?? ''}
                    onChange={(e) =>
                      applyCoverage({
                        ...coverage,
                        oneWeekPagtupadDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cw-pte" className="text-xs text-muted-foreground">
                    Pagtupad end (optional)
                  </Label>
                  <Input
                    id="cw-pte"
                    type="date"
                    value={coverage.oneWeekPagtupadEndDate ?? ''}
                    onChange={(e) =>
                      applyCoverage({
                        ...coverage,
                        oneWeekPagtupadEndDate: e.target.value || undefined,
                      })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,260px)_1fr] md:items-end">
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="cw-start"
                    className="text-xs text-muted-foreground"
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
                        className="text-xs text-muted-foreground"
                      >
                        Pagtupad start
                      </Label>
                      <Input
                        id="cw-ptd-2w-start"
                        type="date"
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
                        className="text-xs text-muted-foreground"
                      >
                        Pagtupad end
                      </Label>
                      <Input
                        id="cw-ptd-2w-end"
                        type="date"
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
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs text-muted-foreground">
                      {suggestedService === null ? (
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
                            .join(' &amp; ')}{' '}
                          ({formatDateKeyNumeric(suggestedService.start)}
                          {suggestedService.end !== suggestedService.start &&
                            `–${formatDateKeyNumeric(suggestedService.end)}`}
                          )
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <StepHeading
              title="3. Service"
              hint="The service is used for the sheet title and file naming."
            />
            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
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
              <div className="grid gap-1.5">
                <Label htmlFor="serviceTime">Service time</Label>
                <Input
                  id="serviceTime"
                  type="time"
                  value={draft.time}
                  onChange={(e) => patch({ time: e.target.value })}
                />
              </div>
            </div>
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <StepHeading
          title={isSpecial ? '3. Choir' : '4. Choir'}
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

      {!isSpecial && events.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Generated signature columns
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
