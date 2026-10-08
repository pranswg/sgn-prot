import type { WorshipScheduleKey } from '@/core/types/suguan'
import type { AssignmentPreset } from '@/store/assignmentPresetStore'

export interface WorshipSchedule {
  id: string
  scheduleDay: string
  /**
   * Day-of-week index for this schedule, `0` = Sunday ... `6` = Saturday.
   * Stored on the record so the date calculator reads the configuration
   * instead of re-deriving it from `scheduleDay` text at every call site.
   * See `weekdayIndexForLabel` for the Tagalog/English resolver.
   */
  weekday: number
  scheduleTime: string
  label: string
  presetHint: string
  /** True when a user added this schedule in Settings, false for a built-in. */
  custom?: boolean
}

export const WEEKDAY_OPTIONS = [
  { weekday: 0, name: 'Linggo', english: 'Sunday' },
  { weekday: 1, name: 'Lunes', english: 'Monday' },
  { weekday: 2, name: 'Martes', english: 'Tuesday' },
  { weekday: 3, name: 'Miyerkules', english: 'Wednesday' },
  { weekday: 4, name: 'Huwebes', english: 'Thursday' },
  { weekday: 5, name: 'Biyernes', english: 'Friday' },
  { weekday: 6, name: 'Sabado', english: 'Saturday' },
] as const

export function worshipDayName(weekday: number): string {
  return WEEKDAY_OPTIONS.find((d) => d.weekday === weekday)?.name ?? 'Worship Day'
}

export interface WorshipScheduleCategories {
  midweek: readonly WorshipSchedule[]
  weekend: readonly WorshipSchedule[]
}

export function allSchedulesOf(
  categories: WorshipScheduleCategories,
): readonly WorshipSchedule[] {
  return [...categories.midweek, ...categories.weekend]
}

export const WEEKEND_SCHEDULES: WorshipSchedule[] = [
  {
    id: 'sabado-6pm',
    scheduleDay: 'SABADO',
    weekday: 6,
    scheduleTime: '6:00 PM',
    label: 'SABADO, 6:00 PM',
    presetHint: 'Sabado 6:00 PM Group',
  },
  {
    id: 'linggo-6am',
    scheduleDay: 'LINGGO',
    weekday: 0,
    scheduleTime: '6:00 AM',
    label: 'LINGGO, 6:00 AM',
    presetHint: 'Linggo 6:00 AM Group',
  },
  {
    id: 'linggo-10am',
    scheduleDay: 'LINGGO',
    weekday: 0,
    scheduleTime: '10:00 AM',
    label: 'LINGGO, 10:00 AM',
    presetHint: 'Linggo 10:00 AM Group',
  },
]

export const MIDWEEK_SCHEDULES: WorshipSchedule[] = [
  {
    id: 'miyerkules-7pm',
    scheduleDay: 'MIYERKULES',
    weekday: 3,
    scheduleTime: '7:00 PM',
    label: 'MIYERKULES, 7:00 PM',
    presetHint: 'Miyerkules 7:00 PM Group',
  },
  {
    id: 'huwebes-6am',
    scheduleDay: 'HUWEBES',
    weekday: 4,
    scheduleTime: '6:00 AM',
    label: 'HUWEBES, 6:00 AM',
    presetHint: 'Huwebes 6:00 AM Group',
  },
  {
    id: 'huwebes-7pm',
    scheduleDay: 'HUWEBES',
    weekday: 4,
    scheduleTime: '7:00 PM',
    label: 'HUWEBES, 7:00 PM',
    presetHint: 'Huwebes 7:00 PM Group',
  },
]

export const ALL_WORSHIP_SCHEDULES: WorshipSchedule[] = [
  ...WEEKEND_SCHEDULES,
  ...MIDWEEK_SCHEDULES,
]

export const DEFAULT_SCHEDULE_CATEGORIES: WorshipScheduleCategories = {
  midweek: MIDWEEK_SCHEDULES,
  weekend: WEEKEND_SCHEDULES,
}

export const WORSHIP_SCHEDULE_MAP = Object.fromEntries(
  ALL_WORSHIP_SCHEDULES.map((s) => [s.id, s]),
) as Record<string, WorshipSchedule>

const DAY_ALIASES: Record<string, string[]> = {
  sabado: ['sabado', 'saturday', 'sat'],
  linggo: ['linggo', 'sunday', 'sun'],
  miyerkules: ['miyerkules', 'wednesday', 'wed'],
  huwebes: ['huwebes', 'thursday', 'thu'],
}

/**
 * Canonical weekday index for a worship-day label, accepting the Tagalog
 * (`'SABADO'`) or English (`'Saturday'`, `'Sat'`) spelling.
 *
 * @returns `0`–`6`, or `null` for free-form/custom labels like `''`.
 */
export function weekdayIndexForLabel(label: string | undefined | null): number | null {
  if (!label) return null
  const key = label.trim().toLowerCase()
  if (!key) return null

  for (const [day, aliases] of Object.entries(DAY_ALIASES)) {
    if (aliases.includes(key)) {
      const schedule = ALL_WORSHIP_SCHEDULES.find(
        (s) => s.scheduleDay.toLowerCase() === day,
      )
      if (schedule) return schedule.weekday
    }
  }

  const english = Object.entries({
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }).find(([name]) => name.startsWith(key) || key.startsWith(name))
  return english ? english[1] : null
}

/**
 * The set of weekdays on which this choir holds worship services, derived from
 * the schedule configuration rather than hardcoded day numbers.
 *
 * Defaults to every configured schedule, which yields Wednesday, Thursday,
 * Saturday and Sunday. Pass a narrower list to scope the calculation, e.g.
 * `worshipWeekdays(MIDWEEK_SCHEDULES)` for a midweek-only choir.
 */
export function worshipWeekdays(
  schedules: readonly WorshipSchedule[] = ALL_WORSHIP_SCHEDULES,
): number[] {
  const days = new Set<number>()
  for (const schedule of schedules) {
    if (Number.isInteger(schedule.weekday)) days.add(schedule.weekday)
  }
  return [...days].sort((a, b) => a - b)
}

export function isWorshipWeekday(
  weekday: number,
  schedules: readonly WorshipSchedule[] = ALL_WORSHIP_SCHEDULES,
): boolean {
  return worshipWeekdays(schedules).includes(weekday)
}


function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesDay(name: string, scheduleDay: string): boolean {
  const key = scheduleDay.toLowerCase()
  const aliases = DAY_ALIASES[key] ?? [key]
  return aliases.some(
    (a) =>
      name.includes(` ${a} `) || name.startsWith(`${a} `) || name.endsWith(` ${a}`),
  )
}

function scheduleTimeTokens(scheduleTime: string): { hour: number; ampm: string } {
  const match = scheduleTime.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i)
  const hour = match ? Number(match[1]) : -1
  const ampm = match ? match[3].toLowerCase() : ''
  return { hour, ampm }
}

function matchesTime(name: string, scheduleTime: string): boolean {
  const { hour, ampm } = scheduleTimeTokens(scheduleTime)
  if (hour < 0) return false
  const ampmOk =
    ampm === '' || name.includes(` ${ampm}`) || name.includes(`${ampm} `)
  const hourOk =
    name.includes(` ${hour} `) ||
    name.startsWith(`${hour} `) ||
    name.endsWith(` ${hour}`) ||
    new RegExp(`\\b${hour}\\b`).test(name)
  return ampmOk && hourOk
}

export function findPresetForSchedule(
  presets: AssignmentPreset[],
  schedule: WorshipSchedule,
): AssignmentPreset | null {
  const candidates = presets
    .filter((p) => {
      const n = normalizeName(p.name)
      return matchesDay(n, schedule.scheduleDay) && matchesTime(n, schedule.scheduleTime)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return candidates[0] ?? null
}

export function findPresetByKey(
  presets: AssignmentPreset[],
  key: WorshipScheduleKey,
): AssignmentPreset | null {
  const schedule = WORSHIP_SCHEDULE_MAP[key]
  return schedule ? findPresetForSchedule(presets, schedule) : null
}