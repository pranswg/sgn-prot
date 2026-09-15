import type { WorshipScheduleKey } from '@/core/types/suguan'
import type { AssignmentPreset } from '@/store/assignmentPresetStore'

export interface WorshipSchedule {
  id: WorshipScheduleKey
  scheduleDay: string
  scheduleTime: string
  label: string
  presetHint: string
}

export const WEEKEND_SCHEDULES: WorshipSchedule[] = [
  {
    id: 'sabado-6pm',
    scheduleDay: 'SABADO',
    scheduleTime: '6:00 PM',
    label: 'SABADO, 6:00 PM',
    presetHint: 'Sabado 6:00 PM Group',
  },
  {
    id: 'linggo-6am',
    scheduleDay: 'LINGGO',
    scheduleTime: '6:00 AM',
    label: 'LINGGO, 6:00 AM',
    presetHint: 'Linggo 6:00 AM Group',
  },
  {
    id: 'linggo-10am',
    scheduleDay: 'LINGGO',
    scheduleTime: '10:00 AM',
    label: 'LINGGO, 10:00 AM',
    presetHint: 'Linggo 10:00 AM Group',
  },
]

export const MIDWEEK_SCHEDULES: WorshipSchedule[] = [
  {
    id: 'miyerkules-7pm',
    scheduleDay: 'MIYERKULES',
    scheduleTime: '7:00 PM',
    label: 'MIYERKULES, 7:00 PM',
    presetHint: 'Miyerkules 7:00 PM Group',
  },
  {
    id: 'huwebes-6am',
    scheduleDay: 'HUWEBES',
    scheduleTime: '6:00 AM',
    label: 'HUWEBES, 6:00 AM',
    presetHint: 'Huwebes 6:00 AM Group',
  },
  {
    id: 'huwebes-7pm',
    scheduleDay: 'HUWEBES',
    scheduleTime: '7:00 PM',
    label: 'HUWEBES, 7:00 PM',
    presetHint: 'Huwebes 7:00 PM Group',
  },
]

export const ALL_WORSHIP_SCHEDULES: WorshipSchedule[] = [
  ...WEEKEND_SCHEDULES,
  ...MIDWEEK_SCHEDULES,
]

export const WORSHIP_SCHEDULE_MAP = Object.fromEntries(
  ALL_WORSHIP_SCHEDULES.map((s) => [s.id, s]),
) as Record<WorshipScheduleKey, WorshipSchedule>

const DAY_ALIASES: Record<string, string[]> = {
  sabado: ['sabado', 'saturday', 'sat'],
  linggo: ['linggo', 'sunday', 'sun'],
  miyerkules: ['miyerkules', 'wednesday', 'wed'],
  huwebes: ['huwebes', 'thursday', 'thu'],
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