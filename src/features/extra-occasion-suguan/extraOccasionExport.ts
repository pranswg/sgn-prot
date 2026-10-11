import type { Member } from '@/core/types/member'
import type {
  ExtraOccasionSuguanConfig,
  Suguan,
  SuguanDocFormat,
  VoicePosition,
} from '@/core/types/suguan'
import { exportFileName } from '@/lib/exportNaming'
import {
  docMarginsMm,
  docPaperDimensionsMm,
  normalizeDocFormat,
  resolveSignatureNames,
  resolveFontSizePreset,
} from '@/lib/suguanUtils'
import {
  buildExtraOccasionSections,
  type ExtraOrganistaAssignment,
} from './extraOccasionData'

export interface ExtraOccasionExportOptions {
  suguan: Suguan
  members: Member[]
  voices: VoicePosition[]
  organistaAssignments: Record<string, ExtraOrganistaAssignment[]>
  pagsasanay: { enabled: boolean; label: string; date: string }
  pagtupad: { enabled: boolean; label: string; date: string }
  showFooterSignatories: boolean
  localeName: string
  docFormat: SuguanDocFormat
  filename?: string
}

const PAPER_CODES: Record<'a4' | 'letter' | 'legal', number> = {
  a4: 9,
  letter: 1,
  legal: 5,
}

const DATE_FILL = 'D9EAD3'

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function visibleColumns(options: ExtraOccasionExportOptions) {
  return [
    options.pagsasanay.enabled
      ? { ...options.pagsasanay, fill: 'FFF2CC' }
      : null,
    options.pagtupad.enabled ? { ...options.pagtupad, fill: DATE_FILL } : null,
  ].filter(
    (column): column is { enabled: true; label: string; date: string; fill: string } =>
      column !== null,
  )
}

function signatureNames(options: ExtraOccasionExportOptions) {
  return resolveSignatureNames(options.suguan, options.members)
}

function docDimensions(options: ExtraOccasionExportOptions) {
  const format = normalizeDocFormat(options.docFormat)
  return {
    format,
    dimensions: docPaperDimensionsMm(format),
    margins: docMarginsMm(format),
    preset: resolveFontSizePreset(format),
  }
}

export function extraOccasionExportOptionsForRecord(
  suguan: Suguan,
  members: Member[],
  voices: VoicePosition[],
): ExtraOccasionExportOptions {
  const config: ExtraOccasionSuguanConfig | undefined = suguan.extraOccasion
  if (!config) {
    throw new Error('This Suguan record does not have Extra Occasion settings.')
  }
  return {
    suguan,
    members,
    voices,
    organistaAssignments: config.organistaAssignments,
    pagsasanay: config.pagsasanay,
    pagtupad: config.pagtupad,
    showFooterSignatories: config.showFooterSignatories,
    localeName: config.localeName,
    docFormat: normalizeDocFormat(suguan.docFormat),
  }
}

function dateText(value: string): string {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${month}/${day}/${year}`
}

export async function createExtraOccasionExcelBlob(
  options: ExtraOccasionExportOptions,
): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Extra Occasion Suguan')
  const columns = visibleColumns(options)
  const columnCount = 2 + columns.length
  const sections = buildExtraOccasionSections(
    options.suguan,
    options.voices,
    options.members,
    options.organistaAssignments,
  )
  const { format, margins, preset } = docDimensions(options)
  const pageSize = format.paperSize === 'custom' ? 'letter' : format.paperSize
  sheet.pageSetup.orientation = format.orientation
  sheet.pageSetup.paperSize = PAPER_CODES[pageSize]
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = format.scaling === 'fit-page' ? 1 : 0
  sheet.pageSetup.margins = {
    left: margins.left / 25.4,
    right: margins.right / 25.4,
    top: margins.top / 25.4,
    bottom: margins.bottom / 25.4,
    header: 0.2,
    footer: 0.2,
  }
  const thin = {
    top: { style: 'thin' as const, color: { argb: 'FF8B8B8B' } },
    bottom: { style: 'thin' as const, color: { argb: 'FF8B8B8B' } },
    left: { style: 'thin' as const, color: { argb: 'FF8B8B8B' } },
    right: { style: 'thin' as const, color: { argb: 'FF8B8B8B' } },
  }
  const heading = sheet.addRow([`Lokal ng ${options.localeName.trim()}`])
  sheet.mergeCells(heading.number, 1, heading.number, columnCount)
  heading.font = { name: 'Book Antiqua', size: preset.headerFontSize }
  heading.alignment = { horizontal: 'center' }
  const title = sheet.addRow(['EXTRA OCCASION SUGUAN'])
  sheet.mergeCells(title.number, 1, title.number, columnCount)
  title.font = { name: 'Book Antiqua', size: preset.titleFontSize, bold: true }
  title.alignment = { horizontal: 'center' }

  const header = sheet.addRow([
    'Blg.',
    'PANGALAN',
    ...columns.map(({ label, date }) => `${label}\n${dateText(date)}`),
  ])
  header.height = 34
  header.font = { name: 'Book Antiqua', size: preset.headerFontSize, bold: true }
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  header.eachCell((cell, index) => {
    cell.border = thin
    if (index > 2) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${columns[index - 3].fill}` },
      }
    } else {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      }
    }
  })
  sheet.columns = [
    { width: 8 },
    { width: 38 },
    ...columns.map(() => ({ width: 20 })),
  ]
  sheet.views = [{ state: 'frozen', ySplit: header.number }]

  let number = 1
  for (const schedule of sections) {
    const scheduleRow = sheet.addRow([schedule.label])
    sheet.mergeCells(scheduleRow.number, 1, scheduleRow.number, columnCount)
    scheduleRow.font = { name: 'Book Antiqua', size: 11, bold: true }
    scheduleRow.alignment = { horizontal: 'center' }
    scheduleRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC6EFCE' },
      }
      cell.border = thin
    })

    const groups = [
      ...schedule.voiceSections.map((section) => ({
        label: section.label,
        rows: section.rows,
      })),
      ...(schedule.organistaRows.length > 0
        ? [{ label: 'ORGANISTA', rows: schedule.organistaRows }]
        : []),
    ]
    for (const group of groups) {
      const groupRow = sheet.addRow(['', group.label])
      sheet.mergeCells(groupRow.number, 2, groupRow.number, columnCount)
      groupRow.font = { name: 'Book Antiqua', size: 11, bold: true }
      groupRow.eachCell((cell) => {
        cell.border = thin
      })
      for (const row of group.rows) {
        const memberRow = sheet.addRow([
          `${number++}.`,
          row.name,
          ...columns.map(() => ''),
        ])
        memberRow.font = { name: 'Book Antiqua', size: preset.bodyFontSize }
        memberRow.eachCell((cell) => {
          cell.border = thin
        })
      }
    }
  }

  if (options.showFooterSignatories) {
    const names = signatureNames(options)
    sheet.addRow([])
    const footerValues = Array.from({ length: columnCount }, () => '')
    const otherFooterValues = Array.from({ length: columnCount }, () => '')
    const middleColumn = Math.floor(columnCount / 2)
    footerValues[0] = `${names.pmName}\n________________________\nPangulong Mang-aawit`
    otherFooterValues[middleColumn] =
      `${names.destinadoName}\n________________________\nDestinado`
    const footer = sheet.addRow(footerValues)
    const otherFooter = sheet.addRow(otherFooterValues)
    if (middleColumn > 1) {
      sheet.mergeCells(footer.number, 1, footer.number, middleColumn)
    }
    if (columnCount > middleColumn + 1) {
      sheet.mergeCells(
        otherFooter.number,
        middleColumn + 1,
        otherFooter.number,
        columnCount,
      )
    }
    footer.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    otherFooter.alignment = footer.alignment
    footer.height = 42
    otherFooter.height = 42
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  return blob
}

export async function exportExtraOccasionExcel(
  options: ExtraOccasionExportOptions,
): Promise<void> {
  const blob = await createExtraOccasionExcelBlob(options)
  downloadBlob(
    blob,
    options.filename ?? exportFileName('Extra Occasion Suguan', 'xlsx'),
  )
}

export async function createExtraOccasionDocxBlob(
  options: ExtraOccasionExportOptions,
): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Packer,
    PageOrientation,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx')
  const columns = visibleColumns(options)
  const sections = buildExtraOccasionSections(
    options.suguan,
    options.voices,
    options.members,
    options.organistaAssignments,
  )
  const { format, dimensions, margins, preset } = docDimensions(options)
  const toTwips = (mm: number) => Math.max(1, Math.round((mm * 1440) / 25.4))
  const totalWidth = toTwips(dimensions.width - margins.left - margins.right)
  const widthsMm = [
    12,
    50,
    ...columns.map(() => 100 / (columns.length || 1)),
  ]
  const shareSum = widthsMm.reduce((sum, value) => sum + value, 0)
  const widths = widthsMm.map((value) =>
    Math.round((totalWidth * value) / shareSum),
  )
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '8B8B8B',
  }
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  }
  const cell = (
    text: string,
    width: number,
    options: { bold?: boolean; fill?: string; align?: typeof AlignmentType[keyof typeof AlignmentType] } = {},
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 55, bottom: 55, left: 70, right: 70 },
      shading: options.fill
        ? { type: ShadingType.CLEAR, fill: options.fill }
        : undefined,
      children: text.split('\n').map(
        (line) =>
          new Paragraph({
            alignment: options.align ?? AlignmentType.CENTER,
            children: [
              new TextRun({
                text: line,
                bold: options.bold,
                size: Math.round(preset.bodyFontSize * 2),
              }),
            ],
          }),
      ),
    })
  const rows: InstanceType<typeof TableRow>[] = [
    new TableRow({
      tableHeader: true,
      children: [
        cell('Blg.', widths[0], { bold: true, fill: 'F2F2F2' }),
        cell('PANGALAN', widths[1], { bold: true, fill: 'F2F2F2' }),
        ...columns.map(({ label, date, fill }, index) =>
          cell(`${label}\n${dateText(date)}`, widths[index + 2], {
            bold: true,
            fill,
          }),
        ),
      ],
    }),
  ]
  let number = 1
  for (const schedule of sections) {
    rows.push(
      new TableRow({
        children: [
          cell('', widths[0], { fill: 'C6EFCE' }),
          cell(schedule.label, widths[1], {
            bold: true,
            fill: 'C6EFCE',
          }),
          ...columns.map((_, index) =>
            cell('', widths[index + 2], { fill: 'C6EFCE' }),
          ),
        ],
      }),
    )
    const groups = [
      ...schedule.voiceSections.map((section) => ({
        label: section.label,
        rows: section.rows,
      })),
      ...(schedule.organistaRows.length > 0
        ? [{ label: 'ORGANISTA', rows: schedule.organistaRows }]
        : []),
    ]
    for (const group of groups) {
      rows.push(
        new TableRow({
          children: [
            cell('', widths[0]),
            cell(group.label, widths[1], { bold: true, align: AlignmentType.LEFT }),
            ...columns.map((_, index) => cell('', widths[index + 2])),
          ],
        }),
      )
      for (const row of group.rows) {
        rows.push(
          new TableRow({
            children: [
              cell(`${number++}.`, widths[0]),
              cell(row.name, widths[1], { align: AlignmentType.LEFT }),
              ...columns.map((_, index) => cell('', widths[index + 2])),
            ],
          }),
        )
      }
    }
  }

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Lokal ng ${options.localeName.trim()}`,
          size: Math.round(preset.headerFontSize * 2),
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: 'EXTRA OCCASION SUGUAN',
          bold: true,
          size: Math.round(preset.titleFontSize * 2),
        }),
      ],
    }),
    new Table({
      width: { size: totalWidth, type: WidthType.DXA },
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      borders,
      rows,
    }),
  ]
  if (options.showFooterSignatories) {
    const names = signatureNames(options)
    const footerWidths = [Math.floor(totalWidth / 2), Math.ceil(totalWidth / 2)]
    const footerBorderNone = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    }
    children.push(
      new Paragraph({ text: '', spacing: { after: 120 } }),
      new Table({
        width: { size: totalWidth, type: WidthType.DXA },
        columnWidths: footerWidths,
        layout: TableLayoutType.FIXED,
        borders: footerBorderNone,
        rows: [
          new TableRow({
            children: [
              { name: names.pmName, role: 'Pangulong Mang-aawit' },
              { name: names.destinadoName, role: 'Destinado' },
            ].map(
              ({ name, role }, index) =>
                new TableCell({
                  width: {
                    size: footerWidths[index],
                    type: WidthType.DXA,
                  },
                  children: [
                    new Paragraph({ text: '' }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      border: {
                        bottom: {
                          style: BorderStyle.SINGLE,
                          size: 6,
                          color: '000000',
                        },
                      },
                      children: [
                        new TextRun({
                          text: name,
                          bold: true,
                          size: Math.round(preset.bodyFontSize * 2),
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: role,
                          size: Math.round(preset.smallFontSize * 2),
                        }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
        ],
      }),
    )
  }
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: toTwips(dimensions.width),
              height: toTwips(dimensions.height),
              orientation:
                format.orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: toTwips(margins.top),
              bottom: toTwips(margins.bottom),
              left: toTwips(margins.left),
              right: toTwips(margins.right),
            },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBlob(doc)
}

export async function exportExtraOccasionDocx(
  options: ExtraOccasionExportOptions,
): Promise<void> {
  const blob = await createExtraOccasionDocxBlob(options)
  downloadBlob(
    blob,
    options.filename ?? exportFileName('Extra Occasion Suguan', 'docx'),
  )
}

export async function createExtraOccasionPdfBlob(
  options: ExtraOccasionExportOptions,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const columns = visibleColumns(options)
  const sections = buildExtraOccasionSections(
    options.suguan,
    options.voices,
    options.members,
    options.organistaAssignments,
  )
  const { format, dimensions, margins, preset } = docDimensions(options)
  const pdf = new jsPDF({
    orientation: format.orientation,
    unit: 'mm',
    format: [dimensions.width, dimensions.height],
  })
  const pageWidth = dimensions.width
  const pageHeight = dimensions.height
  const contentWidth = pageWidth - margins.left - margins.right
  const nameShare = columns.length === 0 ? 91 : 48
  const eventShare = columns.length > 0 ? (91 - nameShare) / columns.length : 0
  const columnWidths = [9, nameShare, ...columns.map(() => eventShare)].map(
    (share) => (contentWidth * share) / 100,
  )
  const rowHeight = Math.max(7, preset.rowHeight * 25.4 / 72)
  const headerHeight = rowHeight * (columns.length > 0 ? 2 : 1)
  const bottomReserve = options.showFooterSignatories ? 36 : margins.bottom
  let y = margins.top
  let number = 1
  const newPage = () => {
    pdf.addPage([dimensions.width, dimensions.height], format.orientation)
    y = margins.top
    drawHeading()
    drawTableHeader()
  }
  const drawHeading = () => {
    pdf.setFont('times', 'normal')
    pdf.setFontSize(preset.headerFontSize)
    pdf.text(`Lokal ng ${options.localeName.trim()}`, pageWidth / 2, y + 4, {
      align: 'center',
    })
    y += 7
    pdf.setFont('times', 'bold')
    pdf.setFontSize(preset.titleFontSize)
    pdf.text('EXTRA OCCASION SUGUAN', pageWidth / 2, y + 4, {
      align: 'center',
    })
    y += 9
  }
  const drawTableHeader = () => {
    const labels = ['Blg.', 'PANGALAN', ...columns.map((column) => column.label)]
    let x = margins.left
    pdf.setFont('times', 'bold')
    pdf.setFontSize(preset.smallFontSize)
    labels.forEach((label, index) => {
      const width = columnWidths[index]
      if (index > 1) {
        const color = columns[index - 2].fill
        pdf.setFillColor(
          parseInt(color.slice(0, 2), 16),
          parseInt(color.slice(2, 4), 16),
          parseInt(color.slice(4, 6), 16),
        )
        pdf.rect(x, y, width, headerHeight, 'F')
      }
      pdf.rect(x, y, width, headerHeight)
      pdf.text(label, x + width / 2, y + 3, {
        align: 'center',
        maxWidth: width - 1,
      })
      if (index > 1) {
        pdf.setFont('times', 'normal')
        pdf.text(dateText(columns[index - 2].date), x + width / 2, y + rowHeight + 3, {
          align: 'center',
          maxWidth: width - 1,
        })
        pdf.setFont('times', 'bold')
      }
      x += width
    })
    y += headerHeight
  }
  const drawMergedRow = (text: string, bold = true) => {
    if (y + rowHeight > pageHeight - bottomReserve) newPage()
    pdf.setFillColor(198, 239, 206)
    pdf.rect(margins.left, y, contentWidth, rowHeight, 'F')
    pdf.rect(margins.left, y, contentWidth, rowHeight)
    pdf.setFont('times', bold ? 'bold' : 'normal')
    pdf.setFontSize(preset.bodyFontSize)
    pdf.text(text, pageWidth / 2, y + rowHeight * 0.68, {
      align: 'center',
      maxWidth: contentWidth - 2,
    })
    y += rowHeight
  }
  const drawPersonRow = (numberText: string, name: string) => {
    if (y + rowHeight > pageHeight - bottomReserve) newPage()
    const values = [numberText, name, ...columns.map(() => '')]
    let x = margins.left
    pdf.setFont('times', 'normal')
    pdf.setFontSize(preset.bodyFontSize)
    values.forEach((value, index) => {
      const width = columnWidths[index]
      pdf.rect(x, y, width, rowHeight)
      if (value) {
        pdf.text(value, index === 1 ? x + 1.5 : x + width / 2, y + rowHeight * 0.68, {
          align: index === 1 ? 'left' : 'center',
          maxWidth: width - 2,
        })
      }
      x += width
    })
    y += rowHeight
  }

  drawHeading()
  drawTableHeader()
  for (const schedule of sections) {
    drawMergedRow(schedule.label)
    const groups = [
      ...schedule.voiceSections.map((section) => ({
        label: section.label,
        rows: section.rows,
      })),
      ...(schedule.organistaRows.length > 0
        ? [{ label: 'ORGANISTA', rows: schedule.organistaRows }]
        : []),
    ]
    for (const group of groups) {
      drawPersonRow('', group.label)
      for (const row of group.rows) {
        drawPersonRow(`${number++}.`, row.name)
      }
    }
  }
  if (options.showFooterSignatories) {
    const names = signatureNames(options)
    const signatureTop = Math.max(y + 8, pageHeight - margins.bottom - 24)
    const centerLeft = margins.left + contentWidth * 0.25
    const centerRight = margins.left + contentWidth * 0.75
    for (const [center, name, role] of [
      [centerLeft, names.pmName, 'Pangulong Mang-aawit'],
      [centerRight, names.destinadoName, 'Destinado'],
    ] as const) {
      pdf.setFont('times', 'bold')
      pdf.setFontSize(preset.bodyFontSize)
      pdf.text(name, center, signatureTop, { align: 'center', maxWidth: contentWidth / 2 - 5 })
      pdf.setLineWidth(0.25)
      pdf.line(center - 30, signatureTop + 2, center + 30, signatureTop + 2)
      pdf.setFont('times', 'normal')
      pdf.setFontSize(preset.smallFontSize)
      pdf.text(role, center, signatureTop + 6, { align: 'center' })
    }
  }
  return pdf.output('blob')
}

export async function exportExtraOccasionPdf(
  options: ExtraOccasionExportOptions,
): Promise<void> {
  const blob = await createExtraOccasionPdfBlob(options)
  downloadBlob(
    blob,
    options.filename ?? exportFileName('Extra Occasion Suguan', 'pdf'),
  )
}
