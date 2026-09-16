import { nanoid } from 'nanoid'
import { format, parseISO, isValid, addDays } from 'date-fns'
import type {
  Suguan,
  SuguanEvent,
  SuguanEventType,
  SuguanGroup,
  SuguanType,
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

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

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
  const fromDutyRole = suguan.dutyRoles.find(
    (d) => d.dutyRoleId === 'pangulong-mang-aawit',
  )?.memberName
  const fromMasterList = members.find(
    (m) => (m.isActive ?? false) && (m.positions ?? []).includes('pangulong-mang-aawit'),
  )
  return {
    pmName:
      fromDutyRole ??
      (fromMasterList
        ? `${fromMasterList.firstName} ${fromMasterList.lastName}`
        : ''),
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
  paperSize: 'a4',
  orientation: 'landscape',
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
  cellPadding: number
  nameColWidth: number
  noColWidth: number
  eventColWidth: number
}

export const FONT_SIZE_PRESETS: Record<DocFontSize, FontSizePreset> = {
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
    cellPadding: 0.6,
    noColWidth: 4,
    nameColWidth: 28,
    eventColWidth: 13,
  },
  normal: {
    label: 'Normal — compact spreadsheet-style layout',
    titleFontSize: 13,
    headerFontSize: 9,
    bodyFontSize: 9,
    smallFontSize: 8,
    rowHeight: 16,
    headerRowHeight: 18,
    titleRowHeight: 36,
    sigRowHeight: 16,
    cellPadding: 1,
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
const FONT_SIZE_OPTIONS = new Set<string>(['small', 'normal', 'large'])

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
  const date = mainDate || todayISO()
  return [
    { id: nanoid(), type: 'pagsasanay', date },
    { id: nanoid(), type: 'pagtupad', date },
  ]
}

function addISO(date: string, days: number): string {
  const d = parseISO(date)
  return d instanceof Date && !isNaN(d.getTime())
    ? addDays(d, days).toISOString().slice(0, 10)
    : date
}

export function generateEventsFromCoverage(
  coverage: SuguanCoverage,
): SuguanEvent[] {
  if (coverage.template === 'midweek-2w') {
    const w1Wed = addISO(coverage.startDate, 0)
    const w1Thu = addISO(coverage.startDate, 1)
    const w2Wed = addISO(coverage.startDate, 7)
    const w2Thu = addISO(coverage.startDate, 8)
    return [
      { id: nanoid(), type: 'pagsasanay', date: w1Wed },
      { id: nanoid(), type: 'pagtupad', date: w1Thu, endDate: w1Thu },
      { id: nanoid(), type: 'pagsasanay', date: w2Wed },
      { id: nanoid(), type: 'pagtupad', date: w2Thu, endDate: w2Thu },
    ]
  }
  if (coverage.template === 'weekend-2w') {
    const w1Sat = addISO(coverage.startDate, 0)
    const w1Sun = addISO(coverage.startDate, 1)
    const w2Sat = addISO(coverage.startDate, 7)
    const w2Sun = addISO(coverage.startDate, 8)
    return [
      { id: nanoid(), type: 'pagsasanay', date: w1Sat },
      { id: nanoid(), type: 'pagtupad', date: w1Sun, endDate: w1Sun },
      { id: nanoid(), type: 'pagsasanay', date: w2Sat },
      { id: nanoid(), type: 'pagtupad', date: w2Sun, endDate: w2Sun },
    ]
  }
  return [
    {
      id: nanoid(),
      type: 'pagsasanay',
      date: coverage.oneWeekPagsasanayDate ?? coverage.oneWeekDate ?? coverage.startDate,
    },
    {
      id: nanoid(),
      type: 'pagtupad',
      date: coverage.oneWeekPagtupadDate ?? coverage.oneWeekDate ?? coverage.startDate,
      endDate: coverage.oneWeekPagtupadEndDate,
    },
  ]
}

export function coverageLabel(coverage: SuguanCoverage | null | undefined): string {
  if (!coverage) return ''
  const lastDate = coverage.oneWeekDate ?? addISO(coverage.startDate, 8)
  const end = parseISO(lastDate)
  const endLabel = isValid(end) ? format(end, 'MMMM dd, yyyy') : lastDate
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
): SuguanCoverage | null {
  if (!events || events.length === 0) return null
  const first = events[0]
  if (!first?.date) return null
  const startDate = first.date
  const firstWeekday = parseISO(startDate).getDay()
  const template =
    events.length >= 4 && (firstWeekday === 3 || firstWeekday === 6)
      ? firstWeekday === 3
        ? 'midweek-2w'
        : 'weekend-2w'
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
    startDate: coverage.startDate || todayISO(),
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
  const type: SuguanType = (suguan as { type?: SuguanType }).type === 'special' ? 'special' : 'regular'
  const group: SuguanGroup =
    suguan.group === 'lalaki' || suguan.group === 'mixed'
      ? suguan.group
      : derived ?? 'babae'
  const hasEvents =
    Array.isArray(suguan.events) && suguan.events.length > 0
  const events =
    !hasEvents && type === 'regular' ? defaultEventsFor(suguan.date) : suguan.events ?? []
  const schedules = normalizeSchedules(suguan)
  return {
    ...suguan,
    type,
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
      assignments: Array.isArray(s.assignments) ? s.assignments : [],
    }))
  }
  const assignments = Array.isArray(suguan.assignments) ? suguan.assignments : []
  const label =
    (suguan as { eventTitle?: string }).eventTitle?.trim() ||
    groupLabel(suguan.group)
  return [
    {
      id: nanoid(),
      scheduleLabel: label,
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
  const d = parseISO(date)
  if (!isValid(d)) return format(new Date(), 'MMMM yyyy').toUpperCase()
  return format(d, 'MMMM yyyy').toUpperCase()
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
  if (suguan.type === 'special') return suguan.eventTitle ?? 'Special Occasion'
  const typeName = useSettingsStore
    .getState()
    .allServiceTypes()
    .find((t) => t.id === suguan.serviceTypeId)?.name
  return typeName ?? suguan.serviceTypeId
}

export function suguanTitle(suguan: Suguan): string {
  if (suguan.type === 'special') {
    const name = suguan.eventTitle?.trim()
      ? suguan.eventTitle.trim().toUpperCase()
      : 'SPECIAL OCCASION'
    return `SUGUAN NG MGA MANG-AAWIT SA PAGTUPAD NG ${name} SA BUWAN NG ${monthYearLabel(suguan.date)}`
  }
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

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatEventDate(event: SuguanEvent): string {
  const start = parseISO(event.date)
  if (!event.endDate) {
    if (!isValid(start)) return event.date
    return `${pad2(start.getMonth() + 1)}/${pad2(start.getDate())}/${start.getFullYear()}`
  }
  const end = parseISO(event.endDate)
  if (!isValid(end) || !isValid(start)) {
    return `${event.date} – ${event.endDate}`
  }
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = sameYear && start.getMonth() === end.getMonth()
  const yy = (d: Date) => String(d.getFullYear()).slice(2)
  if (sameMonth) {
    return `${pad2(start.getMonth() + 1)}/${pad2(start.getDate())}-${pad2(end.getDate())}/${yy(end)}`
  }
  return `${pad2(start.getMonth() + 1)}/${pad2(start.getDate())}/${yy(start)}-${pad2(end.getMonth())}/${pad2(end.getDate())}/${yy(end)}`
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
  const d = parseISO(suguan.date)
  const month = format(isValid(d) ? d : new Date(), 'MMMM')
  const year = format(isValid(d) ? d : new Date(), 'yyyy')
  return `Suguan_${month}_${year}_${groupFileLabel(suguan.group)}.${ext}`
}

export type SuguanEventLabel = 'PAGSASANAY' | 'PAGTUPAD'

export function eventTypeLabel(type: SuguanEventType): SuguanEventLabel {
  return type === 'pagsasanay' ? 'PAGSASANAY' : 'PAGTUPAD'
}