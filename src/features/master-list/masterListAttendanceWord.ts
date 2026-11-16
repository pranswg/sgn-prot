import type { FileChild } from 'docx'
import type { SuguanDocFormat } from '@/core/types/suguan'
import type { MasterListAttendanceOptions } from './masterListAttendancePdf'
import {
  attendanceNameFontSize,
  buildMasterListAttendanceSheets,
  fitAttendanceRowHeights,
  formatAttendanceDateSummary,
  paginateMasterListAttendanceRows,
} from './masterListAttendance'
import { createAttendanceDatePanels } from '@/lib/attendanceDatePanels'
import { formatDateKeyNumeric, isDateKey } from '@/lib/phDate'
import { docMarginsMm, docPaperDimensionsMm, normalizeDocFormat } from '@/lib/suguanUtils'

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

export async function exportMasterListAttendanceWord(
  options: MasterListAttendanceOptions,
): Promise<void> {
  const blob = await createMasterListAttendanceWordBlob(options)
  downloadBlob(blob, options.filename)
}

export async function createMasterListAttendanceWordBlob(
  options: MasterListAttendanceOptions,
): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    PageBreak,
    Packer,
    PageOrientation,
    Paragraph,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import('docx')
  const {
    members,
    trainees,
    voices,
    dates,
    title,
    groupByVoice,
    selectedVoiceIds,
    includeNagsasanayMen,
    includeNagsasanayWomen,
    separateChoirs,
    lastNameFirst,
    docFormat,
    choir,
    pangulongName,
  } = options

  if (!title.trim()) throw new Error('Enter a title for the attendance sheet.')
  if (choir === 'aws' && !pangulongName.trim()) {
    throw new Error('Select an active Pangulong Mang-aawit for the signatory.')
  }
  if (dates.length === 0 || dates.some((date) => !isDateKey(date))) {
    throw new Error('Add at least one valid attendance date.')
  }
  const format: SuguanDocFormat = normalizeDocFormat(docFormat)
  const dimensions = docPaperDimensionsMm(format)
  const margins = docMarginsMm(format)

  const sheets = buildMasterListAttendanceSheets(
    members,
    voices,
    groupByVoice ? selectedVoiceIds : null,
    trainees,
    includeNagsasanayMen,
    includeNagsasanayWomen,
    lastNameFirst,
    choir,
    separateChoirs,
  )
  if (sheets.every((sheet) => sheet.rows.length === 0)) {
    throw new Error('There are no active members or selected trainees to include.')
  }

  const datePanels = createAttendanceDatePanels(
    [...new Set(dates)].sort((left, right) => left.localeCompare(right)),
  )

  const toPt = (mm: number) => (mm * 72) / 25.4
  const pageWidthPt =
    (format.orientation === 'landscape'
      ? dimensions.height
      : dimensions.width) *
    72 /
    25.4
  const pageHeightPt =
    (format.orientation === 'landscape'
      ? dimensions.width
      : dimensions.height) *
    72 /
    25.4
  const marginTopPt = toPt(margins.top)
  const marginBottomPt = toPt(margins.bottom)
  const marginLeftPt = toPt(margins.left)
  const marginRightPt = toPt(margins.right)
  const pageBottomPt = pageHeightPt - marginBottomPt
  const tableWidthPt = pageWidthPt - marginLeftPt - marginRightPt
  const numberWidthPt = 34
  const titleLines = Math.max(
    1,
    Math.ceil((title.trim().length * 10) / tableWidthPt),
  )
  const dateSummaryTopPt = marginTopPt + titleLines * 23 + 9
  const choirLabelTopPt = dateSummaryTopPt + 16
  const choirLabelFontSize = 14
  const continuationTableTopPt = marginTopPt
  const tableHeaderHeightPt = 36
  const nameFontSize = attendanceNameFontSize(format)
  const nameSpacing =
    (format.tableSpacingBeforePt ?? 0) + (format.tableSpacingAfterPt ?? 0)
  const baseMemberRowHeight = Math.max(26, nameFontSize * 1.8)
  const baseSectionRowHeight = 22
  const signatureReservePt = 20 + 30 + (choir === 'aws' ? 54 : 0)
  const firstPageHeightFor = (tableTopPt: number) =>
    pageBottomPt - tableTopPt - tableHeaderHeightPt - 32
  const firstFinalPageHeightFor = (tableTopPt: number) =>
    pageBottomPt - signatureReservePt - tableTopPt - tableHeaderHeightPt
  const continuationPageHeight =
    pageBottomPt - continuationTableTopPt - tableHeaderHeightPt - 32
  const continuationFinalPageHeight =
    pageBottomPt -
    signatureReservePt -
    continuationTableTopPt -
    tableHeaderHeightPt

  const plans = sheets.map((sheet) => {
    const tableTopPt = sheet.label
      ? choirLabelTopPt + 17
      : dateSummaryTopPt + 16
    const fit = fitAttendanceRowHeights(
      sheet.rows,
      firstFinalPageHeightFor(tableTopPt),
      baseMemberRowHeight,
      baseSectionRowHeight,
      format.scaling,
    )
    const memberRowHeight = fit.memberRowHeight + nameSpacing
    const sectionRowHeight = fit.sectionRowHeight
    const rowPages = paginateMasterListAttendanceRows(
      sheet.rows,
      continuationPageHeight,
      continuationFinalPageHeight,
      memberRowHeight,
      sectionRowHeight,
      {
        height: firstPageHeightFor(tableTopPt),
        finalHeight: firstFinalPageHeightFor(tableTopPt),
      },
    )
    return { sheet, tableTopPt, memberRowHeight, sectionRowHeight, rowPages }
  })
  const totalPages = plans.reduce(
    (total, plan) => total + datePanels.length * plan.rowPages.length,
    0,
  )

  const toTwips = (points: number) => Math.max(1, Math.round(points * 20))
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '282828',
  }
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  }
  const children: FileChild[] = []
  let pageIndex = 0
  plans.forEach((plan) => {
    let sheetPage = 0
    datePanels.forEach((panel) => {
      const nameWidthPt =
        panel.length === 1
          ? tableWidthPt - numberWidthPt - 64
          : Math.min(180, tableWidthPt * 0.34)
      const dateWidthPt =
        (tableWidthPt - numberWidthPt - nameWidthPt) / panel.length
      const columnWidthsPt = [
        numberWidthPt,
        nameWidthPt,
        ...panel.map(() => dateWidthPt),
      ]
      const columnWidths = columnWidthsPt.map(toTwips)
      const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0)
      const cell = (
        text: string,
        width: number,
        settings: {
          bold?: boolean
          fill?: string
          align?: (typeof AlignmentType)[keyof typeof AlignmentType]
          fontSize?: number
        } = {},
      ) =>
        new TableCell({
          width: { size: width, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 45, bottom: 45, left: 65, right: 65 },
          shading: settings.fill ? { fill: settings.fill } : undefined,
          borders,
          children: [
            new Paragraph({
              alignment: settings.align ?? AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text,
                  bold: settings.bold,
                  size: (settings.fontSize ?? 9) * 2,
                  font: 'Book Antiqua',
                }),
              ],
            }),
          ],
        })

      plan.rowPages.forEach((pageRows) => {
        pageIndex += 1
        sheetPage += 1
        const tableRows = [
          new TableRow({
            tableHeader: true,
            cantSplit: true,
            height: { value: toTwips(tableHeaderHeightPt), rule: 'exact' },
            children: [
              cell('Blg.', columnWidths[0], {
                bold: true,
                fill: 'EFF2F5',
                fontSize: 11,
              }),
              cell('Pangalan', columnWidths[1], {
                bold: true,
                fill: 'EFF2F5',
                fontSize: 11,
              }),
              ...panel.map((date, index) =>
                new TableCell({
                  width: { size: columnWidths[index + 2], type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  // Tight top/bottom padding keeps the date and "Lagda" a
                  // single pair instead of two spaced lines.
                  margins: { top: 20, bottom: 20, left: 65, right: 65 },
                  shading: { fill: 'EFF2F5' },
                  borders,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        new TextRun({
                          text: formatDateKeyNumeric(date),
                          bold: true,
                          size: 16,
                          font: 'Book Antiqua',
                        }),
                      ],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 0, after: 0 },
                      children: [
                        new TextRun({
                          text: 'Lagda',
                          size: 16,
                          font: 'Book Antiqua',
                        }),
                      ],
                    }),
                  ],
                }),
              ),
            ],
          }),
          ...pageRows.map((row) => {
            if (row.kind === 'section') {
              return new TableRow({
                cantSplit: true,
                height: {
                  value: toTwips(plan.sectionRowHeight),
                  rule: 'exact',
                },
                children: [
                  new TableCell({
                    columnSpan: columnWidths.length,
                    width: { size: totalWidth, type: WidthType.DXA },
                    shading: { fill: 'F8F8F8' },
                    borders,
                    margins: { top: 35, bottom: 35, left: 100, right: 65 },
                    children: [
                      new Paragraph({
                        spacing: { before: 0, after: 0 },
                        children: [
                          new TextRun({
                            text: row.label,
                            bold: true,
                            size: 18,
                            font: 'Book Antiqua',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              })
            }
            return new TableRow({
              cantSplit: true,
              height: {
                value: toTwips(plan.memberRowHeight),
                rule: 'exact',
              },
              children: [
                cell(String(row.number), columnWidths[0], { fontSize: 8 }),
                cell(row.name, columnWidths[1], {
                  align: AlignmentType.LEFT,
                  fontSize: nameFontSize,
                }),
                ...panel.map((_, index) => cell('', columnWidths[index + 2])),
              ],
            })
          }),
        ]

        if (sheetPage === 1) {
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 120 },
              children: [
                new TextRun({
                  text: title.trim(),
                  bold: true,
                  size: 36,
                  font: 'Book Antiqua',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              // The choir label reads as a second title line, directly under
              // the dates, so it adds no gap of its own.
              spacing: { before: 0, after: plan.sheet.label ? 0 : 320 },
              children: [
                new TextRun({
                  text: formatAttendanceDateSummary(dates),
                  size: 24,
                  font: 'Book Antiqua',
                }),
              ],
            }),
          )
          if (plan.sheet.label) {
            children.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                // No gap under the label: the table follows its line directly.
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: plan.sheet.label,
                    bold: true,
                    size: choirLabelFontSize * 2,
                    font: 'Book Antiqua',
                  }),
                ],
              }),
            )
          }
        }
        children.push(
          new Table({
            width: { size: totalWidth, type: WidthType.DXA },
            columnWidths,
            layout: TableLayoutType.FIXED,
            borders,
            rows: tableRows,
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: `${pageIndex} / ${totalPages}`,
                size: 14,
                font: 'Book Antiqua',
              }),
            ],
          }),
        )

        if (pageIndex === totalPages && choir === 'aws') {
          const pageRowsHeight = pageRows.reduce(
            (height, row) =>
              height +
              (row.kind === 'section'
                ? plan.sectionRowHeight
                : plan.memberRowHeight),
            0,
          )
          const lastPageTableTopPt =
            sheetPage === 1 ? plan.tableTopPt : continuationTableTopPt
          const tableBottomPt =
            lastPageTableTopPt + tableHeaderHeightPt + pageRowsHeight
          const signatureTopPt = Math.max(
            tableBottomPt + 30,
            pageBottomPt - 100,
          )
          const signatureBefore = toTwips(signatureTopPt - tableBottomPt)
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: signatureBefore, after: 0 },
              children: [
                new TextRun({
                  text: 'Naghanda:',
                  size: 20,
                  font: 'Book Antiqua',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 80 },
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: '000000',
                  space: 1,
                },
              },
              children: [
                new TextRun({
                  text: options.pangulongName.trim(),
                  bold: true,
                  size: 20,
                  font: 'Book Antiqua',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: 'Pangulong Mang-aawit',
                  size: 18,
                  font: 'Book Antiqua',
                }),
              ],
            }),
          )
        }
        if (pageIndex < totalPages) {
          children.push(
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [new PageBreak()],
            }),
          )
        }
      })
    })
  })

  // docx swaps the given width/height for landscape pages, so pass the short
  // edge as width or Word opens the landscape sheet in portrait.
  const pageShortEdgePt = Math.min(pageWidthPt, pageHeightPt)
  const pageLongEdgePt = Math.max(pageWidthPt, pageHeightPt)
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: toTwips(pageShortEdgePt),
              height: toTwips(pageLongEdgePt),
              orientation:
                format.orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: toTwips(marginTopPt),
              bottom: toTwips(marginBottomPt),
              left: toTwips(marginLeftPt),
              right: toTwips(marginRightPt),
            },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBlob(document)
}
