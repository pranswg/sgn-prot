/**
 * Canonical Philippine Standard Time (PHT / UTC+8) date handling.
 *
 * The single rule that prevents off-by-one bugs in this app:
 *
 *   A calendar date is a `YYYY-MM-DD` STRING, never a `Date`.
 *
 * `new Date('2026-09-26')` is parsed as UTC midnight by the language spec, and
 * `date.toISOString()` serialises in UTC. Mixing either of those with local-time
 * `getDay()` / `getMonth()` / `format()` is what previously shifted every
 * generated date one day backwards in UTC+8. (Reproduced: `parseISO('2026-09-26')`
 * is local midnight = `2026-09-25T16:00:00Z`, so `addDays(d, 0).toISOString()`
 * reports `2026-09-25`.)
 *
 * So all arithmetic below runs through `Date.UTC`, which is a pure numeric
 * calendar calculation with no timezone attached. Results are therefore
 * identical on a device set to Manila, New York, Tokyo, or UTC.
 *
 * `Date` objects are only used for true *instants* (createdAt, assignedAt,
 * backup timestamps) and always converted to a calendar date via
 * `toDateKeyFromInstant`, which pins the IANA zone explicitly.
 */

export const PHT_TIME_ZONE = 'Asia/Manila'
export const PHT_UTC_OFFSET_HOURS = 8

/** A calendar date, always `YYYY-MM-DD`. */
export type DateKey = string

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false
  const match = DATE_KEY_PATTERN.exec(value)
  if (!match) return false
  const [, y, m, d] = match
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  // Reject overflow like 2026-02-30 by round-tripping through the calendar.
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  )
}

/**
 * Calendar fields -> a UTC-midnight `Date` used purely as a calendar counter.
 * Never read this value as a wall-clock time; only read it back with `getUTC*`.
 */
function toCalendarCounter(key: DateKey): Date | null {
  const match = DATE_KEY_PATTERN.exec(key)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const counter = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(counter.getTime())) return null
  return counter
}

function fromCalendarCounter(counter: Date): DateKey {
  const year = counter.getUTCFullYear()
  const month = String(counter.getUTCMonth() + 1).padStart(2, '0')
  const day = String(counter.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The calendar date of an instant, interpreted in PHT.
 *
 * This is the ONLY correct way to turn `new Date()` into a `YYYY-MM-DD` for
 * this app. It deliberately does not use `toISOString()` (UTC) or the device
 * timezone.
 */
export function toDateKeyFromInstant(instant: Date): DateKey {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PHT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${read('year')}-${read('month')}-${read('day')}`
}

/** Today's calendar date in PHT. */
export function todayPHT(now: Date = new Date()): DateKey {
  return toDateKeyFromInstant(now)
}

/** Adds (or subtracts) whole days. Timezone-independent. */
export function addDays(key: DateKey, days: number): DateKey {
  const counter = toCalendarCounter(key)
  if (!counter) return key
  counter.setUTCDate(counter.getUTCDate() + days)
  return fromCalendarCounter(counter)
}

/**
 * Whole days from `from` to `to` (negative when `to` is earlier).
 * Timezone-independent and DST-safe because it is pure calendar math.
 */
export function daysBetween(from: DateKey, to: DateKey): number {
  const a = toCalendarCounter(from)
  const b = toCalendarCounter(to)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** Day of week, `0` = Sunday ... `6` = Saturday (matches `Date#getDay`). */
export function weekdayOf(key: DateKey): number {
  const counter = toCalendarCounter(key)
  return counter ? counter.getUTCDay() : NaN
}

export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -weekdayOf(key))
}

/**
 * Compares two calendar dates. `null`/invalid keys sort last.
 * Numeric rather than string comparison so callers cannot accidentally
 * lexicographically compare partial keys.
 */
/**
 * Chronological comparison of two date keys, as a sign:
 * negative when `a` is earlier, `0` when equal, positive when later.
 *
 * Returns a sign rather than a day count so callers can safely use `<`/`>=`.
 * Validated `YYYY-MM-DD` keys sort lexicographically, so this is exact.
 */
export function compareDateKeys(a: DateKey, b: DateKey): number {
  if (!isDateKey(a) && !isDateKey(b)) return 0
  if (!isDateKey(a)) return 1
  if (!isDateKey(b)) return -1
  if (a === b) return 0
  return a < b ? -1 : 1
}

/**
 * The later of two dates; `fallback` when neither is valid.
 *
 * Always returns a string, so an unusable fallback degrades to `''` instead of
 * leaking `undefined` into persisted date fields.
 */
export function laterDateKey(
  a: DateKey | undefined | null,
  b: DateKey | undefined | null,
  fallback: DateKey | undefined | null,
): DateKey {
  if (isDateKey(a) && isDateKey(b)) return compareDateKeys(a, b) >= 0 ? a : b
  if (isDateKey(a)) return a
  if (isDateKey(b)) return b
  return isDateKey(fallback) ? fallback : ''
}

/**
 * The earlier of two dates; `fallback` when neither is valid.
 *
 * Always returns a string, so an unusable fallback degrades to `''`.
 */
export function earlierDateKey(
  a: DateKey | undefined | null,
  b: DateKey | undefined | null,
  fallback: DateKey | undefined | null,
): DateKey {
  if (isDateKey(a) && isDateKey(b)) return compareDateKeys(a, b) <= 0 ? a : b
  if (isDateKey(a)) return a
  if (isDateKey(b)) return b
  return isDateKey(fallback) ? fallback : ''
}

/**
 * The FIRST valid candidate, in priority order.
 *
 * Use this when a later candidate is only a default: an explicit value the user
 * entered must win over an auto-suggestion, whichever of the two is later.
 */
export function firstDateKey(
  ...candidates: (DateKey | undefined | null)[]
): DateKey {
  for (const candidate of candidates) {
    if (isDateKey(candidate)) return candidate
  }
  return ''
}

/** True when `key` is strictly before today in PHT. */
export function isPastPHT(key: DateKey, now: Date = new Date()): boolean {
  if (!isDateKey(key)) return false
  return compareDateKeys(key, todayPHT(now)) < 0
}

/** True when `key` is today or later in PHT. */
export function isTodayOrFuturePHT(key: DateKey, now: Date = new Date()): boolean {
  if (!isDateKey(key)) return false
  return compareDateKeys(key, todayPHT(now)) >= 0
}

/** `true` when both keys fall in the same PHT calendar month and year. */
export function isSamePHTMonth(
  a: DateKey,
  b: DateKey,
): boolean {
  const left = toCalendarCounter(a)
  const right = toCalendarCounter(b)
  if (!left || !right) return false
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth()
  )
}

/**
 * The nearest date AFTER `fromKey` whose weekday is in `weekdays`.
 *
 * `fromKey` itself is never returned, so a rehearsal on a worship day still
 * resolves to the following service. Scans forward at most 7 days, because any
 * non-empty weekday set is guaranteed to recur within a week.
 *
 * @param weekdays Day indices, `0` = Sunday ... `6` = Saturday.
 * @returns The resolved date, or `null` when `fromKey` is invalid or
 *          `weekdays` contains no usable entry.
 */
export function nextDateOnWeekdays(
  fromKey: DateKey,
  weekdays: readonly number[],
): DateKey | null {
  if (!isDateKey(fromKey)) return null

  const usable = weekdays.filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  )
  if (usable.length === 0) return null

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addDays(fromKey, offset)
    if (usable.includes(weekdayOf(candidate))) return candidate
  }
  return null
}

/**
 * Weekday names keyed by the `YYYY-MM-DD`-style indices used above, kept in
 * English because the date logic must not depend on a display locale.
 */
export const WEEKDAY_LONG: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
}

export const WEEKDAY_SHORT: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

export const WEEKDAY_TINY: Record<number, string> = {
  0: 'S',
  1: 'M',
  2: 'T',
  3: 'W',
  4: 'T',
  5: 'F',
  6: 'S',
}

/** Long-form date for display, e.g. `Wednesday, September 30, 2026`. */
export function formatDateKeyLong(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  const counter = toCalendarCounter(key)
  if (!counter) return '—'
  const weekday = WEEKDAY_LONG[counter.getUTCDay()]
  const month = counter.toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })
  return `${weekday}, ${month} ${counter.getUTCDate()}, ${counter.getUTCFullYear()}`
}

/** Short date for display, e.g. `Sep 30, 2026`. */
export function formatDateKey(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  const counter = toCalendarCounter(key)
  if (!counter) return '—'
  const month = counter.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
  return `${month} ${counter.getUTCDate()}, ${counter.getUTCFullYear()}`
}

/** `MM/DD/YYYY`, the format the choir sheets use. */
export function formatDateKeyNumeric(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  const counter = toCalendarCounter(key)
  if (!counter) return '—'
  return `${pad2(counter.getUTCMonth() + 1)}/${pad2(
    counter.getUTCDate(),
  )}/${counter.getUTCFullYear()}`
}

/** `MMMM YYYY`, used for month group headings. */
export function formatMonthYearKey(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  const counter = toCalendarCounter(key)
  if (!counter) return '—'
  const month = counter.toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })
  return `${month} ${counter.getUTCFullYear()}`
}

/** Long date without weekday, e.g. `October 19, 2026`. */
export function formatDateKeyLongDate(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  const counter = toCalendarCounter(key)
  if (!counter) return '—'
  const month = counter.toLocaleString('en-US', {
    month: 'long',
    timeZone: 'UTC',
  })
  return `${month} ${counter.getUTCDate()}, ${counter.getUTCFullYear()}`
}

/** Weekday name only, e.g. `Wednesday`. */
export function formatWeekday(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  return WEEKDAY_LONG[weekdayOf(key)]
}

/** Day-of-month only, e.g. `4`. Used for calendar-tile styling. */
export function dayOfMonthKey(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  const counter = toCalendarCounter(key)
  if (!counter) return '—'
  return String(counter.getUTCDate())
}

/** Short month name only, e.g. `Oct`. Used for calendar-tile styling. */
export function monthShortKey(key: DateKey): string {
  if (!isDateKey(key)) return '—'
  const counter = toCalendarCounter(key)
  if (!counter) return '—'
  return counter.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
}

/** Formatted PHT wall clock for the app header, e.g. `Sep 30, 2026, 7:04 PM`. */
export function formatPHTDateTime(
  instant: Date = new Date(),
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PHT_TIME_ZONE,
    ...options,
  }).format(instant)
}

/** `HH:MM` in PHT, 24-hour. Used for backup/export timestamps. */
export function formatPHTTime(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PHT_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'
  return `${read('hour')}:${read('minute')}`
}

/**
 * Filename timestamp for every exported document, e.g. `20261008_07-00PM`.
 *
 * `YYYYMMDD` (PHT calendar date) joined by an underscore to a 12-hour
 * `hh-mmAMPM` clock, so files sort predictably and share folders group by date.
 * Both halves are read from the same PHT+8 view; a minute or hour past
 * midnight still lands on the Philippine day, never "yesterday" by device
 * timezone. PHT has no daylight saving, so the offset math is exact.
 */
export function filenameTimestampPHT(instant: Date = new Date()): string {
  const pht = new Date(instant.getTime() + PHT_UTC_OFFSET_HOURS * 3_600_000)
  const year = pht.getUTCFullYear()
  const month = pad2(pht.getUTCMonth() + 1)
  const day = pad2(pht.getUTCDate())
  let hour = pht.getUTCHours()
  const meridiem = hour < 12 ? 'AM' : 'PM'
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${year}${month}${day}_${pad2(hour)}-${pad2(pht.getUTCMinutes())}${meridiem}`
}

/**
 * An unambiguous instant written in Philippine local time, e.g.
 * `2026-09-30T19:04:00+08:00`. Used for human-readable records such as the
 * backup file's `exportedAt`, so a Philippine time is stated explicitly rather
 * than left in UTC.
 */
export function phtInstantISO(instant: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PHT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'
  return `${read('year')}-${read('month')}-${read('day')}T${read('hour')}:${read(
    'minute',
  )}:${read('second')}+08:00`
}
