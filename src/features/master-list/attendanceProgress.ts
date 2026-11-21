import type { Member } from '@/core/types/member'
import type { DateKey } from '@/lib/phDate'
import type { AttendanceSheet } from '@/store/attendanceStore'

/**
 * Person key used by `AttendanceSheet.present`. Kept here so the library and the
 * marking workspace cannot disagree about how a mark is keyed.
 */
export function attendancePersonKey(memberId: string): string {
  return `member:${memberId}`
}

export type SheetState = 'not-started' | 'in-progress' | 'complete'

export interface SheetProgress {
  /** Present marks recorded on the sheet's own dates. */
  marked: number
  /** Dates × eligible members. */
  total: number
  percent: number
  state: SheetState
  /** Present count per date, keyed by canonical `YYYY-MM-DD`. */
  dateCounts: Record<DateKey, number>
}

/** The roster a sheet actually asks about: voice sections narrow it. */
export function sheetRoster(sheet: AttendanceSheet, roster: Member[]): Member[] {
  if (!sheet.groupByVoice) return roster
  const voiceIds = new Set(sheet.voiceIds)
  return roster.filter((member) => voiceIds.has(member.voicePosition))
}

/**
 * A sheet's real progress. Status comes from the marks, not from whether a file
 * was ever exported, so a fully marked draft does not read as "done" and an
 * exported but half-marked sheet does not read as finished.
 */
export function computeSheetProgress(
  sheet: AttendanceSheet,
  roster: Member[],
): SheetProgress {
  const eligible = sheetRoster(sheet, roster)
  const dateCounts: Record<DateKey, number> = {}
  let marked = 0

  for (const date of sheet.dates) {
    let count = 0
    for (const member of eligible) {
      const dates = sheet.present[attendancePersonKey(member.id)]
      if (dates?.includes(date)) count += 1
    }
    dateCounts[date] = count
    marked += count
  }

  const total = sheet.dates.length * eligible.length
  return {
    marked,
    total,
    percent: percentOf(marked, total),
    state:
      marked === 0 ? 'not-started' : marked >= total ? 'complete' : 'in-progress',
    dateCounts,
  }
}

/**
 * The date the workspace opens on: the latest date that already has marks, so a
 * sheet with a future unmarked session lands on real work instead of an empty
 * column. Falls back to the last date on an untouched sheet.
 */
export function defaultFocusDate(
  sheet: AttendanceSheet,
  roster: Member[],
): DateKey {
  const { dateCounts } = computeSheetProgress(sheet, roster)
  for (let index = sheet.dates.length - 1; index >= 0; index -= 1) {
    const date = sheet.dates[index]
    if (date && (dateCounts[date] ?? 0) > 0) return date
  }
  return sheet.dates[sheet.dates.length - 1] ?? ''
}

/** How many (member, date) marks differ between two drafts. */
export function countAttendanceChanges(
  next: Record<string, DateKey[]>,
  previous: Record<string, DateKey[]>,
): number {
  const keys = new Set([...Object.keys(next), ...Object.keys(previous)])
  let changes = 0

  for (const key of keys) {
    const after = new Set(next[key] ?? [])
    const before = new Set(previous[key] ?? [])
    for (const date of new Set([...after, ...before])) {
      if (after.has(date) !== before.has(date)) changes += 1
    }
  }

  return changes
}

export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100)
}
