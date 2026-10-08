/**
 * Pure Suguan date planning.
 *
 * Everything here is a deterministic function of `YYYY-MM-DD` calendar keys and
 * the configured worship schedule. There is no `Date.now()`, no store access and
 * no id generation, so the results are identical on every device and in every
 * process timezone. `suguanUtils` wraps these to attach ids.
 *
 * A Pagtupad is not a single day. The choir serves on every day of its worship
 * block — midweek is Wednesday *and* Thursday, weekend is Saturday *and* Sunday
 * — so suggestions are planned as a `{ start, end }` range and never as one day.
 */

// Explicit `.ts` extensions keep this module loadable by plain Node (for tests)
// as well as by the Vite bundler.
import { addDays, firstDateKey, isDateKey, todayPHT, weekdayOf } from './phDate.ts'
import {
  ALL_WORSHIP_SCHEDULES,
  DEFAULT_SCHEDULE_CATEGORIES,
  allSchedulesOf,
  worshipWeekdays,
  type WorshipSchedule,
  type WorshipScheduleCategories,
} from '../core/constants/worshipSchedules.ts'
import type { SuguanCoverage, SuguanEventType } from '../core/types/suguan.ts'

export type PlannedEvent = { type: SuguanEventType; date: string; endDate?: string }

/** A consecutive run of worship days, e.g. Wednesday through Thursday. */
export type WorshipBlock = {
  /** First day of the block, inclusive. */
  start: string
  /** Last day of the block, inclusive. Equal to `start` for a single-day block. */
  end: string
  /** Weekday indexes covered, in order. */
  days: number[]
}

/** Longest run of consecutive configured worship days to look ahead. */
const LOOKAHEAD_DAYS = 21

/** `weekdayOf` indexes, named to keep the routing rule readable. */
const SUNDAY = 0
const MONDAY = 1
const TUESDAY = 2
const WEDNESDAY = 3
const THURSDAY = 4
const FRIDAY = 5
const SATURDAY = 6

/** Shifts a calendar key, passing invalid input straight through. */
function shiftKey(date: string, days: number): string {
  return isDateKey(date) ? addDays(date, days) : date
}

/**
 * The worship block that begins at `candidate`, growing across every
 * consecutive configured worship day after it. Saturday and Sunday are both
 * worship days for a weekend choir, so this returns the Saturday–Sunday pair.
 *
 * @returns `null` when `candidate` itself is not a worship day.
 */
function blockFrom(candidate: string, allowed: Set<number>): WorshipBlock | null {
  if (!allowed.has(weekdayOf(candidate))) return null

  const days: number[] = [weekdayOf(candidate)]
  let end = candidate
  for (let step = 1; step <= LOOKAHEAD_DAYS; step += 1) {
    const next = shiftKey(candidate, step)
    if (!allowed.has(weekdayOf(next))) break
    days.push(weekdayOf(next))
    end = next
  }
  return { start: candidate, end, days }
}

/**
 * Is `candidate` the FIRST day of a worship run?
 *
 * A run start is a worship day whose predecessor is not a worship day. Saturday
 * is a run start; the Sunday after it is not, because Saturday precedes it.
 */
function isRunStart(candidate: string, allowed: Set<number>): boolean {
  if (!allowed.has(weekdayOf(candidate))) return false
  return !allowed.has(weekdayOf(shiftKey(candidate, -1)))
}

/**
 * The next worship *block* on or after `fromKey`. This is the **midweek** rule.
 *
 * Scans forward for the first configured worship day, then extends the match
 * across every consecutive configured day after it.
 *
 * The block may begin on `fromKey` itself, because a midweek choir can rehearse
 * on Wednesday morning and serve that same Wednesday–Thursday.
 *
 * @returns `null` only when `fromKey` is invalid or no worship days are configured.
 */
export function nextWorshipBlock(
  fromKey: string,
  weekdays: readonly number[],
): WorshipBlock | null {
  if (!isDateKey(fromKey) || weekdays.length === 0) return null
  const allowed = new Set(weekdays)

  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const block = blockFrom(shiftKey(fromKey, offset), allowed)
    if (block) return block
  }

  return null
}

/**
 * The Pagtupad block for a **weekend** choir. Deliberately a different rule
 * from `nextWorshipBlock`, because Pagsasanay is preparation that must land
 * *before* the service, and a weekend block is Sat+Sun of one weekend:
 *
 *   Saturday rehearsal  →  the FOLLOWING weekend's Saturday–Sunday
 *
 * Scanning from `fromKey` inclusive would put a Saturday rehearsal on its own
 * Saturday, i.e. the Pagtupad on the same weekend the choir just rehearsed for.
 * That is the bug this function exists to prevent.
 *
 * So this skips forward to the first day that both is a worship day and *starts*
 * a worship run, strictly after the rehearsal. For Saturday 2026-10-03 that is
 * Saturday 2026-10-10, which grows into 2026-10-11. Midweek deliberately does
 * not use this: there, a Wednesday rehearsal may legitimately serve the same
 * Wednesday–Thursday, which is why `nextWorshipBlock` keeps offset 0.
 */
export function nextWeekendWorshipBlock(
  fromKey: string,
  weekdays: readonly number[],
): WorshipBlock | null {
  if (!isDateKey(fromKey) || weekdays.length === 0) return null
  const allowed = new Set(weekdays)

  // Offset starts at 1: the rehearsal day itself is never its own Pagtupad.
  for (let offset = 1; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const candidate = shiftKey(fromKey, offset)
    if (!isRunStart(candidate, allowed)) continue
    const block = blockFrom(candidate, allowed)
    if (block) return block
  }

  return null
}

/**
 * Whether a schedule set is a *weekend-only* choir, i.e. it serves on Saturday
 * or Sunday and never midweek. Used to route between the two Pagtupad rules.
 *
 * "Weekend-only" is deliberate rather than "contains a weekend day". The
 * one-week template combines every schedule, so it contains Saturday *and*
 * Wednesday; it must keep the inclusive scan and must not be pulled onto the
 * weekend rule by this check.
 */
export function isWeekendOnlySchedule(weekdays: readonly number[]): boolean {
  const days = new Set(weekdays)
  const hasWeekendDay = days.has(SATURDAY) || days.has(SUNDAY)
  const hasMidweekDay = days.has(MONDAY) || days.has(TUESDAY) || days.has(WEDNESDAY) || days.has(THURSDAY) || days.has(FRIDAY)
  return hasWeekendDay && !hasMidweekDay
}

/**
 * The Pagtupad block that follows a rehearsal, routed to the correct rule for
 * the choir's schedule. Prefer this over calling `nextWorshipBlock` directly, so
 * the two rules cannot drift apart at different call sites.
 */
export function suggestBlockForSchedules(
  pagsasanayDate: string,
  weekdays: readonly number[],
): WorshipBlock | null {
  return isWeekendOnlySchedule(weekdays)
    ? nextWeekendWorshipBlock(pagsasanayDate, weekdays)
    : nextWorshipBlock(pagsasanayDate, weekdays)
}

/**
 * The nearest single worship-service date strictly AFTER `fromKey`.
 *
 * Prefer `nextWorshipBlock`; this exists for call sites that genuinely need one
 * day, such as resolving a schedule to a date for a preset.
 */
export function nextWorshipDateKey(
  fromKey: string,
  schedules: readonly WorshipSchedule[] = ALL_WORSHIP_SCHEDULES,
): string | null {
  if (!isDateKey(fromKey)) return null
  const weekdays = worshipWeekdays(schedules)
  for (let offset = 1; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const candidate = shiftKey(fromKey, offset)
    if (weekdays.includes(weekdayOf(candidate))) return candidate
  }
  return null
}

/**
 * Suggests the Pagtupad range that follows a chosen Pagsasanay date.
 *
 * Both the start and the end are suggestions: the user can override either one
 * for an unusual service week.
 */
export function suggestPagtupadBlock(
  pagsasanayDate: string,
  schedules: readonly WorshipSchedule[] = ALL_WORSHIP_SCHEDULES,
): WorshipBlock | null {
  const base = isDateKey(pagsasanayDate) ? pagsasanayDate : todayPHT()
  return suggestBlockForSchedules(base, worshipWeekdays(schedules))
}

/** Start date of the suggested Pagtupad range. */
export function suggestPagtupadDate(
  pagsasanayDate: string,
  schedules: readonly WorshipSchedule[] = ALL_WORSHIP_SCHEDULES,
): string {
  const base = isDateKey(pagsasanayDate) ? pagsasanayDate : todayPHT()
  return suggestPagtupadBlock(base, schedules)?.start ?? base
}

/**
 * The worship schedules that apply to a coverage template. Defaults to the
 * built-in times; pass editable categories to plan against what the admin
 * configured in Settings.
 */
export function schedulesForTemplate(
  template: SuguanCoverage['template'],
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): readonly WorshipSchedule[] {
  if (template === 'midweek-2w') return categories.midweek
  if (template === 'weekend-2w') return categories.weekend
  return allSchedulesOf(categories)
}

/** The last date covered by a template, used for the "until ..." label. */
export function coverageLastDate(coverage: SuguanCoverage): string {
  return coverage.oneWeekDate ?? shiftKey(coverage.startDate, 8)
}

/** The four worship days the Organist Suguan covers, one per weekday. */
export type WorshipWeek = {
  wednesday: string
  thursday: string
  saturday: string
  sunday: string
}

/**
 * The single worship week for the Organist Suguan: the calendar week
 * (Monday–Sunday) that contains the rehearsal date, expanded to its Wednesday,
 * Thursday, Saturday and Sunday. One Pagsasanay date therefore resolves the
 * whole week's services without any per-day selectors.
 *
 * @returns `null` when `rehearsalDate` is not a usable `YYYY-MM-DD` key.
 */
export function worshipWeekFromRehearsal(
  rehearsalDate: string,
): WorshipWeek | null {
  if (!isDateKey(rehearsalDate)) return null
  const monday = shiftKey(rehearsalDate, -((weekdayOf(rehearsalDate) + 6) % 7))
  return {
    wednesday: shiftKey(monday, 2),
    thursday: shiftKey(monday, 3),
    saturday: shiftKey(monday, 5),
    sunday: shiftKey(monday, 6),
  }
}

/** A configured worship schedule resolved to a concrete calendar date. */
export type DatedWorshipSchedule = {
  schedule: WorshipSchedule
  /** The date this schedule falls on within the detected worship week. */
  date: string
}

/**
 * Every configured worship schedule of the calendar week containing
 * `rehearsalDate`, resolved to its concrete date. One Pagsasanay date therefore
 * yields the whole week's service slots — Wednesday and Thursday midweek,
 * Saturday and Sunday weekend — ordered by date then time, e.g. for a training
 * on Saturday 2026-09-26:
 *
 *   MIYERKULES 7:00 PM -> 2026-09-23
 *   HUWEBES 6:00 AM    -> 2026-09-24
 *   HUWEBES 7:00 PM    -> 2026-09-24
 *   SABADO 6:00 PM     -> 2026-09-26
 *   LINGGO 6:00 AM     -> 2026-09-27
 *   LINGGO 10:00 AM    -> 2026-09-27
 *
 * @returns `[]` when `rehearsalDate` is blank or not a usable `YYYY-MM-DD` key.
 */
export function worshipWeekSchedules(
  rehearsalDate: string,
  schedules: readonly WorshipSchedule[] = ALL_WORSHIP_SCHEDULES,
): DatedWorshipSchedule[] {
  const week = worshipWeekFromRehearsal(rehearsalDate)
  if (!week) return []
  const dayToDate = new Map<number, string>([
    [WEDNESDAY, week.wednesday],
    [THURSDAY, week.thursday],
    [SATURDAY, week.saturday],
    [SUNDAY, week.sunday],
  ])
  return schedules.filter((schedule) =>
    dayToDate.has(schedule.weekday),
  )
    .map((schedule) => ({
      schedule,
      date: dayToDate.get(schedule.weekday) as string,
    }))
    // One slot per date keeps the configured order (a stable sort preserves it
    // for ties), so within a day the earlier service stays first.
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1))
}

/**
 * Resolves one Pagtupad range from an optional override pair and a suggestion.
 *
 * An explicit start always outranks the suggestion even when it is earlier or
 * later. The end falls back to the matching suggestion end, then to the start.
 */
function resolveService(
  startOverride: string | undefined,
  endOverride: string | undefined,
  suggestion: WorshipBlock | null,
  fallback: string,
): { start: string; end: string } {
  if (isDateKey(startOverride)) {
    return {
      start: startOverride,
      end: isDateKey(endOverride) ? endOverride : startOverride,
    }
  }
  if (suggestion) {
    return {
      start: suggestion.start,
      end: isDateKey(endOverride) ? endOverride : suggestion.end,
    }
  }
  return { start: fallback, end: isDateKey(endOverride) ? endOverride : fallback }
}

/**
 * Builds the Pagsasanay / Pagtupad entries for a coverage selection.
 *
 * The Pagsasanay (rehearsal) date is always preserved exactly as entered. Each
 * Pagtupad is a *suggested* range covering every worship day in the block that
 * follows, and the `pagtupadStartOverride` / `pagtupadEndOverride` fields let the
 * user pin an unusual service week instead.
 */
export function planEventsFromCoverage(
  coverage: SuguanCoverage,
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): PlannedEvent[] {
  const weekdays = worshipWeekdays(schedulesForTemplate(coverage.template, categories))

  if (coverage.template === 'midweek-2w' || coverage.template === 'weekend-2w') {
    // Nothing is planned until the user picks a Pagsasanay date. This
    // deliberately does NOT fall back to `todayPHT()`: a new Suguan starts
    // blank, and inferring a date from the clock would print one the user never
    // chose. Callers treat an empty result as "still needs a date".
    if (!isDateKey(coverage.startDate)) return []
    const start = coverage.startDate

    // Two rehearsal/Pagtupad pairs, one week apart. `start` is the Pagsasanay
    // date, kept exactly as the user entered it; each Pagtupad covers the whole
    // worship block unless the user overrode it.
    const week1Rehearsal = start
    const week2Rehearsal = shiftKey(start, 7)

    const overridden = isDateKey(coverage.pagtupadStartOverride)
    const week1Service = resolveService(
      coverage.pagtupadStartOverride,
      coverage.pagtupadEndOverride,
      suggestBlockForSchedules(week1Rehearsal, weekdays),
      week1Rehearsal,
    )
    // With a pinned first week, the second week follows it seven days later.
    const week2Service = overridden
      ? {
          start: shiftKey(week1Service.start, 7),
          end: shiftKey(week1Service.end, 7),
        }
      : resolveService(
          undefined,
          undefined,
          suggestBlockForSchedules(week2Rehearsal, weekdays),
          week2Rehearsal,
        )

    return [
      { type: 'pagsasanay', date: week1Rehearsal },
      { type: 'pagtupad', date: week1Service.start, endDate: week1Service.end },
      { type: 'pagsasanay', date: week2Rehearsal },
      { type: 'pagtupad', date: week2Service.start, endDate: week2Service.end },
    ]
  }

  // One-week template: the user picks one Pagsasanay (rehearsal) date and the
  // whole worship week around it — Wednesday, Thursday, Saturday, Sunday — is
  // covered. The training date is stored exactly as entered (in `startDate`,
  // mirrored in `oneWeekPagsasanayDate`), and the Pagtupad is suggested as the
  // full detected week. `oneWeekPagtupadDate` / `oneWeekPagtupadEndDate` still
  // let an unusual service week be pinned by hand.
  const pagsasanay = firstDateKey(
    isDateKey(coverage.startDate) ? coverage.startDate : '',
    coverage.oneWeekPagsasanayDate,
    coverage.oneWeekDate,
  )
  if (!isDateKey(pagsasanay)) return []
  const week = worshipWeekFromRehearsal(pagsasanay)
  const service = resolveService(
    coverage.oneWeekPagtupadDate,
    coverage.oneWeekPagtupadEndDate,
    week
      ? {
          start: week.wednesday,
          end: week.sunday,
          days: worshipWeekdays(schedulesForTemplate('one-week', categories)),
        }
      : null,
    pagsasanay,
  )

  return [
    { type: 'pagsasanay', date: pagsasanay },
    { type: 'pagtupad', date: service.start, endDate: service.end },
  ]
}
