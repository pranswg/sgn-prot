import {
  addDays,
  daysBetween,
  isDateKey,
  weekdayOf,
  type DateKey,
} from '@/lib/phDate'
export { createAttendanceDatePanels, MAX_ATTENDANCE_DATE_COLUMNS } from '@/lib/attendanceDatePanels'


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
