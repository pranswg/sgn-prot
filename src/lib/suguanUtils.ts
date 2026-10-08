import { nanoid } from 'nanoid'
import type {
  Suguan,
  SuguanEvent,
  SuguanEventType,
  SuguanGroup,
  SuguanDocFormat,
  SuguanCoverage,
  SuguanScheduleSection,
  DocPaperSize,
  DocOrientation,
  DocMargins,
  DocScaling,
  DocFontSize,
} from '@/core/types/suguan'
import { useSettingsStore } from '@/store/settingsStore'
import type { ChoirPosition } from '@/core/types/member'
import {
  formatDateKeyNumeric,
  formatMonthYearKey,
  isDateKey,
  todayPHT,
  weekdayOf,
} from '@/lib/phDate'
import {
  DEFAULT_SCHEDULE_CATEGORIES,
  worshipWeekdays,
  type WorshipScheduleCategories,
} from '@/core/constants/worshipSchedules'
import {
  coverageLastDate,
  planEventsFromCoverage,
  suggestPagtupadBlock,
} from '@/lib/suguanDates'

/** @deprecated Use `todayPHT` from `@/lib/phDate`. Kept as an alias so existing
 * call sites keep working; both now resolve to the PHT calendar date. */
export const todayISO = todayPHT

/** Re-exported so existing `@/lib/suguanUtils` importers keep a single import. */
export { todayPHT }


export interface SignatureNames {
  pmName: string
  destinadoName: string
}

interface SignatureMember {
  firstName: string
  lastName: string
  isActive?: boolean
  positions?: ChoirPosition[]
}

export function resolveSignatureNames(
  suguan: Pick<Suguan, 'dutyRoles' | 'destinadoName'>,
  members: SignatureMember[],
): SignatureNames {
  // The Pangulong Mang-aawit is whoever holds that position in the master
  // list. The old step-3 picker is gone, so a leftover duty role only fills in
  // for legacy records that predate the master-list lookup.
  const fromMasterList = members.find(
    (m) => (m.isActive ?? false) && (m.positions ?? []).includes('pangulong-mang-aawit'),
  )
  const fromDutyRole = suguan.dutyRoles.find(
    (d) => d.dutyRoleId === 'pangulong-mang-aawit',
  )?.memberName
  return {
    pmName: fromMasterList
      ? `${fromMasterList.firstName} ${fromMasterList.lastName}`
      : (fromDutyRole ?? ''),
    destinadoName: (suguan.destinadoName ?? '').trim(),
  }
}

export const DOC_PAPER_SIZES_MM: Record<
  'letter' | 'a4' | 'legal',
  { width: number; height: number; label: string }
> = {
  letter: { width: 215.9, height: 279.4, label: 'Letter (8.5 x 11 inches)' },
  a4: { width: 210, height: 297, label: 'A4 (8.27 x 11.69 inches)' },
  legal: { width: 215.9, height: 355.6, label: 'Legal (8.5 x 14 inches)' },
}

export const PAPER_SIZE_LABELS: Record<
  DocPaperSize,
  { label: string; short: string }
> = {
  letter: { label: 'Letter (8.5 x 11 inches)', short: 'Letter' },
  a4: { label: 'A4 (8.27 x 11.69 inches)', short: 'A4' },
  legal: { label: 'Legal (8.5 x 14 inches)', short: 'Legal' },
  custom: { label: 'Custom Size', short: 'Custom' },
}

export const DEFAULT_DOC_FORMAT: SuguanDocFormat = {
  paperSize: 'legal',
  orientation: 'portrait',
  margins: 'normal',
  scaling: 'auto',
  fontSize: 'normal',
}

export interface FontSizePreset {
  label: string
  titleFontSize: number
  headerFontSize: number
  bodyFontSize: number
  smallFontSize: number
  rowHeight: number
  headerRowHeight: number
  titleRowHeight: number
  sigRowHeight: number
  /** Fixed signature font size; never shrinks with fit-page scaling. */
  sigFontSize: number
  cellPadding: number
  nameColWidth: number
  noColWidth: number
  eventColWidth: number
}

/**
 * The presets that exist as static entries. `custom` is deliberately absent:
 * it is derived at runtime by `resolveFontSizePreset`, so keeping it out of
 * this record is what stops a `FONT_SIZE_PRESETS[fmt.fontSize]` index from
 * silently yielding `undefined` for a custom format.
 */
export type DocFontSizePreset = Exclude<DocFontSize, 'custom'>

export const FONT_SIZE_PRESETS: Record<DocFontSizePreset, FontSizePreset> = {
  small: {
    label: 'Small — compact layout for many members',
    titleFontSize: 12,
    headerFontSize: 8,
    bodyFontSize: 8,
    smallFontSize: 7,
    rowHeight: 14,
    headerRowHeight: 16,
    titleRowHeight: 32,
    sigRowHeight: 14,
    sigFontSize: 11,
    cellPadding: 0.6,
    noColWidth: 4,
    nameColWidth: 28,
    eventColWidth: 13,
  },
  normal: {
    label: 'Normal — compact spreadsheet-style layout',
    titleFontSize: 12,
    headerFontSize: 9,
    bodyFontSize: 9,
    smallFontSize: 8,
    rowHeight: 14,
    headerRowHeight: 16,
    titleRowHeight: 32,
    sigRowHeight: 14,
    sigFontSize: 11,
    cellPadding: 0.6,
    noColWidth: 5,
    nameColWidth: 30,
    eventColWidth: 15,
  },
  large: {
    label: 'Large — easier to read, fewer members per page',
    titleFontSize: 15,
    headerFontSize: 11,
    bodyFontSize: 11,
    smallFontSize: 9,
    rowHeight: 20,
    headerRowHeight: 22,
    titleRowHeight: 42,
    sigRowHeight: 20,
    sigFontSize: 14,
    cellPadding: 1.5,
    noColWidth: 6,
    nameColWidth: 32,
    eventColWidth: 18,
  },
}

const PAPER_SIZES = new Set<string>(['letter', 'a4', 'legal', 'custom'])
const ORIENTATIONS = new Set<string>(['portrait', 'landscape'])
const MARGIN_PRESETS = new Set<string>(['normal', 'narrow', 'custom'])
const SCALING_OPTIONS = new Set<string>(['fit-width', 'fit-page', 'auto'])
const FONT_SIZE_OPTIONS = new Set<string>(['small', 'normal', 'large', 'custom'])

/**
 * Bounds for the custom body font size, in pt. The floor is the same 6pt that
 * `fitFontSizePt` clamps to, so a custom size can never produce a row whose text
 * is smaller than the fit-page fallback. The ceiling keeps a single cell's text
 * inside its column; past roughly 20pt the name column starts truncating.
 */
export const CUSTOM_BODY_FONT_MIN = 6
export const CUSTOM_BODY_FONT_MAX = 20

/** Clamps a user-entered custom body size into the supported range. */
export function clampCustomBodyFontSize(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return FONT_SIZE_PRESETS.normal.bodyFontSize
  return Math.min(CUSTOM_BODY_FONT_MAX, Math.max(CUSTOM_BODY_FONT_MIN, Math.round(n * 2) / 2))
}

/**
 * Builds a full preset for a custom body size by scaling the `normal` preset.
 *
 * Scaling rather than exposing eight separate inputs is deliberate: the preset
 * mixes font sizes, row heights, and column-width weights that only look right
 * in proportion to each other. Scaling the whole preset by one factor keeps the
 * signature block, row heights, and column ratios in step, so a custom size can
 * never produce a row too short for its own text.
 *
 * `round1` keeps sub-point row heights exact so repeated roundings cannot drift;
 * font sizes stay on whole points because that is what the UI shows.
 */
export function scaleFontSizePreset(base: FontSizePreset, bodyFontSize: number): FontSizePreset {
  const factor = bodyFontSize / base.bodyFontSize
  const round1 = (n: number) => Math.round(n * factor * 10) / 10
  const fontPt = (n: number) => Math.max(1, Math.round(n * factor))
  return {
    ...base,
    label: `Custom — ${bodyFontSize} pt body text`,
    titleFontSize: fontPt(base.titleFontSize),
    headerFontSize: fontPt(base.headerFontSize),
    bodyFontSize,
    smallFontSize: fontPt(base.smallFontSize),
    sigFontSize: fontPt(base.sigFontSize),
    rowHeight: round1(base.rowHeight),
    headerRowHeight: round1(base.headerRowHeight),
    titleRowHeight: round1(base.titleRowHeight),
    sigRowHeight: round1(base.sigRowHeight),
    cellPadding: round1(base.cellPadding),
    noColWidth: round1(base.noColWidth),
    nameColWidth: round1(base.nameColWidth),
    eventColWidth: round1(base.eventColWidth),
  }
}

/**
 * The preset to lay out with. Every consumer must go through this rather than
 * indexing `FONT_SIZE_PRESETS[fmt.fontSize]`, because `custom` has no static
 * entry — it is derived from `customBodyFontSize`.
 */
export function resolveFontSizePreset(fmt: SuguanDocFormat): FontSizePreset {
  if (fmt.fontSize === 'custom') {
    return scaleFontSizePreset(FONT_SIZE_PRESETS.normal, clampCustomBodyFontSize(fmt.customBodyFontSize))
  }
  return FONT_SIZE_PRESETS[fmt.fontSize]
}

export function normalizeDocFormat(
  f?: Partial<SuguanDocFormat> | null,
): SuguanDocFormat {
  const valid = (set: Set<string>, value: unknown) =>
    typeof value === 'string' && set.has(value)
  const paperSize: DocPaperSize = valid(PAPER_SIZES, f?.paperSize)
    ? (f?.paperSize as DocPaperSize)
    : DEFAULT_DOC_FORMAT.paperSize
  const orientation: DocOrientation = valid(ORIENTATIONS, f?.orientation)
    ? (f?.orientation as DocOrientation)
    : DEFAULT_DOC_FORMAT.orientation
  const margins: DocMargins = valid(MARGIN_PRESETS, f?.margins)
    ? (f?.margins as DocMargins)
    : DEFAULT_DOC_FORMAT.margins
  const scaling: DocScaling = valid(SCALING_OPTIONS, f?.scaling)
    ? (f?.scaling as DocScaling)
    : DEFAULT_DOC_FORMAT.scaling
  const fontSize: DocFontSize = valid(FONT_SIZE_OPTIONS, f?.fontSize)
    ? (f?.fontSize as DocFontSize)
    : DEFAULT_DOC_FORMAT.fontSize
  return {
    paperSize,
    orientation,
    margins,
    scaling,
    fontSize,
    customWidthMm: f?.customWidthMm,
    customHeightMm: f?.customHeightMm,
    customMarginTopMm: f?.customMarginTopMm,
    customMarginBottomMm: f?.customMarginBottomMm,
    customMarginLeftMm: f?.customMarginLeftMm,
    customMarginRightMm: f?.customMarginRightMm,
    // Clamped rather than passed through: this reaches row heights and signature
    // geometry in every renderer, so a NaN or a negative value typed into the
    // input must not reach the layout maths.
    customBodyFontSize: clampCustomBodyFontSize(f?.customBodyFontSize),
  }
}

export function docPaperDimensionsMm(fmt: SuguanDocFormat): {
  width: number
  height: number
} {
  const size =
    fmt.paperSize === 'custom'
      ? {
          width: fmt.customWidthMm ?? 210,
          height: fmt.customHeightMm ?? 297,
        }
      : DOC_PAPER_SIZES_MM[fmt.paperSize]
  if (fmt.orientation === 'landscape') {
    return {
      width: Math.max(size.width, size.height),
      height: Math.min(size.width, size.height),
    }
  }
  return {
    width: Math.min(size.width, size.height),
    height: Math.max(size.width, size.height),
  }
}

export function docMarginsMm(fmt: SuguanDocFormat): {
  top: number
  bottom: number
  left: number
  right: number
} {
  if (fmt.margins === 'narrow') {
    return { top: 5, bottom: 5, left: 5, right: 5 }
  }
  if (fmt.margins === 'custom') {
    return {
      top: fmt.customMarginTopMm ?? 10,
      bottom: fmt.customMarginBottomMm ?? 10,
      left: fmt.customMarginLeftMm ?? 10,
      right: fmt.customMarginRightMm ?? 10,
    }
  }
  return { top: 8, bottom: 8, left: 10, right: 10 }
}

export function defaultEventsFor(mainDate: string): SuguanEvent[] {
  const date = isDateKey(mainDate) ? mainDate : todayPHT()
  const block = suggestPagtupadBlock(date)
  return [
    { id: nanoid(), type: 'pagsasanay', date },
    {
      id: nanoid(),
      type: 'pagtupad',
      date: block?.start ?? date,
      endDate: block?.end ?? date,
    },
  ]
}

export {
  coverageLastDate,
  isWeekendOnlySchedule,
  nextWeekendWorshipBlock,
  nextWorshipBlock,
  nextWorshipDateKey,
  planEventsFromCoverage,
  schedulesForTemplate,
  suggestBlockForSchedules,
  suggestPagtupadBlock,
  suggestPagtupadDate,
  worshipWeekFromRehearsal,
  worshipWeekSchedules,
} from './suguanDates'

/**
 * `planEventsFromCoverage` with a fresh id attached to each event, for callers
 * that persist the result.
 */
export function generateEventsFromCoverage(
  coverage: SuguanCoverage,
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): SuguanEvent[] {
  return planEventsFromCoverage(coverage, categories).map((event) => ({
    ...event,
    id: nanoid(),
  }))
}


export function coverageLabel(coverage: SuguanCoverage | null | undefined): string {
  if (!coverage) return ''
  const endLabel = formatDateKeyNumeric(coverageLastDate(coverage))
  if (coverage.template === 'midweek-2w') {
    return `2-Week Midweek — until ${endLabel}`
  }
  if (coverage.template === 'weekend-2w') {
    return `2-Week Weekend — until ${endLabel}`
  }
  return '1-Week Suguan (custom schedule)'
}

export function inferCoverageFromEvents(
  events: SuguanEvent[],
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): SuguanCoverage | null {
  if (!events || events.length === 0) return null
  const first = events[0]
  if (!first?.date) return null
  const startDate = first.date
  const firstWeekday = weekdayOf(startDate)
  const midweekDay = worshipWeekdays(categories.midweek)
  const weekendDay = worshipWeekdays(categories.weekend)
  const template =
    events.length >= 4 && midweekDay.includes(firstWeekday)
      ? 'midweek-2w'
      : events.length >= 4 && weekendDay.includes(firstWeekday)
        ? 'weekend-2w'
        : 'one-week'
  if (template === 'one-week') {
    const pagtupad = events.find((e) => e.type === 'pagtupad')
    const pagsasanay = events.find((e) => e.type === 'pagsasanay')
    return {
      template,
      startDate,
      oneWeekDate: startDate,
      oneWeekPagsasanayDate: pagsasanay?.date ?? startDate,
      oneWeekPagtupadDate: pagtupad?.date ?? startDate,
      oneWeekPagtupadEndDate: pagtupad?.endDate,
    }
  }
  return { template, startDate }
}

export function deriveGroupFromAssignments(
  assignments: Suguan['assignments'],
  voices: { id: string; gender: 'male' | 'female' }[],
): SuguanGroup | null {
  const genderFor = new Map(voices.map((v) => [v.id, v.gender]))
  let hasFemale = false
  let hasMale = false
  for (const a of assignments) {
    const gender = genderFor.get(a.voicePosition)
    if (gender === 'female') hasFemale = true
    if (gender === 'male') hasMale = true
  }
  if (hasMale && hasFemale) return 'mixed'
  if (hasFemale) return 'babae'
  if (hasMale) return 'lalaki'
  return null
}

export function normalizeCoverage(
  coverage?: SuguanCoverage | null,
): SuguanCoverage | null {
  if (!coverage) return null
  const validTemplates = new Set<string>(['midweek-2w', 'weekend-2w', 'one-week'])
  const template = validTemplates.has(coverage.template)
    ? coverage.template
    : 'one-week'
  return {
    template,
    // Preserved as-is when empty. A blank Pagsasanay date is a real state (a
    // Suguan saved before its date was chosen), and back-filling today's date
    // here would silently invent one. `planEventsFromCoverage` returns nothing
    // for a blank date, which the save guard already rejects.
    startDate: coverage.startDate ?? '',
    oneWeekDate: coverage.oneWeekDate,
    oneWeekPagsasanayDate: coverage.oneWeekPagsasanayDate,
    oneWeekPagtupadDate: coverage.oneWeekPagtupadDate,
    oneWeekPagtupadEndDate: coverage.oneWeekPagtupadEndDate,
  }
}

export function normalizeSuguan(
  suguan: Suguan,
  voices: { id: string; gender: 'male' | 'female' }[],
): Suguan {
  const derived = deriveGroupFromAssignments(suguan.assignments, voices)
  const group: SuguanGroup =
    suguan.group === 'lalaki' || suguan.group === 'mixed'
      ? suguan.group
      : derived ?? 'babae'
  const hasEvents =
    Array.isArray(suguan.events) && suguan.events.length > 0
  const events = !hasEvents ? defaultEventsFor(suguan.date) : suguan.events ?? []
  const schedules = normalizeSchedules(suguan)
  return {
    ...suguan,
    group,
    events,
    schedules,
    assignments: assignmentsFromSchedules(schedules),
    coverage: normalizeCoverage(suguan.coverage),
    docFormat: normalizeDocFormat(suguan.docFormat),
  }
}

export function normalizeSchedules(suguan: Suguan): SuguanScheduleSection[] {
  const raw = Array.isArray(suguan.schedules) ? suguan.schedules : []
  if (raw.length > 0) {
    return raw.map((s) => ({
      id: s.id || nanoid(),
      scheduleKey: s.scheduleKey,
      scheduleLabel: s.scheduleLabel || 'SUGUAN',
      scheduleDay: s.scheduleDay || '',
      scheduleTime: s.scheduleTime || '',
      scheduleDate: s.scheduleDate,
      assignments: Array.isArray(s.assignments) ? s.assignments : [],
    }))
  }
  const assignments = Array.isArray(suguan.assignments) ? suguan.assignments : []
  return [
    {
      id: nanoid(),
      scheduleLabel: groupLabel(suguan.group),
      scheduleDay: '',
      scheduleTime: '',
      assignments,
    },
  ]
}

export function assignmentsFromSchedules(
  schedules: SuguanScheduleSection[],
): Suguan['assignments'] {
  return schedules.flatMap((s) => s.assignments)
}

export function totalAssignedCount(suguan: Suguan): number {
  return assignmentsFromSchedules(
    Array.isArray(suguan.schedules) && suguan.schedules.length > 0
      ? suguan.schedules
      : [{ id: 'fallback', scheduleLabel: '', scheduleDay: '', scheduleTime: '', assignments: suguan.assignments }],
  ).length
}

export function normalizeSuguanList(
  suguan: Suguan[],
  voices: { id: string; gender: 'male' | 'female' }[],
): Suguan[] {
  return suguan.map((s) => normalizeSuguan(s, voices))
}

export function monthYearLabel(date: string): string {
  if (!isDateKey(date)) return formatMonthYearKey(todayPHT()).toUpperCase()
  return formatMonthYearKey(date).toUpperCase()
}

export function weekendPhrase(serviceTypeId: string): string {
  const typeName = useSettingsStore
    .getState()
    .allServiceTypes()
    .find((t) => t.id === serviceTypeId)?.name
    .toLowerCase()
  if (typeName && /huwebes|midweek|mid week|miyerkules/.test(typeName)) {
    return 'MID WEEK'
  }
  return 'WEEKEND'
}

export function serviceTypeLabel(suguan: Suguan): string {
  const typeName = useSettingsStore
    .getState()
    .allServiceTypes()
    .find((t) => t.id === suguan.serviceTypeId)?.name
  return typeName ?? suguan.serviceTypeId
}

export function suguanTitle(suguan: Suguan): string {
  const phrase =
    suguan.coverage?.template === 'midweek-2w'
      ? 'MID WEEK'
      : suguan.coverage?.template === 'weekend-2w'
        ? 'WEEKEND'
        : weekendPhrase(suguan.serviceTypeId)
  return `SUGUAN NG MGA MANG-AAWIT SA PAGTUPAD NG ${phrase} SA BUWAN NG ${monthYearLabel(suguan.date)}`
}

export function groupLabel(group: SuguanGroup): string {
  if (group === 'lalaki') return '(LALAKI)'
  if (group === 'mixed') return '(MIXED)'
  return '(BABAE)'
}

export function suguanSheetTitle(suguan: Suguan): string {
  return `${suguanTitle(suguan)} ${groupLabel(suguan.group)}`
}

export function groupFileLabel(group: SuguanGroup): string {
  if (group === 'lalaki') return 'Lalaki'
  if (group === 'mixed') return 'Mixed'
  return 'Babae'
}

export function formatEventDate(event: SuguanEvent): string {
  const start = event.date
  if (!isDateKey(start)) return start || '—'
  if (!isDateKey(event.endDate)) {
    return formatDateKeyNumeric(start)
  }

  const end = event.endDate
  const startParts = start.split('-')
  const endParts = end.split('-')
  const [startYear, startMonth] = startParts
  const [endYear, endMonth, endDay] = endParts
  const shortYear = endYear.slice(2)

  if (startYear === endYear && startMonth === endMonth) {
    const startDay = startParts[2]
    return `${startMonth}/${startDay}-${endDay}/${shortYear}`
  }
  return `${startMonth}/${startParts[2]}/${startYear.slice(2)}-${endMonth}/${endDay}/${shortYear}`
}

export function acuteFree(name: string): string {
  return name
    .replace(/ñ/gi, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/é/gi, 'e')
    .replace(/á/gi, 'a')
    .replace(/í/gi, 'i')
    .replace(/ó/gi, 'o')
    .replace(/ú/gi, 'u')
    .normalize('NFD')
}

export function assignmentDisplayName(
  memberName: string,
  memberId: string,
  members: { id: string; firstName: string; lastName: string }[],
): string {
  const member = members.find((m) => m.id === memberId)
  if (member && member.lastName.trim()) {
    const suffix = member.lastName.trim()
    const first = member.firstName.trim()
    return first ? `${suffix}, ${first}` : suffix
  }
  const parts = memberName.split(' ').filter(Boolean)
  if (parts.length <= 1) return memberName
  const firstName = parts[0]
  const last = parts.slice(1).join(' ')
  return `${last}, ${firstName}`
}

export function suguanFileName(suguan: Suguan, ext: 'xlsx' | 'pdf'): string {
  const [month, year] = formatMonthYearKey(
    isDateKey(suguan.date) ? suguan.date : todayPHT(),
  ).split(' ')
  return `Suguan_${month}_${year}_${groupFileLabel(suguan.group)}.${ext}`
}

export type SuguanEventLabel = 'PAGSASANAY' | 'PAGTUPAD'

export function eventTypeLabel(type: SuguanEventType): SuguanEventLabel {
  return type === 'pagsasanay' ? 'PAGSASANAY' : 'PAGTUPAD'
}