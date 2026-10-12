import type { Suguan, SuguanDocFormat } from '@/core/types/suguan'
import {
  computeSuguanLayout,
  suguanSheetAccent,
  type SheetMembers,
} from '@/lib/suguanExport'
import {
  eventTypeLabel,
  formatEventDate,
  resolveSignatureNames,
  suguanFileName,
  suguanSheetTitle,
} from '@/lib/suguanUtils'

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

export async function exportSuguanDocx(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
  filename?: string,
): Promise<void> {
  const blob = await createSuguanDocxBlob(suguan, members, docFormat)
  downloadBlob(blob, filename ?? suguanFileName(suguan, 'docx'))
}

export async function createSuguanDocxBlob(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
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
  const layout = computeSuguanLayout(suguan, members, docFormat)
  const totalWidth = layout.paperWidthMm - layout.margins.left - layout.margins.right
  const toTwips = (mm: number) => Math.max(1, Math.round((mm * 1440) / 25.4))
  const columnWidthsMm = [
    layout.noColWidthMm,
    layout.nameColWidthMm,
    ...layout.events.map(() => layout.eventColWidthMm),
  ]
  const columnWidths = columnWidthsMm.map(toTwips)
  const totalWidthTwips = toTwips(totalWidth)
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '000000',
  }
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  }
  const accent = suguanSheetAccent(suguan.group)
  const makeCell = (
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
            children: [new TextRun({ text: line, bold: options.bold, size: 18 })],
          }),
      ),
    })
  const header = new TableRow({
    tableHeader: true,
    children: [
      makeCell('No.', columnWidths[0], { bold: true, fill: 'F2F2F2' }),
      makeCell('PANGALAN', columnWidths[1], { bold: true, fill: 'F2F2F2' }),
      ...layout.events.map((event, index) =>
        makeCell(
          `${eventTypeLabel(event.type)}\n${formatEventDate(event)}`,
          columnWidths[index + 2],
          {
            bold: true,
            fill:
              event.type === 'pagsasanay'
                ? 'FFF2CC'
                : accent.pagtupadFill.slice(1),
          },
        ),
      ),
    ],
  })
  const rows = [header]
  layout.sections.forEach((section) => {
    rows.push(
      new TableRow({
        children: [
          makeCell('', columnWidths[0], { fill: accent.scheduleFill.slice(1) }),
          makeCell(section.label, columnWidths[1], {
            bold: true,
            fill: accent.scheduleFill.slice(1),
          }),
          ...layout.events.map((_, index) =>
            makeCell('', columnWidths[index + 2], {
              fill: accent.scheduleFill.slice(1),
            }),
          ),
        ],
      }),
    )
    section.rows.forEach((row) => {
      rows.push(
        new TableRow({
          children: [
            makeCell(`${row.no}.`, columnWidths[0]),
            new TableCell({
              width: { size: columnWidths[1], type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 55, bottom: 55, left: 70, right: 70 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: row.name, size: 18 })],
                }),
              ],
            }),
            ...layout.events.map((_, index) =>
              makeCell('', columnWidths[index + 2]),
            ),
          ],
        }),
      )
    })
  })

  const signatures = resolveSignatureNames(suguan, members)
  const signatureTable = new Table({
    width: { size: totalWidthTwips, type: WidthType.DXA },
    columnWidths: [Math.floor(totalWidthTwips / 2), Math.ceil(totalWidthTwips / 2)],
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        children: [
          { name: signatures.pmName, title: 'Pangulong Mang-aawit' },
          { name: signatures.destinadoName, title: 'Destinado' },
        ].map(
          ({ name, title }) =>
            new TableCell({
              width: {
                size: Math.floor(totalWidthTwips / 2),
                type: WidthType.DXA,
              },
              children: [
                new Paragraph({ text: '' }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
                  children: [new TextRun({ text: name, bold: true, size: 22 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: title, size: 18 })],
                }),
              ],
            }),
        ),
      }),
    ],
  })

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: toTwips(layout.paperWidthMm),
              height: toTwips(layout.paperHeightMm),
              orientation:
                layout.fmt.orientation === 'landscape'
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: toTwips(layout.margins.top),
              bottom: toTwips(layout.margins.bottom),
              left: toTwips(layout.margins.left),
              right: toTwips(layout.margins.right),
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: suguanSheetTitle(suguan),
                bold: true,
                size: Math.round(layout.fs.titleFontSize * 2),
              }),
            ],
          }),
          new Table({
            width: { size: totalWidthTwips, type: WidthType.DXA },
            columnWidths,
            layout: TableLayoutType.FIXED,
            borders,
            rows,
          }),
          new Paragraph({ text: '', spacing: { after: 100 } }),
          signatureTable,
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}
