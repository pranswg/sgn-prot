import { worshipWeekFromRehearsal } from '@/lib/suguanDates'

function calendarParts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return {
    month: date.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }),
    day,
    year,
  }
}

function formatRange(
  startKey: string,
  endKey: string,
  includeYear: boolean,
  omitStartMonth = false,
) {
  const start = calendarParts(startKey)
  const end = calendarParts(endKey)
  const range =
    start.month === end.month && start.year === end.year
      ? `${omitStartMonth ? '' : `${start.month} `}${start.day}-${end.day}`
      : `${start.month} ${start.day}-${end.month} ${end.day}`
  return includeYear ? `${range}, ${end.year}` : range
}

export function organistaDateLabel(rehearsalDate: string): string {
  const week = worshipWeekFromRehearsal(rehearsalDate)
  if (!week) return ''

  const midweekStart = calendarParts(week.wednesday)
  const midweekEnd = calendarParts(week.thursday)
  const weekendStart = calendarParts(week.saturday)
  const weekendEnd = calendarParts(week.sunday)
  const sameYear =
    midweekStart.year === midweekEnd.year &&
    midweekStart.year === weekendStart.year &&
    midweekStart.year === weekendEnd.year

  const midweek = `${formatRange(week.wednesday, week.thursday, !sameYear)} (Midweek)`
  const weekend = `${formatRange(
    week.saturday,
    week.sunday,
    !sameYear,
    weekendStart.month === midweekEnd.month &&
      weekendStart.year === midweekEnd.year,
  )} (Weekend)`

  return sameYear
    ? `${midweek} and ${weekend}, ${weekendEnd.year}`
    : `${midweek} and ${weekend}`
}
