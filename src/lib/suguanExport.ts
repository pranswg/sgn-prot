import type { Suguan, SuguanEvent, SuguanEventType, SuguanDocFormat } from '@/core/types/suguan'
import {
  assignmentDisplayName,
  docMarginsMm,
  docPaperDimensionsMm,
  eventTypeLabel,
  FONT_SIZE_PRESETS,
  formatEventDate,
  groupLabel,
  normalizeDocFormat,
  resolveSignatureNames,
  suguanFileName,
  suguanTitle,
  type FontSizePreset,
} from '@/lib/suguanUtils'

const PAGSASANAY_FILL = 'FFF2CC'
const PAGTUPAD_FILL = 'D9EAD3'
const HEADER_FILL = 'F2F2F2'

const PT_TO_MM = 25.4 / 72

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

export function buildSections(
  suguan: Suguan,
  members: SheetMembers[],
): SuguanSheetSection[] {
  const schedules =
    Array.isArray(suguan.schedules) && suguan.schedules.length > 0
      ? suguan.schedules
      : []
  const mapRows = (assignments: Suguan['assignments']) =>
    assignments.map((a, i) => ({
      no: i + 1,
      name: assignmentDisplayName(a.memberName, a.memberId, members),
    }))
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
      label:
        suguan.eventTitle?.trim() ||
        (suguan.type === 'special' ? 'SPECIAL OCCASION' : groupLabel(suguan.group)),
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
  groupRowH: number
  headerRowH: number
  globalHeaderBlockH: number
  sectionLabelRowH: number
  bodyRowH: number
  sigRowH: number
  sigGapH: number
  headerTopY: number
  topBlockH: number
  sigBlockH: number
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
  sigGapH: number
  sigRowH: number
  sigBlockH: number
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

  if (cursor + opts.sigBlockH > opts.usableTableH) breakPage()
  blocks.push({ kind: 'sig-gap' }, { kind: 'sig-name' }, { kind: 'sig-title' })
  cursor += opts.sigBlockH

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
  const fs = FONT_SIZE_PRESETS[fmt.fontSize]
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
  const groupRowH = (fs.headerRowHeight + 4) * PT_TO_MM
  const headerRowH = fs.headerRowHeight * PT_TO_MM
  const globalHeaderBlockH = headerRowH * 2
  const sectionLabelRowH = fs.headerRowHeight * PT_TO_MM
  let bodyRowH = Math.max(fs.rowHeight * PT_TO_MM, fs.bodyFontSize * PT_TO_MM * 1.5)
  const sigRowH = fs.sigRowHeight * PT_TO_MM
  const sigGapH = rowCount > 0 ? Math.max(fs.rowHeight * PT_TO_MM, fs.bodyFontSize * PT_TO_MM) : 0

  const headerTopY = margins.top + titleRowH + groupRowH
  const topBlockH = titleRowH + groupRowH + globalHeaderBlockH
  const sigBlockH = sigGapH + sigRowH * 2
  const usableTableH =
    Math.max(0, dims.height - margins.top - margins.bottom - topBlockH - sigBlockH)

  const fitPage = fmt.scaling === 'fit-page'
  let scale = 1

  if (fitPage && rowCount > 0) {
    const totalContentH = sections.reduce(
      (acc, s) => acc + sectionLabelRowH + s.rows.length * bodyRowH,
      0,
    )
    const needed = totalContentH + sigBlockH
    if (needed > usableTableH) {
      scale = Math.max(0.4, usableTableH / needed)
      bodyRowH = Math.max(fs.bodyFontSize * PT_TO_MM * 1.25, bodyRowH * scale)
    }
  }

  const pages = buildPageFlow({
    usableTableH,
    sectionLabelRowH,
    bodyRowH,
    sigGapH,
    sigRowH,
    sigBlockH,
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
    groupRowH,
    headerRowH,
    globalHeaderBlockH,
    sectionLabelRowH,
    bodyRowH,
    sigRowH,
    sigGapH,
    headerTopY,
    topBlockH,
    sigBlockH,
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
    suguan.type === 'regular' && suguan.coverage?.template === 'midweek-2w'
      ? 'MID WEEK'
      : 'WEEKEND'
  const sheetName = `${groupLabel(suguan.group).replace(/[()]/g, '')} - ${period}`
  const sheet = workbook.addWorksheet(sheetName ?? 'SUGUAN')

  const fmt = normalizeDocFormat(docFormat)
  const marginsMm = docMarginsMm(fmt)
  const fs = FONT_SIZE_PRESETS[fmt.fontSize]

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

  sheet.pageSetup.printTitlesRow = '1:4'

  const titleRow = 1
  const groupRow = 2
  const headerRow1 = 3
  const headerRow2 = 4

  sheet.mergeCells(titleRow, 1, titleRow, lastCol)
  const titleCell = sheet.getCell(titleRow, 1)
  titleCell.value = suguanTitle(suguan)
  titleCell.font = { bold: true, size: fs.titleFontSize, family: 2 }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  titleCell.border = { top: thinBorder(), bottom: thinBorder() }
  sheet.getRow(titleRow).height = fs.titleRowHeight

  sheet.mergeCells(groupRow, 1, groupRow, lastCol)
  const groupCell = sheet.getCell(groupRow, 1)
  groupCell.value = groupLabel(suguan.group)
  groupCell.font = { bold: true, size: fs.headerFontSize }
  groupCell.alignment = { horizontal: 'center', vertical: 'middle' }
  groupCell.border = { bottom: thinBorder() }
  sheet.getRow(groupRow).height = fs.headerRowHeight + 4

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

  let rn = 5
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
  const sigRow = rn + 1
  const pmCell = sheet.getCell(sigRow, 2)
  pmCell.value = pmName || ''
  pmCell.font = { bold: true, size: fs.bodyFontSize }
  pmCell.alignment = { horizontal: 'center', vertical: 'middle' }
  const destCell = sheet.getCell(sigRow, lastCol)
  destCell.value = destinadoName || ''
  destCell.font = { bold: true, size: fs.bodyFontSize }
  destCell.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(sigRow).height = fs.sigRowHeight

  const pmRole = sheet.getCell(sigRow + 1, 2)
  pmRole.value = 'PANGULONG MANG-AAWIT'
  pmRole.font = { size: fs.smallFontSize }
  pmRole.alignment = { horizontal: 'center' }
  const destRole = sheet.getCell(sigRow + 1, lastCol)
  destRole.value = 'DESTINADO'
  destRole.font = { size: fs.smallFontSize }
  destRole.alignment = { horizontal: 'center' }
  sheet.getRow(sigRow + 1).height = fs.sigRowHeight

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