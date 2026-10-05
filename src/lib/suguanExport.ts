import type {
  Suguan,
  SuguanEvent,
  SuguanEventType,
  SuguanDocFormat,
  SuguanGroup,
} from '@/core/types/suguan'
import {
  assignmentDisplayName,
  docMarginsMm,
  docPaperDimensionsMm,
  eventTypeLabel,
  formatEventDate,
  groupLabel,
  normalizeDocFormat,
  resolveFontSizePreset,
  resolveSignatureNames,
  suguanFileName,
  suguanSheetTitle,
  type FontSizePreset,
} from '@/lib/suguanUtils'

const PAGSASANAY_FILL = 'FFF2CC'
const PAGTUPAD_FILL = 'D9EAD3'
const HEADER_FILL = 'F2F2F2'

/** Points to millimetres; shared so every renderer converts units identically. */
export const PT_TO_MM = 25.4 / 72

const EXCEL_PAPER_SIZE: Record<'letter' | 'a4' | 'legal', number> = {
  letter: 1,
  legal: 5,
  a4: 9,
}

function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function eventFill(type: SuguanEventType): string {
  return type === 'pagsasanay' ? PAGSASANAY_FILL : PAGTUPAD_FILL
}

function thinBorder(): {
  style: 'thin'
  color: { argb: string }
} {
  return { style: 'thin', color: { argb: 'FF404040' } }
}

function fullBorder(): {
  top: { style: 'thin'; color: { argb: string } }
  left: { style: 'thin'; color: { argb: string } }
  right: { style: 'thin'; color: { argb: string } }
  bottom: { style: 'thin'; color: { argb: string } }
} {
  return { top: thinBorder(), left: thinBorder(), right: thinBorder(), bottom: thinBorder() }
}

export interface SheetMembers {
  id: string
  firstName: string
  lastName: string
}

export interface SuguanSheetSection {
  sectionId: string
  label: string
  rows: { no: number; name: string }[]
}

const FEMALE_VOICE_GROUP = new Map<string, number>([
  ['soprano-1', 0],
  ['soprano-2', 0],
  ['alto', 1],
])
const MALE_VOICE_GROUP = new Map<string, number>([
  ['tenor', 0],
  ['bass', 1],
])

export function sortAssignmentsByHiddenVoice(
  assignments: Suguan['assignments'],
  members: SheetMembers[],
  group: SuguanGroup,
): Suguan['assignments'] {
  const rankOf = (voicePosition: string): number => {
    const ranks = group === 'lalaki' ? MALE_VOICE_GROUP : FEMALE_VOICE_GROUP
    return ranks.get(voicePosition) ?? 2
  }
  const nameOf = (a: Suguan['assignments'][number]) =>
    assignmentDisplayName(a.memberName, a.memberId, members)
  return [...assignments].sort((a, b) => {
    const ar = rankOf(a.voicePosition)
    const br = rankOf(b.voicePosition)
    if (ar !== br) return ar - br
    return nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' })
  })
}

export function buildSections(
  suguan: Suguan,
  members: SheetMembers[],
): SuguanSheetSection[] {
  const schedules =
    Array.isArray(suguan.schedules) && suguan.schedules.length > 0
      ? suguan.schedules
      : []
  const mapRows = (assignments: Suguan['assignments']) =>
    sortAssignmentsByHiddenVoice(assignments, members, suguan.group).map(
      (a, i) => ({
        no: i + 1,
        name: assignmentDisplayName(a.memberName, a.memberId, members),
      }),
    )
  if (schedules.length > 0) {
    return schedules.map((sec) => ({
      sectionId: sec.id,
      label: sec.scheduleLabel || 'SUGUAN',
      rows: mapRows(sec.assignments),
    }))
  }
  return [
    {
      sectionId: 'single',
      label: groupLabel(suguan.group),
      rows: mapRows(suguan.assignments),
    },
  ]
}

export interface NameLayout {
  nameColWidth: number
  nameFontSize: number
}

const MAX_NAME_COL_WIDTH = 40
const MIN_NAME_FONT_SIZE = 6

export function computeNameLayout(
  fs: FontSizePreset,
  names: string[],
): NameLayout {
  const longest = names.reduce((m, n) => Math.max(m, n.length), 0)
  const base = Math.round(longest * (fs.bodyFontSize / 11) * 0.95) + 2
  if (base <= MAX_NAME_COL_WIDTH) {
    return {
      nameColWidth: Math.max(fs.nameColWidth, base),
      nameFontSize: fs.bodyFontSize,
    }
  }
  return {
    nameColWidth: MAX_NAME_COL_WIDTH,
    nameFontSize: Math.max(
      MIN_NAME_FONT_SIZE,
      Math.round((fs.bodyFontSize * MAX_NAME_COL_WIDTH) / base),
    ),
  }
}

/**
 * Signature block geometry, shared by the on-screen preview and the PDF export.
 *
 * Both renderers read these numbers instead of computing their own, which is what
 * keeps "Preview = Export PDF" true. Offsets are in millimetres, font sizes in
 * points, and the two `*CenterMm` offsets are measured from the top edge of the
 * row they belong to. `leftCenterMm` / `rightCenterMm` are measured from the
 * table's left edge.
 */
export interface SignatureGeometry {
  /** Deliberate blank space between the last member row and the block. */
  gapMm: number
  /** Height of the row holding the names and their signature rules. */
  nameRowMm: number
  /** Height of the row holding the role titles. */
  roleRowMm: number
  /** `gapMm + nameRowMm + roleRowMm`; reserved before the table is flowed. */
  totalMm: number
  nameFontSizePt: number
  roleFontSizePt: number
  /** From the name row's top edge to the centre of the name text. */
  nameCenterMm: number
  /** From the name text centre down to its signature rule. */
  ruleOffsetMm: number
  /** From the role row's top edge to the centre of the role text. */
  roleCenterMm: number
  tableWidthMm: number
  /** Width available to each signature column. */
  columnWidthMm: number
  leftCenterMm: number
  rightCenterMm: number
}

/** Line height for signature text; the preview and PDF must both use this. */
const SIG_LINE_HEIGHT = 1.2
/** Blank space on each side of a name, so the rule overhangs the text. */
const SIG_RULE_PAD_MM = 2.15
/** Clearance between the name's text box and its rule. */
const SIG_RULE_GAP_MM = 0.5
/** Body-row heights of blank space kept above the signature block. */
const SIG_GAP_ROWS = 2.5

interface SignatureGeometryInput {
  fs: FontSizePreset
  tableWidthMm: number
  /** Unscaled body row height, so fit-page scaling cannot move the signatures. */
  baseBodyRowMm: number
  hasRows: boolean
}

function computeSignatureGeometry(
  input: SignatureGeometryInput,
): SignatureGeometry {
  const { fs, tableWidthMm, baseBodyRowMm, hasRows } = input

  // Signature text is deliberately exempt from fit-page scaling so it never
  // shrinks below a legible size.
  const nameFontSizePt = fs.sigFontSize
  const roleFontSizePt = Math.max(fs.smallFontSize, nameFontSizePt - 1)
  const nameRowMm = Math.max(fs.sigRowHeight, nameFontSizePt * 1.9) * PT_TO_MM
  const roleRowMm = Math.max(fs.sigRowHeight, roleFontSizePt * 1.9) * PT_TO_MM

  const gapMm = hasRows
    ? Math.max(baseBodyRowMm * SIG_GAP_ROWS, nameRowMm * 0.75)
    : 0

  const columnWidthMm = tableWidthMm / 2
  return {
    gapMm,
    nameRowMm,
    roleRowMm,
    totalMm: gapMm + nameRowMm + roleRowMm,
    nameFontSizePt,
    roleFontSizePt,
    nameCenterMm: nameRowMm / 2,
    // Half a line box below the text centre, plus the clearance above the rule.
    ruleOffsetMm:
      nameFontSizePt * 0.5 * SIG_LINE_HEIGHT * PT_TO_MM + SIG_RULE_GAP_MM,
    roleCenterMm: roleFontSizePt * 0.5 * SIG_LINE_HEIGHT * PT_TO_MM,
    tableWidthMm,
    columnWidthMm,
    leftCenterMm: columnWidthMm * 0.5,
    rightCenterMm: tableWidthMm * 0.75,
  }
}

/**
 * Shrinks a font size until `text` fits `maxWidthMm`.
 *
 * Shared so the preview and the PDF shrink a long name by the same amount. Each
 * renderer passes its own `measureMm` because only it knows its font metrics.
 */
export function fitFontSizePt(args: {
  text: string
  startSizePt: number
  maxWidthMm: number
  minSizePt?: number
  measureMm: (text: string, sizePt: number) => number
}): number {
  const { text, startSizePt, maxWidthMm, measureMm } = args
  const minSizePt = args.minSizePt ?? 6
  if (!text) return startSizePt
  let size = startSizePt
  while (size > minSizePt && measureMm(text, size) > maxWidthMm) {
    size -= 0.5
  }
  return size
}

/** Padding on each side of a name's rule, exported for the renderers. */
export const SIG_RULE_PAD = SIG_RULE_PAD_MM
/** Line height for signature text, exported for the renderers. */
export const SIG_LINE = SIG_LINE_HEIGHT
/** Rule thickness in mm; the preview's border-bottom matches the PDF's line. */
export const SIG_RULE_BORDER = 0.3
/** Clearance from a name's text box down to its rule, exported for the renderers. */
export const SIG_RULE_GAP = SIG_RULE_GAP_MM

export interface SuguanSheetLayout {
  fmt: SuguanDocFormat
  paperWidthMm: number
  paperHeightMm: number
  margins: { top: number; bottom: number; left: number; right: number }
  fs: FontSizePreset
  events: SuguanEvent[]
  totalCols: number
  rowCount: number
  noColWidthMm: number
  nameColWidthMm: number
  eventColWidthMm: number
  nameFontSize: number
  titleRowH: number
  headerRowH: number
  globalHeaderBlockH: number
  sectionLabelRowH: number
  bodyRowH: number
  /** Body font size in pt after the fit-page clamp; both renderers use this. */
  bodyFontSizePt: number
  /**
   * Signature block geometry, shared by the on-screen preview and the PDF export.
   * Neither renderer may recompute these values locally.
   */
  sig: SignatureGeometry
  headerTopY: number
  topBlockH: number
  usableTableH: number
  rowsPerPage: number
  pageCount: number
  scale: number
  sections: SuguanSheetSection[]
  pages: SheetPageBlock[][]
}

export type SheetPageBlock =
  | { kind: 'section-label'; sectionIndex: number }
  | { kind: 'member'; sectionIndex: number; rowIndex: number }
  | { kind: 'sig-gap' }
  | { kind: 'sig-name' }
  | { kind: 'sig-title' }

interface FlowOptions {
  usableTableH: number
  sectionLabelRowH: number
  bodyRowH: number
  sig: SignatureGeometry
  sections: SuguanSheetSection[]
}

function buildPageFlow(opts: FlowOptions): SheetPageBlock[][] {
  const pages: SheetPageBlock[][] = []
  let blocks: SheetPageBlock[] = []
  let cursor = 0

  const breakPage = () => {
    pages.push(blocks)
    blocks = []
    cursor = 0
  }

  opts.sections.forEach((section, si) => {
    if (cursor + opts.sectionLabelRowH > opts.usableTableH) breakPage()
    blocks.push({ kind: 'section-label', sectionIndex: si })
    cursor += opts.sectionLabelRowH

    section.rows.forEach((_row, ri) => {
      if (cursor + opts.bodyRowH > opts.usableTableH) breakPage()
      blocks.push({ kind: 'member', sectionIndex: si, rowIndex: ri })
      cursor += opts.bodyRowH
    })
  })

  if (cursor + opts.sig.totalMm > opts.usableTableH) breakPage()
  blocks.push({ kind: 'sig-gap' }, { kind: 'sig-name' }, { kind: 'sig-title' })
  cursor += opts.sig.totalMm

  pages.push(blocks)
  return pages
}

export function computeSuguanLayout(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
): SuguanSheetLayout {
  const fmt = normalizeDocFormat(docFormat)
  const dims = docPaperDimensionsMm(fmt)
  const margins = docMarginsMm(fmt)
  const fs = resolveFontSizePreset(fmt)
  const events = suguan.events ?? []
  const totalCols = 2 + events.length

  const sections = buildSections(suguan, members)
  const allNames = sections.flatMap((s) => s.rows.map((r) => r.name))
  const rowCount = allNames.length
  const nameLayout = computeNameLayout(fs, allNames)

  const usableWidthMm = dims.width - margins.left - margins.right
  const totalUnits = fs.noColWidth + nameLayout.nameColWidth + events.length * fs.eventColWidth
  const noColWidthMm = (fs.noColWidth / totalUnits) * usableWidthMm
  const nameColWidthMm = (nameLayout.nameColWidth / totalUnits) * usableWidthMm
  const eventColWidthMm = events.length > 0
    ? (fs.eventColWidth / totalUnits) * usableWidthMm
    : 0

  const titleRowH = fs.titleRowHeight * PT_TO_MM
  const headerRowH = fs.headerRowHeight * PT_TO_MM
  const globalHeaderBlockH = headerRowH * 2
  const sectionLabelRowH = fs.headerRowHeight * PT_TO_MM
  const baseBodyRowMm = Math.max(fs.rowHeight * PT_TO_MM, fs.bodyFontSize * PT_TO_MM * 1.5)
  let bodyRowH = baseBodyRowMm

  // Signature geometry is derived from the preset and the usable width only, so
  // it stays identical between the preview and the PDF and is never affected by
  // fit-page scaling.
  const sig = computeSignatureGeometry({
    fs,
    tableWidthMm: usableWidthMm,
    baseBodyRowMm,
    hasRows: rowCount > 0,
  })

  const headerTopY = margins.top + titleRowH
  const topBlockH = titleRowH + globalHeaderBlockH
  const usableTableH =
    Math.max(0, dims.height - margins.top - margins.bottom - topBlockH - sig.totalMm)

  const fitPage = fmt.scaling === 'fit-page'
  let scale = 1
  let bodyFontSizePt = nameLayout.nameFontSize

  if (fitPage && rowCount > 0) {
    const totalContentH = sections.reduce(
      (acc, s) => acc + sectionLabelRowH + s.rows.length * bodyRowH,
      0,
    )
    const needed = totalContentH + sig.totalMm
    if (needed > usableTableH) {
      scale = Math.max(0.4, usableTableH / needed)
      bodyRowH = Math.max(fs.bodyFontSize * PT_TO_MM * 1.25, bodyRowH * scale)
      bodyFontSizePt = Math.max(6, nameLayout.nameFontSize * scale)
    }
  }

  const pages = buildPageFlow({
    usableTableH,
    sectionLabelRowH,
    bodyRowH,
    sig,
    sections,
  })

  const pageCount = pages.length
  const rowsPerPage = fitPage
    ? rowCount || 1
    : Math.max(1, Math.floor(usableTableH / bodyRowH))

  return {
    fmt,
    paperWidthMm: dims.width,
    paperHeightMm: dims.height,
    margins,
    fs,
    events,
    totalCols,
    rowCount,
    noColWidthMm,
    nameColWidthMm,
    eventColWidthMm,
    nameFontSize: nameLayout.nameFontSize,
    titleRowH,
    headerRowH,
    globalHeaderBlockH,
    sectionLabelRowH,
    bodyRowH,
    bodyFontSizePt,
    sig,
    headerTopY,
    topBlockH,
    usableTableH,
    rowsPerPage,
    pageCount,
    scale,
    sections,
    pages,
  }
}

export async function exportSuguanExcel(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const period =
    suguan.coverage?.template === 'midweek-2w' ? 'MID WEEK' : 'WEEKEND'
  const sheetName = `${groupLabel(suguan.group).replace(/[()]/g, '')} - ${period}`
  const sheet = workbook.addWorksheet(sheetName ?? 'SUGUAN')

  const fmt = normalizeDocFormat(docFormat)
  const marginsMm = docMarginsMm(fmt)
  const fs = resolveFontSizePreset(fmt)

  const layout = computeSuguanLayout(suguan, members, docFormat)
  const events = suguan.events
  const totalCols = 2 + events.length
  const lastCol = totalCols

  const paperKey =
    fmt.paperSize === 'custom' ? 'letter' : fmt.paperSize

  sheet.pageSetup.orientation = fmt.orientation
  sheet.pageSetup.paperSize = EXCEL_PAPER_SIZE[paperKey]
  sheet.pageSetup.margins = {
    left: +(marginsMm.left / 25.4).toFixed(3),
    right: +(marginsMm.right / 25.4).toFixed(3),
    top: +(marginsMm.top / 25.4).toFixed(3),
    bottom: +(marginsMm.bottom / 25.4).toFixed(3),
    header: 0.2,
    footer: 0.2,
  }
  sheet.pageSetup.horizontalCentered = true
  const fitPage = fmt.scaling === 'fit-page'
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = fitPage ? 1 : 0

  const mmToExcel = (mm: number) => Math.max(3, Math.round((mm / 25.4) * 96 / 7))
  const widths = [
    mmToExcel(layout.noColWidthMm),
    mmToExcel(layout.nameColWidthMm),
    ...events.map(() => mmToExcel(layout.eventColWidthMm)),
  ]
  sheet.columns = widths.map((w, i) => ({
    width: w,
    key: `c_${i + 1}`,
  }))

  sheet.pageSetup.printTitlesRow = '1:3'

  const titleRow = 1
  const headerRow1 = 2
  const headerRow2 = 3

  sheet.mergeCells(titleRow, 1, titleRow, lastCol)
  const titleCell = sheet.getCell(titleRow, 1)
  titleCell.value = suguanSheetTitle(suguan)
  titleCell.font = { bold: true, size: fs.titleFontSize, family: 2 }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  titleCell.border = fullBorder()
  sheet.getRow(titleRow).height = fs.titleRowHeight

  events.forEach((event, i) => {
    const labelCell = sheet.getCell(headerRow1, 3 + i)
    labelCell.value = eventTypeLabel(event.type)
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${eventFill(event.type)}` } }
    labelCell.font = { bold: true, size: fs.headerFontSize }
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' }
    labelCell.border = { top: thinBorder(), left: thinBorder(), right: thinBorder(), bottom: thinBorder() }

    const dateCell = sheet.getCell(headerRow2, 3 + i)
    dateCell.value = formatEventDate(event)
    dateCell.font = { bold: true, size: fs.headerFontSize }
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${eventFill(event.type)}` } }
    dateCell.border = { top: thinBorder(), left: thinBorder(), right: thinBorder(), bottom: thinBorder() }
  })

  for (const col of [1, 2]) {
    sheet.getCell(headerRow1, col).font = { bold: true }
    sheet.getCell(headerRow1, col).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(headerRow1, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_FILL}` } }
    sheet.getCell(headerRow1, col).border = { top: thinBorder(), left: thinBorder(), right: thinBorder(), bottom: thinBorder() }
    sheet.mergeCells(headerRow1, col, headerRow2, col)
    sheet.getCell(headerRow2, col).border = { top: thinBorder(), left: thinBorder(), right: thinBorder(), bottom: thinBorder() }
  }

  sheet.getRow(headerRow1).height = fs.headerRowHeight
  sheet.getRow(headerRow2).height = fs.headerRowHeight

  sheet.getCell(headerRow1, 1).value = 'No.'
  sheet.getCell(headerRow1, 2).value = 'Pangalan'

  let rn = 4
  const sections = layout.sections
  for (let si = 0; si < sections.length; si++) {
    const section = sections[si]

    const labelCell = sheet.getCell(rn, 2)
    labelCell.value = section.label
    labelCell.font = { bold: true, size: fs.headerFontSize, family: 2 }
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }
    for (let col = 1; col <= lastCol; col++) {
      sheet.getCell(rn, col).border = fullBorder()
    }
    sheet.getRow(rn).height = fs.headerRowHeight
    rn++

    for (const row of section.rows) {
      const noCell = sheet.getCell(rn, 1)
      noCell.value = row.no
      noCell.font = { size: fs.bodyFontSize }
      noCell.alignment = { horizontal: 'center', vertical: 'middle' }
      const nameCell = sheet.getCell(rn, 2)
      nameCell.value = row.name
      nameCell.font = { size: layout.nameFontSize }
      nameCell.alignment = { horizontal: 'left', vertical: 'middle' }
      for (let col = 1; col <= lastCol; col++) {
        sheet.getCell(rn, col).border = {
          top: thinBorder(),
          left: thinBorder(),
          right: thinBorder(),
          bottom: thinBorder(),
        }
      }
      sheet.getRow(rn).height = fs.rowHeight
      rn++
    }
  }

  const { pmName, destinadoName } = resolveSignatureNames(suguan, members)
  const { sig } = layout
  // Excel row heights are in points, so convert the shared millimetre geometry.
  const sigGapPt = sig.gapMm / PT_TO_MM
  const sigNameRowPt = sig.nameRowMm / PT_TO_MM
  const sigRoleRowPt = sig.roleRowMm / PT_TO_MM

  // Breathing room so the signature block is not flush against the table above.
  sheet.getRow(rn).height = sigGapPt
  const sigRow = rn + 1
  const pmCell = sheet.getCell(sigRow, 2)
  pmCell.value = pmName || ''
  pmCell.font = { bold: true, size: sig.nameFontSizePt }
  pmCell.alignment = { horizontal: 'center', vertical: 'middle' }
  const destCell = sheet.getCell(sigRow, lastCol)
  destCell.value = destinadoName || ''
  destCell.font = { bold: true, size: sig.nameFontSizePt }
  destCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(sigRow).height = sigNameRowPt

  const pmRole = sheet.getCell(sigRow + 1, 2)
  pmRole.value = 'PANGULONG MANG-AAWIT'
  pmRole.font = { size: sig.roleFontSizePt }
  pmRole.alignment = { horizontal: 'center', vertical: 'top' }
  const destRole = sheet.getCell(sigRow + 1, lastCol)
  destRole.value = 'DESTINADO'
  destRole.font = { size: sig.roleFontSizePt }
  destRole.alignment = { horizontal: 'center', vertical: 'top' }
  sheet.getRow(sigRow + 1).height = sigRoleRowPt

  sheet.pageSetup.printArea = `A1:${colLetter(lastCol)}${sigRow + 1}`

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = suguanFileName(suguan, 'xlsx')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export interface SuguanPageEstimate {
  pages: number
  rowsPerPage: number
}

export function estimateSuguanPages(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
): SuguanPageEstimate {
  const layout = computeSuguanLayout(suguan, members, docFormat)
  return { pages: layout.pageCount, rowsPerPage: layout.rowsPerPage }
}