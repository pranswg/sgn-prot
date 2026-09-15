import { useMemo } from 'react'
import { addDays, parseISO } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  formatEventDate,
  generateEventsFromCoverage,
  todayISO,
} from '@/lib/suguanUtils'
import type {
  SuguanCoverage,
  SuguanCoverageTemplate,
} from '@/core/types/suguan'
import type { SuguanDraft } from './SuguanBuilderPage'

interface CoverageStepProps {
  draft: SuguanDraft
  patch: (p: Partial<SuguanDraft>) => void
}

const TEMPLATES: {
  id: SuguanCoverageTemplate
  title: string
  dates: string
  desc: string
}[] = [
  {
    id: 'midweek-2w',
    title: '2-Week — Midweek',
    dates: 'Wed 7:00 PM · Thu 6:00 AM · Thu 7:00 PM',
    desc: 'Pagsasanay and Pagtupad for two consecutive weeks. Builds 4 signature columns.',
  },
  {
    id: 'weekend-2w',
    title: '2-Week — Weekend',
    dates: 'Sat 6:00 PM · Sun 6:00 AM · Sun 10:00 AM',
    desc: 'Pagsasanay and Pagtupad for two consecutive weeks. Builds 4 signature columns.',
  },
  {
    id: 'one-week',
    title: '1-Week — Custom',
    dates: 'You choose the exact dates',
    desc: 'A single Pagsasanay and Pagtupad for one worship service. Builds 2 signature columns.',
  },
]

function snapToWeekday(dateISO: string, weekday: number): string {
  const d = parseISO(dateISO)
  if (Number.isNaN(d.getTime())) return todayISO()
  const diff = (weekday - d.getDay() + 7) % 7
  return addDays(d, diff).toISOString().slice(0, 10)
}

const WEDNESDAY = 3
const SATURDAY = 6

function defaultCoverage(): SuguanCoverage {
  return { template: 'midweek-2w', startDate: snapToWeekday(todayISO(), WEDNESDAY) }
}

export function CoverageStep({ draft, patch }: CoverageStepProps) {
  const coverage = draft.coverage ?? defaultCoverage()

  const events = useMemo(() => generateEventsFromCoverage(coverage), [coverage])

  const apply = (c: SuguanCoverage) => {
    patch({
      coverage: c,
      events: generateEventsFromCoverage(c),
      date: c.oneWeekDate ?? c.startDate,
    })
  }

  const selectTemplate = (template: SuguanCoverageTemplate) => {
    if (template === 'one-week') {
      const today = todayISO()
      const next: SuguanCoverage = {
        template,
        startDate: today,
        oneWeekDate: today,
        oneWeekPagsasanayDate: today,
        oneWeekPagtupadDate: today,
      }
      patch({
        coverage: next,
        events: generateEventsFromCoverage(next),
        date: next.oneWeekDate,
        time: draft.time,
      })
      return
    }
    const weekday = template === 'midweek-2w' ? WEDNESDAY : SATURDAY
    const next: SuguanCoverage = {
      template,
      startDate: snapToWeekday(
        coverage.startDate || todayISO(),
        weekday,
      ),
    }
    patch({
      coverage: next,
      events: generateEventsFromCoverage(next),
      date: next.startDate,
      time: template === 'midweek-2w' ? '19:00' : '18:00',
    })
  }

  const handleStartDate = (value: string) => {
    const weekday = coverage.template === 'midweek-2w' ? WEDNESDAY : SATURDAY
    apply({ ...coverage, startDate: snapToWeekday(value, weekday) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suguan Coverage</CardTitle>
        <CardDescription>
          Choose how the Pagsasanay / Pagtupad signature columns are scheduled.
          Dates fill automatically from the first Pagsasanay date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {TEMPLATES.map((t) => {
            const active = coverage.template === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t.id)}
                className={cn(
                  'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'hover:bg-accent',
                )}
              >
                <span className="text-sm font-semibold">{t.title}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {t.dates}
                </span>
                <span className="text-xs text-muted-foreground">{t.desc}</span>
              </button>
            )
          })}
        </div>

        {coverage.template === 'one-week' ? (
          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cw-date" className="text-xs text-muted-foreground">
                Worship date
              </Label>
              <Input
                id="cw-date"
                type="date"
                value={coverage.oneWeekDate ?? ''}
                onChange={(e) =>
                  apply({ ...coverage, oneWeekDate: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="cw-psd"
                className="text-xs text-muted-foreground"
              >
                Pagsasanay date
              </Label>
              <Input
                id="cw-psd"
                type="date"
                value={coverage.oneWeekPagsasanayDate ?? ''}
                onChange={(e) =>
                  apply({ ...coverage, oneWeekPagsasanayDate: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="cw-ptd"
                className="text-xs text-muted-foreground"
              >
                Pagtupad start
              </Label>
              <Input
                id="cw-ptd"
                type="date"
                value={coverage.oneWeekPagtupadDate ?? ''}
                onChange={(e) =>
                  apply({ ...coverage, oneWeekPagtupadDate: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="cw-pte"
                className="text-xs text-muted-foreground"
              >
                Pagtupad end (optional)
              </Label>
              <Input
                id="cw-pte"
                type="date"
                value={coverage.oneWeekPagtupadEndDate ?? ''}
                onChange={(e) =>
                  apply({
                    ...coverage,
                    oneWeekPagtupadEndDate: e.target.value || undefined,
                  })
                }
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:max-w-56">
              <Label htmlFor="cw-start" className="text-xs text-muted-foreground">
                First Pagsasanay (Week 1)
              </Label>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  id="cw-start"
                  type="date"
                  value={coverage.startDate}
                  onChange={(e) => handleStartDate(e.target.value)}
                />
              </div>
            </div>
            <p className="flex items-center self-end text-xs text-muted-foreground">
              {coverage.template === 'midweek-2w'
                ? 'Automatically placed on a Wednesday. The second week and the Pagtupad (Thursday) dates are derived from it.'
                : 'Automatically placed on a Saturday. The second week and the Pagtupad (Sunday) dates are derived from it.'}
            </p>
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Generated signature columns
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((e, i) => (
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
                {i % 2 === 1 && coverage.template !== 'one-week' && (
                  <p className="text-[10px] text-muted-foreground/70">
                    {coverage.template === 'midweek-2w'
                      ? 'Thu 6:00 AM & 7:00 PM'
                      : 'Sun 6:00 AM & 10:00 AM'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}