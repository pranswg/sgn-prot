import type { SuguanDocFormat } from '@/core/types/suguan'
import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import {
  docMarginsMm,
  docPaperDimensionsMm,
  normalizeDocFormat,
  resolveFontSizePreset,
} from '@/lib/suguanUtils'
import { organistaDateLabel } from './organistaDateLabel'

export async function buildOrganistaSuguanDocx(
  churchName: string,
  pagsasanayDate: string,
  services: OrganistaSuguanService[],
  format: SuguanDocFormat,
  pmName: string,
  destinadoName: string,
): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
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
  const normalized = normalizeDocFormat(format)
  const dimensions = docPaperDimensionsMm(normalized)
  const margins = docMarginsMm(normalized)
  const preset = resolveFontSizePreset(normalized)
  const toTwips = (mm: number) => Math.max(1, Math.round((mm * 1440) / 25.4))
  const contentWidth = toTwips(
    dimensions.width - margins.left - margins.right,
  )
  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '000000',
  }
  const tableBorders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
    insideHorizontal: border,
    insideVertical: border,
  }
  const widths = [12, 28, 20, 20, 20].map((share) =>
    Math.round((contentWidth * share) / 100),
  )
  const cell = (
    text: string,
    width: number,
    options: { bold?: boolean; header?: boolean } = {},
  ) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 65, bottom: 65, left: 70, right: 70 },
      shading: options.header ? { fill: 'F2F2F2' } : undefined,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text,
              bold: options.bold,
              size: Math.round(preset.smallFontSize * 2),
            }),
          ],
        }),
      ],
    })
  const headerLabels = [
    '',
    'Pangalan',
    'Contact Number',
    'Lagda sa Pagtanggap',
    'Lagda sa Pagtupad',
  ]
  const rows = [
    new TableRow({
      tableHeader: true,
      children: headerLabels.map((label, index) =>
        cell(label.toUpperCase(), widths[index], { bold: true, header: true }),
      ),
    }),
  ]
  services.forEach((service) => {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 5,
            width: { size: contentWidth, type: WidthType.DXA },
            shading: { fill: 'E7E6E6' },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: (service.heading || 'Service').toUpperCase(),
                    bold: true,
                    size: Math.round(preset.headerFontSize * 2),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    )
    ;[
      { label: 'ORGANISTA', name: service.organist },
      { label: 'RESERBA', name: service.reserve },
    ].forEach(({ label, name }) => {
      rows.push(
        new TableRow({
          children: [
            cell(label, widths[0], { bold: true }),
            cell(name, widths[1], { bold: true }),
            cell('', widths[2]),
            cell('', widths[3]),
            cell('', widths[4]),
          ],
        }),
      )
    })
  })

  const signatureTable = new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: [Math.floor(contentWidth / 2), Math.ceil(contentWidth / 2)],
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
          { name: pmName.trim(), role: 'PANGULONG MANG-AAWIT' },
          { name: destinadoName.trim(), role: 'DESTINADO' },
        ].map(
          ({ name, role }) =>
            new TableCell({
              width: {
                size: Math.floor(contentWidth / 2),
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
                  children: [new TextRun({ text: role, size: 18 })],
                }),
              ],
            }),
        ),
      }),
    ],
  })

  const titleSize = Math.round(preset.headerFontSize * 2.8)
  const dateLine = organistaDateLabel(pagsasanayDate)
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: toTwips(dimensions.width),
              height: toTwips(dimensions.height),
              orientation:
                normalized.orientation === 'landscape'
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
        children: [
          ...(churchName.trim()
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: `Lokal ng ${churchName.trim()}`,
                      size: titleSize,
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 50 },
            children: [
              new TextRun({
                text: 'SUGUAN NG MGA ORGANISTA',
                bold: true,
                italics: true,
                size: Math.round(preset.headerFontSize * 3.2),
              }),
            ],
          }),
          ...(dateLine
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 160 },
                  children: [
                    new TextRun({ text: dateLine, size: titleSize }),
                  ],
                }),
              ]
            : []),
          new Table({
            width: { size: contentWidth, type: WidthType.DXA },
            columnWidths: widths,
            layout: TableLayoutType.FIXED,
            borders: tableBorders,
            rows,
          }),
          new Paragraph({ text: '', spacing: { after: 200 } }),
          signatureTable,
        ],
      },
    ],
  })
  return Packer.toBlob(doc)
}
