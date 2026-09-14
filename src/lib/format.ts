import { format, isValid, parseISO } from 'date-fns'
import type { SuguanStatus } from '@/core/types/suguan'

export function formatDate(isoDate: string): string {
  if (!isoDate) return '—'
  const date = parseISO(isoDate)
  if (!isValid(date)) return isoDate
  return format(date, 'MMM d, yyyy')
}

export function formatDateLong(isoDate: string): string {
  if (!isoDate) return '—'
  const date = parseISO(isoDate)
  if (!isValid(date)) return isoDate
  return format(date, 'EEEE, MMMM d, yyyy')
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

export const SUGUAN_STATUS_LABELS: Record<SuguanStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function isPast(date: string): boolean {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}