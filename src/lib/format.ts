import {
  formatDateKey,
  formatDateKeyLong,
  formatDateKeyLongDate,
  isDateKey,
  isPastPHT,
} from './phDate'

export function formatDate(isoDate: string): string {
  if (!isoDate) return '—'
  if (!isDateKey(isoDate)) return isoDate
  return formatDateKey(isoDate)
}

/**
 * Short date for an auto-added record — the member/trainee `dateAdded`,
 * which is either a plain `YYYY-MM-DD` key or a full `phtInstantISO()`
 * stamp like `2026-09-30T19:04:00+08:00`. Both are shown as `Sep 30, 2026`.
 */
export function formatAddedDate(added: string): string {
  if (!added) return '—'
  const datePart = /^(\d{4}-\d{2}-\d{2})/.exec(added)?.[1]
  if (!datePart || !isDateKey(datePart)) return added
  return formatDateKey(datePart)
}

export function formatDateLong(isoDate: string): string {
  if (!isoDate) return '—'
  if (!isDateKey(isoDate)) return isoDate
  return formatDateKeyLong(isoDate)
}

export function formatDateLongDate(isoDate: string): string {
  if (!isoDate) return '—'
  if (!isDateKey(isoDate)) return isoDate
  return formatDateKeyLongDate(isoDate)
}

export function formatTime(time: string): string {
  if (!time) return '—'
  const [hours, minutes] = time.split(':')
  const h = Number(hours)
  if (Number.isNaN(h)) return time
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${minutes} ${period}`
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`
}

/**
 * True when a `YYYY-MM-DD` calendar date is strictly before today in the
 * Philippines. Uses PHT as the reference day so a member added "today" is
 * never reported as past, regardless of the device's timezone.
 */
export function isPast(date: string): boolean {
  if (!isDateKey(date)) return false
  return isPastPHT(date)
}