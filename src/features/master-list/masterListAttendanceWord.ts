import type { FileChild } from 'docx'
import type { MasterListAttendanceOptions } from './masterListAttendancePdf'
import {
  buildMasterListAttendanceRows,
  formatAttendanceDateSummary,
  paginateMasterListAttendanceRows,
} from './masterListAttendance'
import { createAttendanceDatePanels } from '@/lib/attendanceDatePanels'
import { formatDateKeyNumeric, isDateKey } from '@/lib/phDate'
import { MASTER_LIST_PAPER_SIZES } from './masterListPaperSizes'

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
    lastNameFirst,
    paperSize,
    orientation,
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
  const paper = MASTER_LIST_PAPER_SIZES.find(({ id }) => id === paperSize)
  if (!paper) throw new Error('The selected paper size is not supported.')

  const rows = buildMasterListAttendanceRows(
    members,
    voices,
    groupByVoice ? selectedVoiceIds : null,
    trainees,
    includeNagsasanayMen,
    includeNagsasanayWomen,
    lastNameFirst,
    choir,
  )
  if (rows.length === 0) {
    throw new Error('There are no active members or selected trainees to include.')
  }

  const datePanels = createAttendanceDatePanels(
    [...new Set(dates)].sort((left, right) => left.localeCompare(right)),
  )

  const pageWidthPt =
    ((orientation === 'landscape' ? paper.height : paper.width) * 72) / 25.4
  const pageHeightPt =
    ((orientation === 'landscape' ? paper.width : paper.height) * 72) / 25.4
  const marginPt = 34
  const tableWidthPt = pageWidthPt - marginPt * 2
  const numberWidthPt = 34
  const titleLines = Math.max(
    1,
    Math.ceil((title.trim().length * 10) / tableWidthPt),
  )
  const tableTopPt = 34 + titleLines * 23 + 18 + 16 + 16
  const tableHeaderHeightPt = 42
  const regularPageHeight = pageHeightPt - tableTopPt - tableHeaderHeightPt - 32
  const finalPageHeight =
    pageHeightPt -
    20 -
    30 -
    (choir === 'aws' ? 54 : 0) -
    tableTopPt -
    tableHeaderHeightPt
  const rowPages = paginateMasterListAttendanceRows(
    rows,
    regularPageHeight,
    finalPageHeight,
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
  const totalPages = datePanels.length * rowPages.length
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

    rowPages.forEach((pageRows) => {
      pageIndex += 1
      const tableRows = [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          height: { value: toTwips(42), rule: 'exact' },
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
                margins: { top: 45, bottom: 45, left: 65, right: 65 },
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
              height: { value: toTwips(22), rule: 'exact' },
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
            height: { value: toTwips(26), rule: 'exact' },
            children: [
              cell(String(row.number), columnWidths[0], { fontSize: 8 }),
              cell(row.name, columnWidths[1], {
                align: AlignmentType.LEFT,
                fontSize: 9,
              }),
              ...panel.map((_, index) => cell('', columnWidths[index + 2])),
            ],
          })
        }),
      ]

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 },
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
          spacing: { before: 0, after: 360 },
          children: [
            new TextRun({
              text: formatAttendanceDateSummary(dates),
              size: 24,
              font: 'Book Antiqua',
            }),
          ],
        }),
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
            height + (row.kind === 'section' ? 22 : 26),
          0,
        )
        const tableBottomPt = tableTopPt + tableHeaderHeightPt + pageRowsHeight
        const signatureTopPt = Math.max(
          tableBottomPt + 30,
          pageHeightPt - 100,
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

  const marginTwips = toTwips(marginPt)
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: toTwips(pageWidthPt),
              height: toTwips(pageHeightPt),
              orientation:
                orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips,
            },
          },
        },
        children,
      },
    ],
  })
  return Packer.toBlob(document)
}
