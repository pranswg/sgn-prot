import type { FileChild } from 'docx'
import type { KoroDocument, KoroTable } from '@/core/types/koro'
import type { KoroRosterEntry } from '@/lib/koro'
import type { VoicePosition } from '@/core/types/suguan'
import { FONT_SIZE_PRESETS, docPaperDimensionsMm } from '@/lib/suguanUtils'
import {
  formatKoroTime,
  koroDayLabel,
  koroVoiceColor,
  KORO_ORGAN_COLOR,
} from '@/lib/koro'
import {
  KORO_RESERVED_SEAT_SHARE,
  koroMergedSeats,
  koroReservedColumns,
} from '@/lib/koroLayout'
import type { KoroMergedSeat } from '@/lib/koroLayout'
import { formatDateLongDate } from '@/lib/format'
import { exportFileName } from '@/lib/exportNaming'

export interface KoroTableDocxOptions {
  /** Congregation name printed above the occasion title, e.g. "Sta. Monica". */
  localeName?: string
}

const toTwips = (mm: number) => Math.max(1, Math.round((mm * 1440) / 25.4))

/**
 * Word tables top out around 63 columns, so every row is laid out on the same
 * 60-column grid instead of a least-common-multiple grid (which would need 154
 * columns for the default 10/10/14 formation). Each row's shares are apportioned
 * to whole columns by largest remainder, so every row still fills the width.
 */
const DOCX_GRID_COLUMNS = 60

function gridUnitsForShares(shares: readonly number[]): number[] {
  const total = shares.reduce((sum, share) => sum + share, 0) || 1
  const exact = shares.map((share) => (share / total) * DOCX_GRID_COLUMNS)
  const units = exact.map(Math.floor)
  const remainder = DOCX_GRID_COLUMNS - units.reduce((sum, value) => sum + value, 0)
  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction)
  for (let extra = 0; extra < remainder; extra += 1) {
    units[byFraction[extra % byFraction.length].index] += 1
  }
  return units
}

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

/**
 * The seating chart as an editable Word document, matching the printed PDF:
 * the same heading block, one service line per table, the organist line, the
 * same seat colours and the same merged organ block. The organ column keeps its
 * two-seat width and the table holding it keeps its slightly taller rows.
 */
export async function exportKoroTableDocx(
  document: KoroDocument,
  members: KoroRosterEntry[],
  voices: VoicePosition[] = [],
  filename?: string,
  options: KoroTableDocxOptions = {},
): Promise<void> {
  const blob = await createKoroTableDocxBlob(document, members, voices, options)
  const safeTitle =
    (document.title.trim() || 'Koro').replace(/[<>:"/\\|?*]+/g, '').trim() ||
    'Koro'
  downloadBlob(blob, filename ?? exportFileName(`${safeTitle} - Koro`, 'docx'))
}

export async function createKoroTableDocxBlob(
  document: KoroDocument,
  members: KoroRosterEntry[],
  voices: VoicePosition[] = [],
  options: KoroTableDocxOptions = {},
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

  const dimensions = docPaperDimensionsMm({
    paperSize: 'legal',
    orientation: 'landscape',
    margins: 'normal',
    scaling: 'auto',
    fontSize: 'normal',
  })
  const marginMm = 12
  const contentWidthMm = dimensions.width - marginMm * 2
  const contentWidthTwips = toTwips(contentWidthMm)
  // docx swaps these two when the section is landscape, so hand it the short
  // and long edges: the packed page must be 355.6 x 215.9mm with w:orient set,
  // otherwise Word opens the document portrait and the tables overflow.
  const pageShortEdgeMm = Math.min(dimensions.width, dimensions.height)
  const pageLongEdgeMm = Math.max(dimensions.width, dimensions.height)
  const fontPreset = FONT_SIZE_PRESETS[document.exportFontSize ?? 'large']
  const fontScale =
    fontPreset.bodyFontSize / FONT_SIZE_PRESETS.normal.bodyFontSize
  const memberById = new Map(members.map((member) => [member.id, member]))
  const localeLabel = (options.localeName ?? '').trim()
  const heading = localeLabel ? `${localeLabel} CHOIR`.toUpperCase() : 'CHOIR'
  const occasion = document.title.trim()
  const organist = members.find(
    (member) => member.id === document.organistMemberId,
  )
  const organistName = organist
    ? `${organist.firstName} ${organist.lastName}`.trim()
    : ''
  const font = 'Times New Roman'

  const line = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: '000000',
  }
  const borders = {
    top: line,
    bottom: line,
    left: line,
    right: line,
    insideHorizontal: line,
    insideVertical: line,
  }
  const nil = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = {
    top: nil,
    bottom: nil,
    left: nil,
    right: nil,
    insideHorizontal: nil,
    insideVertical: nil,
  }

  /** A cell whose width is expressed in the table's grid columns. */
  const makeCell = (
    text: string,
    widthTwips: number,
    columnSpan: number,
    settings: {
      bold?: boolean
      fill?: string
      sizePt?: number
      rowSpan?: number
    } = {},
  ) =>
    new TableCell({
      width: { size: widthTwips, type: WidthType.DXA },
      columnSpan,
      rowSpan: settings.rowSpan,
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
      shading: {
        type: ShadingType.CLEAR,
        fill: (settings.fill ?? '#ffffff').replace('#', ''),
      },
      borders,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: text
            ? [
                new TextRun({
                  text,
                  bold: settings.bold,
                  size: Math.round((settings.sizePt ?? fontPreset.bodyFontSize) * 2),
                  font,
                }),
              ]
            : [],
        }),
      ],
    })

  const makeTable = (table: KoroTable) => {
    // A reserved column takes two shares of its row, so the organ prints twice
    // as wide. Rows with different seat counts divide the width differently, so
    // every cell spans a whole number of grid columns on a common grid.
    const reserved = koroReservedColumns(table.rows)
    const sharesByRow = table.rows.map((row) => {
      const reservedInRow = reserved.get(row.cells.length)
      return row.cells.map((_, columnIndex) =>
        reservedInRow?.has(columnIndex) ? KORO_RESERVED_SEAT_SHARE : 1,
      )
    })
    const unitsByRow = sharesByRow.map((shares) => gridUnitsForShares(shares))
    const baseColumnWidth = Math.floor(contentWidthTwips / DOCX_GRID_COLUMNS)
    const remainder =
      contentWidthTwips - baseColumnWidth * DOCX_GRID_COLUMNS
    const columnWidths = Array.from(
      { length: DOCX_GRID_COLUMNS },
      (_, index) => baseColumnWidth + (index < remainder ? 1 : 0),
    )

    const spans = koroMergedSeats(table.rows)
    const spanStarts = new Map<string, KoroMergedSeat>()
    const covered = new Set<string>()
    for (const span of spans) {
      spanStarts.set(`${span.startRow}:${span.columnIndex}`, span)
      for (let row = span.startRow; row <= span.endRow; row += 1) {
        if (row !== span.startRow) covered.add(`${row}:${span.columnIndex}`)
      }
    }

    const hasReservedSeat = table.rows.some((row) =>
      row.cells.some((cell) => cell.label?.trim()),
    )
    const rowHeightMm = 8.5 * fontScale * 1.25
    const organSizePt = fontPreset.bodyFontSize * 1.5

    const rows = table.rows.map((row, rowIndex) => {
      let gridColumn = 0
      const cells = row.cells.flatMap((cell, columnIndex) => {
        const units = unitsByRow[rowIndex][columnIndex]
        const span = spanStarts.get(`${rowIndex}:${columnIndex}`)
        const width = columnWidths
          .slice(gridColumn, gridColumn + units)
          .reduce((sum, value) => sum + value, 0)
        gridColumn += units
        if (covered.has(`${rowIndex}:${columnIndex}`)) return []

        const source = span ? table.rows[span.rowIndex].cells[columnIndex] : cell
        const member = source.memberId
          ? memberById.get(source.memberId)
          : undefined
        const first = (member?.firstName ?? source.firstName).trim()
        const label = (source.label ?? '').trim()
        const text = first || (label ? label.toUpperCase() : '')
        const isLabel = !first && Boolean(label)
        const voice = source.voicePosition || member?.voicePosition || ''
        const fill = source.memberId
          ? koroVoiceColor(voice, voices)
          : isLabel
            ? KORO_ORGAN_COLOR
            : '#ffffff'

        return [
          makeCell(text, width, units, {
            bold: isLabel,
            fill,
            sizePt: isLabel ? organSizePt : fontPreset.bodyFontSize,
            rowSpan: span ? span.endRow - span.startRow + 1 : undefined,
          }),
        ]
      })
      return new TableRow({
        cantSplit: true,
        height: hasReservedSeat
          ? { value: toTwips(rowHeightMm), rule: 'atLeast' }
          : undefined,
        children: cells,
      })
    })

    return new Table({
      width: { size: contentWidthTwips, type: WidthType.DXA },
      columnWidths,
      layout: TableLayoutType.FIXED,
      borders,
      rows,
    })
  }

  const children: FileChild[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: heading,
          bold: true,
          size: Math.round(Math.max(12, Math.min(20, 17 * fontScale)) * 2),
          font,
        }),
      ],
    }),
  ]
  if (occasion) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: occasion,
            italics: true,
            size: Math.round(Math.max(9, Math.min(14, 12 * fontScale)) * 2),
            font,
          }),
        ],
      }),
    )
  }

  document.tables.forEach((table, tableIndex) => {
    const title = (table.title ?? '').trim() || 'KORO'
    const day = koroDayLabel(table.date).toUpperCase()
    const time = formatKoroTime(table.time ?? '')
    const dateLabel = table.date ? formatDateLongDate(table.date) : ''
    const dated = [dateLabel, day].filter(Boolean).join(' - ')
    const when = [dated, time].filter(Boolean).join(' ')
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `${when ? `${when} ` : ''}(${title})`,
            bold: true,
            size: Math.round(Math.max(8, Math.min(12, 10.5 * fontScale)) * 2),
            font,
          }),
        ],
      }),
    )
    if (organistName && tableIndex === 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: `ORGANIST: ${organistName}`,
              italics: true,
              size: Math.round(Math.max(7.5, Math.min(12, 10 * fontScale)) * 2),
              font,
            }),
          ],
        }),
      )
    }
    children.push(makeTable(table))
    children.push(new Paragraph({ spacing: { after: 160 }, children: [] }))
  })

  if (voices.length > 0) {
    const legendLabelSize = Math.max(7, 8.5 * fontScale)
    children.push(
      new Table({
        width: { size: toTwips(70), type: WidthType.DXA },
        columnWidths: [toTwips(10), toTwips(60)],
        layout: TableLayoutType.FIXED,
        borders: noBorders,
        rows: voices.map(
          (voice) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: toTwips(10), type: WidthType.DXA },
                  shading: {
                    type: ShadingType.CLEAR,
                    fill: koroVoiceColor(voice.id, voices).replace('#', ''),
                  },
                  borders: noBorders,
                  children: [new Paragraph({ children: [] })],
                }),
                new TableCell({
                  width: { size: toTwips(60), type: WidthType.DXA },
                  verticalAlign: VerticalAlign.CENTER,
                  margins: { top: 20, bottom: 20, left: 80, right: 20 },
                  borders: noBorders,
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 0 },
                      children: [
                        new TextRun({
                          text: voice.name.toUpperCase(),
                          size: Math.round(legendLabelSize * 2),
                          font,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
    )
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: toTwips(pageShortEdgeMm),
              height: toTwips(pageLongEdgeMm),
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: toTwips(marginMm),
              bottom: toTwips(marginMm),
              left: toTwips(marginMm),
              right: toTwips(marginMm),
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}
