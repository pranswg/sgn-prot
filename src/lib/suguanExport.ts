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
  sectionHeaderRowH: number
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
  | { kind: 'section-header'; sectionIndex: number }
  | { kind: 'member'; sectionIndex: number; rowIndex: number }
  | { kind: 'sig-gap' }
  | { kind: 'sig-name' }
  | { kind: 'sig-title' }

interface FlowOptions {
  usableTableH: number
  sectionLabelRowH: number
  sectionHeaderRowH: number
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

  const heightOf = (b: SheetPageBlock): number =>
    b.kind === 'section-label'
      ? opts.sectionLabelRowH
      : b.kind === 'section-header'
        ? opts.sectionHeaderRowH
        : b.kind === 'member'
          ? opts.bodyRowH
          : b.kind === 'sig-gap'
            ? opts.sigGapH
            : opts.sigRowH

  const breakPage = (starter: SheetPageBlock[] = []) => {
    pages.push(blocks)
    blocks = [...starter]
    cursor = starter.reduce((acc, b) => acc + heightOf(b), 0)
  }

  opts.sections.forEach((section, si) => {
    if (cursor + opts.sectionLabelRowH > opts.usableTableH) breakPage()
    blocks.push({ kind: 'section-label', sectionIndex: si })
    cursor += opts.sectionLabelRowH

    if (cursor + opts.sectionHeaderRowH > opts.usableTableH) {
      breakPage([
        { kind: 'section-label', sectionIndex: si },
        { kind: 'section-header', sectionIndex: si },
      ])
    } else {
      blocks.push({ kind: 'section-header', sectionIndex: si })
      cursor += opts.sectionHeaderRowH
    }

    section.rows.forEach((_row, ri) => {
      if (cursor + opts.bodyRowH > opts.usableTableH) {
        breakPage([
          { kind: 'section-label', sectionIndex: si },
          { kind: 'section-header', sectionIndex: si },
        ])
      }
      blocks.push({ kind: 'member', sectionIndex: si, rowIndex: ri })
      cursor += opts.bodyRowH
    })
  })

  if (blocks.length > 0 || pages.length === 0) {
    if (cursor + opts.sigBlockH <= opts.usableTableH) {
      blocks.push({ kind: 'sig-gap' }, { kind: 'sig-name' }, { kind: 'sig-title' })
      cursor += opts.sigBlockH
    } else {
      breakPage()
      blocks.push({ kind: 'sig-gap' }, { kind: 'sig-name' }, { kind: 'sig-title' })
      cursor += opts.sigBlockH
    }
  }

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
  const sectionLabelRowH = (fs.headerRowHeight + 12) * PT_TO_MM
  const sectionHeaderRowH = fs.headerRowHeight * PT_TO_MM
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
      (acc, s) => acc + sectionLabelRowH + sectionHeaderRowH + s.rows.length * bodyRowH,
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
    sectionHeaderRowH,
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
    sectionHeaderRowH,
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

    sheet.mergeCells(rn, 1, rn, lastCol)
    const labelCell = sheet.getCell(rn, 1)
    labelCell.value = section.label
    labelCell.font = { bold: true, size: fs.headerFontSize, family: 2 }
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } }
    labelCell.border = { top: thinBorder(), bottom: thinBorder() }
    sheet.getRow(rn).height = fs.headerRowHeight + 10
    rn++

    for (const col of [1, 2]) {
      sheet.getCell(rn, col).font = { bold: true }
      sheet.getCell(rn, col).alignment = { horizontal: 'center', vertical: 'middle' }
      sheet.getCell(rn, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_FILL}` } }
      sheet.getCell(rn, col).border = { top: thinBorder(), left: thinBorder(), right: thinBorder(), bottom: thinBorder() }
    }
    sheet.getCell(rn, 1).value = 'No.'
    sheet.getCell(rn, 2).value = 'Pangalan'
    events.forEach((event, i) => {
      const cell = sheet.getCell(rn, 3 + i)
      cell.value = eventTypeLabel(event.type)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${eventFill(event.type)}` } }
      cell.font = { bold: true, size: fs.headerFontSize }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { top: thinBorder(), left: thinBorder(), right: thinBorder(), bottom: thinBorder() }
    })
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

export async function exportSuguanPdf(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const fmt = normalizeDocFormat(docFormat)
  const dims = docPaperDimensionsMm(fmt)
  const marginsMm = docMarginsMm(fmt)
  const fs = FONT_SIZE_PRESETS[fmt.fontSize]
  const layout = computeSuguanLayout(suguan, members, docFormat)

  const doc = new jsPDF({
    orientation: fmt.orientation,
    unit: 'mm',
    format: [dims.width, dims.height],
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = marginsMm.left

  const titleFontSize = fs.titleFontSize * layout.scale
  const headerFontSize = fs.headerFontSize * layout.scale
  const bodyFontSize = fs.bodyFontSize * layout.scale
  const smallFontSize = fs.smallFontSize * layout.scale

  const events = suguan.events
  const noW = layout.noColWidthMm
  const nameW = layout.nameColWidthMm
  const eventW = events.length > 0 ? layout.eventColWidthMm : 0
  const noNameW = noW + nameW
  const globalHeaderTop = marginsMm.top + layout.titleRowH + layout.groupRowH
  const sectionStartY = globalHeaderTop + layout.globalHeaderBlockH

  const drawPreamble = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(titleFontSize)
    const titleLines = doc.splitTextToSize(
      suguanTitle(suguan),
      pageWidth - marginX * 2,
    )
    const titleY = marginsMm.top + layout.titleRowH / 2
    doc.text(titleLines, pageWidth / 2, titleY, { align: 'center' })

    doc.setFontSize(headerFontSize)
    const groupY = titleY + layout.titleRowH / 2 + layout.groupRowH / 2
    doc.text(groupLabel(suguan.group), pageWidth / 2, groupY, {
      align: 'center',
    })

    const h = layout.headerRowH
    doc.setFillColor(74, 85, 104)
    doc.setDrawColor(64, 64, 64)
    doc.setLineWidth(0.15)
    doc.rect(marginX, globalHeaderTop, noNameW, h * 2, 'FD')
    if (eventW > 0 && events.length > 0) {
      events.forEach((_e, i) => {
        const ex = marginX + noNameW + i * eventW
        doc.rect(ex, globalHeaderTop, eventW, h, 'FD')
        doc.rect(ex, globalHeaderTop + h, eventW, h, 'FD')
      })
    }

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(headerFontSize)
    doc.text('No.', marginX + noW / 2, globalHeaderTop + h, {
      align: 'center',
      baseline: 'middle',
    })
    doc.text('Pangalan', marginX + noW + nameW / 2, globalHeaderTop + h, {
      align: 'center',
      baseline: 'middle',
    })
    if (eventW > 0 && events.length > 0) {
      events.forEach((e, i) => {
        const ex = marginX + noNameW + i * eventW
        doc.text(eventTypeLabel(e.type), ex + eventW / 2, globalHeaderTop + h, {
          align: 'center',
          baseline: 'middle',
        })
        doc.text(formatEventDate(e), ex + eventW / 2, globalHeaderTop + h * 2, {
          align: 'center',
          baseline: 'middle',
        })
      })
    }
    doc.setTextColor(20, 20, 20)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(bodyFontSize)
  const allNames = layout.sections.flatMap((s) => s.rows.map((r) => r.name))
  const longestName = allNames.reduce(
    (m, r) => (doc.getTextWidth(r) > doc.getTextWidth(m) ? r : m),
    '',
  )
  const longestNameW = doc.getTextWidth(longestName)
  let nameFontSize = bodyFontSize
  if (longestNameW > nameW * (72 / 25.4)) {
    nameFontSize = Math.max(6 * layout.scale, bodyFontSize * ((nameW * (72 / 25.4)) / longestNameW))
  }

  const sectionHead: (string | number)[] = [
    'No.',
    'Pangalan',
    ...events.map((e) => eventTypeLabel(e.type)),
  ]

  const baseTable = (
    startY: number,
    body: (string | number)[][],
    didDrawPage: () => void,
  ) => {
    autoTable(doc, {
      startY,
      margin: {
        left: marginX,
        right: marginsMm.right,
        top: sectionStartY,
        bottom: marginsMm.bottom,
      },
      theme: 'grid',
      styles: {
        fontSize: nameFontSize,
        cellPadding: fs.cellPadding,
        lineColor: [64, 64, 64],
        lineWidth: 0.15,
        minCellHeight: layout.bodyRowH,
        textColor: [20, 20, 20],
      },
      head: [sectionHead],
      headStyles: {
        fillColor: [74, 85, 104],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: headerFontSize,
        minCellHeight: layout.sectionHeaderRowH,
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          const labelCol = data.column.index
          if (labelCol >= 2) {
            const idx = labelCol - 2
            const event = events[idx]
            const fill = event?.type === 'pagsasanay' ? 'FFF2CC' : 'D9EAD3'
            data.cell.styles.fillColor = fill
            data.cell.styles.textColor = [20, 20, 20]
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.halign = 'center'
            data.cell.styles.valign = 'middle'
          }
          if (labelCol === 0 || labelCol === 1) {
            data.cell.styles.fillColor = 'F2F2F2'
          }
        }
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: noW },
        1: { cellWidth: nameW },
      },
      ...(events.length > 0
        ? events.reduce<Record<number, { halign: 'center'; cellWidth: number }>>(
            (acc, _e, i) => {
              acc[i + 2] = { halign: 'center', cellWidth: eventW }
              return acc
            },
            {},
          )
        : {}),
      body,
      bodyStyles: { minCellHeight: layout.bodyRowH },
      alternateRowStyles: {},
      showHead: 'everyPage',
      didDrawPage,
    })
  }

  const finalY = (): number =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    sectionStartY

  baseTable(
    sectionStartY,
    layout.sections[0]?.rows.map((r) => [r.no, r.name, ...events.map(() => '')]) ?? [],
    () => {
      drawPreamble()
    },
  )

  let currentY = finalY()

  for (let si = 1; si < layout.sections.length; si++) {
    const section = layout.sections[si]
    currentY += 6

    if (currentY + layout.sectionLabelRowH > pageHeight - marginsMm.bottom) {
      doc.addPage([dims.width, dims.height], fmt.orientation)
      drawPreamble()
      currentY = sectionStartY + 6
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(headerFontSize)
    doc.text(section.label, marginX, currentY)
    doc.setFont('helvetica', 'normal')
    doc.setDrawColor(210)
    doc.setLineWidth(0.3)
    doc.line(marginX, currentY + 1, pageWidth - marginX, currentY + 1)

    baseTable(
      currentY + 5,
      section.rows.map((r) => [r.no, r.name, ...events.map(() => '')]),
      () => {
        drawPreamble()
      },
    )

    currentY = finalY()
  }

  const { pmName, destinadoName } = resolveSignatureNames(suguan, members)

  let bottomY: number
  if (currentY + layout.sigBlockH < pageHeight - marginsMm.bottom) {
    bottomY = currentY + layout.sigGapH + layout.sigRowH / 2
  } else {
    doc.addPage([dims.width, dims.height], fmt.orientation)
    drawPreamble()
    bottomY = sectionStartY + 10
  }

  const colCenters = [pageWidth / 2 - 55, pageWidth / 2 + 55]
  const names = [pmName, destinadoName]
  const underlineWmm = 36

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(bodyFontSize)
  for (let i = 0; i < 2; i++) {
    doc.text(names[i] || '', colCenters[i], bottomY, { align: 'center' })
    doc.setDrawColor(20)
    doc.setLineWidth(0.4)
    doc.line(
      colCenters[i] - underlineWmm / 2,
      bottomY + 1.5,
      colCenters[i] + underlineWmm / 2,
      bottomY + 1.5,
    )
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(smallFontSize)
  doc.text('PANGULONG MANG-AAWIT', colCenters[0], bottomY + 5, {
    align: 'center',
  })
  doc.text('DESTINADO', colCenters[1], bottomY + 5, { align: 'center' })

  doc.save(suguanFileName(suguan, 'pdf'))
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