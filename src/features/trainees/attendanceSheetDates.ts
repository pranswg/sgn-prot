import {
  addDays,
  daysBetween,
  isDateKey,
  weekdayOf,
  type DateKey,
} from '@/lib/phDate'

export const MAX_ATTENDANCE_DATE_COLUMNS = 8

export function generatePracticeDates(
  startDate: DateKey,
  endDate: DateKey,
  weekdays: readonly number[],
): DateKey[] {
  if (
    !isDateKey(startDate) ||
    !isDateKey(endDate) ||
    startDate > endDate ||
    weekdays.length === 0
  ) {
    return []
  }

  const selectedWeekdays = new Set(
    weekdays.filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6),
  )
  const dates: DateKey[] = []
  const dayCount = daysBetween(startDate, endDate)

  for (let offset = 0; offset <= dayCount; offset += 1) {
    const date = addDays(startDate, offset)
    if (selectedWeekdays.has(weekdayOf(date))) dates.push(date)
  }

  return dates
}

/** Splits only when the selected dates exceed the printable column limit. */
export function createAttendanceDatePanels<T>(
  dates: readonly T[],
  maxColumns = MAX_ATTENDANCE_DATE_COLUMNS,
): T[][] {
  if (!Number.isInteger(maxColumns) || maxColumns < 1) {
    throw new Error('Attendance date panel width must be a positive integer.')
  }

  const panels: T[][] = []
  for (let index = 0; index < dates.length; index += maxColumns) {
    panels.push(dates.slice(index, index + maxColumns))
  }
  return panels
}
