import type { KoroDocument, KoroRow, KoroTable } from '@/core/types/koro'
import type { KoroRosterEntry } from '@/lib/koro'
import type { VoicePosition } from '@/core/types/suguan'
import { FONT_SIZE_PRESETS, docPaperDimensionsMm } from '@/lib/suguanUtils'
import { fitFontSizePt } from '@/lib/suguanExport'
import { formatKoroTime, koroDayLabel, koroVoiceColor, KORO_ORGAN_COLOR } from '@/lib/koro'
import {
  koroColumnWidthsMm,
  koroMergedSeats,
  koroReservedColumns,
} from '@/lib/koroLayout'
import type { KoroMergedSeat } from '@/lib/koroLayout'
import { formatDateLongDate } from '@/lib/format'
import { exportFileName } from '@/lib/exportNaming'

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

export interface KoroTableExportOptions {
  /** Congregation name printed above the occasion title, e.g. "Sta. Monica". */
  localeName?: string
  output?: 'download' | 'preview'
}

/**
 * The printed seating chart.
 *
 * Styled after the choir's own reference sheet: a serif heading block (choir
 * name, occasion in italic), one bold date/service/table line per table (each
 * table carries its own date, day and time), an organist line, then a bordered
 * grid where **each row divides the full width by its own seat count** — a
 * 14-seat front row therefore prints as narrower cells than a 10-seat row,
 * exactly like the sample. Seats print the singer's given name only; a reserved
 * seat (e.g. "Organ") prints its label instead, and a long name wraps and the
 * row grows rather than the font collapsing. A reserved seat takes two seats'
 * width and fuses with the blank seats above and below it into one tall gold
 * block, and a table holding one prints with taller rows throughout.
 * A vertical colour key closes the sheet.
 *
 * The sample's highlight fills behind the weekday and the table name are
 * deliberately not reproduced; those lines stay black-on-white.
 */
export async function exportKoroTablePdf(
  document: KoroDocument,
  members: KoroRosterEntry[],
  voices: VoicePosition[] = [],
  filename?: string,
  options: KoroTableExportOptions = {},
): Promise<Blob | void> {
  const { jsPDF } = await import('jspdf')
  const dimensions = docPaperDimensionsMm({
    paperSize: 'legal',
    orientation: 'landscape',
    margins: 'normal',
    scaling: 'auto',
    fontSize: 'normal',
  })
  const margin = 12
  const pageWidth = dimensions.width
  const pageHeight = dimensions.height
  const contentWidth = pageWidth - margin * 2
  const pageBottom = pageHeight - margin
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

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  })
  let y = margin
  let organistDrawn = false

  /** Shrink a single-line label until it fits the content width. */
  const fitLine = (text: string, startSizePt: number, maxWidthMm: number) =>
    fitFontSizePt({
      text,
      startSizePt,
      maxWidthMm,
      measureMm: (value, sizePt) => {
        pdf.setFontSize(sizePt)
        return pdf.getTextWidth(value)
      },
    })

  const drawHeading = () => {
    const titleSize = Math.max(12, Math.min(20, 17 * fontScale))
    pdf.setFont('times', 'bold')
    pdf.setFontSize(fitLine(heading, titleSize, contentWidth))
    pdf.text(heading, pageWidth / 2, y + titleSize * 0.36, { align: 'center' })
    y += titleSize * 0.46
    if (occasion) {
      const occasionSize = Math.max(9, Math.min(14, 12 * fontScale))
      pdf.setFont('times', 'italic')
      pdf.setFontSize(fitLine(occasion, occasionSize, contentWidth))
      pdf.text(occasion, pageWidth / 2, y + occasionSize * 0.34, {
        align: 'center',
      })
      y += occasionSize * 0.46
    }
    y += 3
  }

  const drawServiceLine = (table: KoroTable) => {
    // Each table prints its own service line, e.g.
    // "November 11, 2026 - SATURDAY 6:00AM (Principal Choir)". The weekday is
    // derived from the table's date, so there is no separate day field.
    const tableTitle = (table.title ?? '').trim() || 'KORO'
    const day = koroDayLabel(table.date).toUpperCase()
    const time = formatKoroTime(table.time ?? '')
    const dateLabel = table.date ? formatDateLongDate(table.date) : ''
    const dated = [dateLabel, day].filter(Boolean).join(' - ')
    const when = [dated, time].filter(Boolean).join(' ')
    const label = `${when ? `${when} ` : ''}(${tableTitle})`
    const size = fitLine(
      label,
      Math.max(8, Math.min(12, 10.5 * fontScale)),
      contentWidth,
    )
    pdf.setFont('times', 'bold')
    pdf.setFontSize(size)
    pdf.text(label, pageWidth / 2, y + size * 0.34, { align: 'center' })
    y += Math.max(6, size * 0.54)

    // The organist belongs to the document, so it prints once, under the first
    // table's line, and never repeats on a continuation page.
    if (organistName && !organistDrawn) {
      const organistSize = Math.max(7.5, Math.min(12, 10 * fontScale))
      pdf.setFont('times', 'italic')
      pdf.setFontSize(fitLine(`ORGANIST: ${organistName}`, organistSize, contentWidth))
      pdf.text(`ORGANIST: ${organistName}`, pageWidth / 2, y + organistSize * 0.34, {
        align: 'center',
      })
      y += organistSize * 0.56
      organistDrawn = true
    }
    y += 1.5
  }

  const newPage = (table: KoroTable) => {
    pdf.addPage([pageWidth, pageHeight], 'landscape')
    y = margin
    drawHeading()
    drawServiceLine(table)
  }

  const lineHeight = (sizePt: number) => sizePt * 0.3528 * 1.1

  /**
   * The largest bold size that fits a reserved seat's block. The block itself
   * keeps its own size; only this label is allowed to grow, and it stays close
   * to the body size so the organ reads as a label, not a poster.
   */
  const fitBlockLabel = (text: string, maxWidthMm: number, maxHeightMm: number) => {
    pdf.setFont('times', 'bold')
    const largest = fontPreset.bodyFontSize * 1.5
    let wrapped: { lines: string[]; size: number } | null = null
    for (let size = largest; size >= 5.5; size -= 0.5) {
      pdf.setFontSize(size)
      const lines = pdf
        .splitTextToSize(text, maxWidthMm)
        .filter((line: string) => line.trim().length > 0)
      if (lines.length === 0) continue
      if (lines.length * lineHeight(size) + 2.6 > maxHeightMm) continue
      // A short label stays on one line; splitting "ORGAN" into "ORG / AN"
      // reads as a typo, so a single line wins over a larger wrapped one.
      if (lines.length === 1) return { lines, size }
      wrapped ??= { lines, size }
    }
    return wrapped ?? { lines: [text], size: 5.5 }
  }

  /** Measure one row's text without drawing, so heights are known up front. */
  const prepareRow = (row: KoroRow, widths: number[]) => {
    const padding = 1.3

    return row.cells.map((cell, columnIndex) => {
      const maxTextWidth = Math.max(6, (widths[columnIndex] ?? 0) - padding * 2)
      const member = cell.memberId ? memberById.get(cell.memberId) : undefined
      // The seating chart prints given names only, never surnames. A reserved
      // seat (e.g. "Organ") prints its label in place of a name.
      const first = (member?.firstName ?? cell.firstName).trim()
      const label = (cell.label ?? '').trim()
      const text = first || (label ? label.toUpperCase() : '')
      if (!text) {
        return { cell, text, lines: [] as string[], size: 0, isLabel: false }
      }
      const isLabel = !first
      let size = Math.max(
        5.5,
        Math.min(fontPreset.bodyFontSize, maxTextWidth * 0.62),
      )
      let lines: string[] = []
      for (let attempt = 0; attempt < 6; attempt += 1) {
        pdf.setFont('times', isLabel ? 'bold' : 'normal')
        pdf.setFontSize(size)
        lines = pdf
          .splitTextToSize(text, maxTextWidth)
          .filter((line: string) => line.trim().length > 0)
        if (lines.length <= 2 || size <= 5.5) break
        size -= 0.5
      }
      return {
        cell,
        text,
        lines: lines.slice(0, 2),
        size,
        isLabel,
      }
    })
  }

  const rowHeightOf = (prepared: ReturnType<typeof prepareRow>) => {
    const padding = 1.3
    const tallest = prepared.reduce((height, entry) => {
      if (entry.lines.length === 0) return height
      return Math.max(
        height,
        entry.lines.length * lineHeight(entry.size) + padding * 2,
      )
    }, 0)
    return Math.max(8.5 * fontScale, tallest)
  }

  const drawTable = (table: KoroTable) => {
    // A reserved seat takes the width of two ordinary seats, so the organ block
    // is larger in both directions, like the choir's reference sheet.
    const reservedColumns = koroReservedColumns(table.rows)
    const widthsByRow = table.rows.map((row) =>
      koroColumnWidthsMm(row, reservedColumns, contentWidth),
    )
    const prepared = table.rows.map((row, index) =>
      prepareRow(row, widthsByRow[index]),
    )

    // A table holding a reserved seat (the organ) prints a little larger than
    // the rest, so the organ reads as the dominant block on the page.
    const hasReservedSeat = prepared.some((row) =>
      row.some((seat) => seat.isLabel),
    )
    const reservedRowHeight = 8.5 * fontScale * 1.25
    const heights = prepared.map((row) =>
      hasReservedSeat
        ? Math.max(rowHeightOf(row), reservedRowHeight)
        : rowHeightOf(row),
    )

    // Reserved seats fused with the blank seats around them draw as one block,
    // starting at the topmost row the run covers.
    const spans = koroMergedSeats(table.rows)
    const blocks = new Map<string, KoroMergedSeat>()
    // Seats a taller reserved block already covers; they must not draw again.
    const absorbed = new Set<string>()
    for (const span of spans) {
      blocks.set(`${span.startRow}:${span.columnIndex}`, span)
      for (let covered = span.startRow; covered <= span.endRow; covered += 1) {
        if (covered !== span.startRow) {
          absorbed.add(`${covered}:${span.columnIndex}`)
        }
      }
    }

    table.rows.forEach((_row, rowIndex) => {
      if (y + heights[rowIndex] > pageBottom) newPage(table)
      const widths = widthsByRow[rowIndex]
      let x = margin

      prepared[rowIndex].forEach((seat, columnIndex) => {
        const cellWidth = widths[columnIndex]
        if (absorbed.has(`${rowIndex}:${columnIndex}`)) {
          x += cellWidth
          return
        }
        const maxTextWidth = Math.max(6, cellWidth - 1.3 * 2)

        // The block starts at the top of its run, which may be a blank seat
        // above the label, and grows over every row it still fits on.
        const span = blocks.get(`${rowIndex}:${columnIndex}`)
        let height = heights[rowIndex]
        if (span) {
          let total = heights[rowIndex]
          let endRow = rowIndex
          for (let next = rowIndex + 1; next <= span.endRow; next += 1) {
            if (y + total + heights[next] > pageBottom) break
            total += heights[next]
            endRow = next
          }
          if (endRow > rowIndex) {
            height = total
            for (let covered = rowIndex + 1; covered <= endRow; covered += 1) {
              absorbed.add(`${covered}:${columnIndex}`)
            }
          }
        }

        const cell = span ? table.rows[span.rowIndex].cells[columnIndex] : seat.cell
        const labelSeat = span ? prepared[span.rowIndex][columnIndex] : seat
        const member = cell.memberId ? memberById.get(cell.memberId) : undefined
        const voice = cell.voicePosition || member?.voicePosition || ''
        const fill = cell.memberId
          ? koroVoiceColor(voice, voices)
          : cell.label?.trim()
            ? KORO_ORGAN_COLOR
            : '#ffffff'
        pdf.setFillColor(...hexToRgb(fill))
        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.25)
        pdf.rect(x, y, cellWidth, height, 'FD')

        // A reserved seat takes a label sized to its block, so it reads as the
        // large organ seat the reference sheet shows.
        const label = labelSeat.isLabel
          ? fitBlockLabel(labelSeat.text, maxTextWidth * 0.92, height)
          : { lines: labelSeat.lines, size: labelSeat.size }
        if (label.lines.length > 0 && label.size > 0) {
          pdf.setFont('times', labelSeat.isLabel ? 'bold' : 'normal')
          pdf.setFontSize(label.size)
          const step = lineHeight(label.size)
          const blockHeight = label.lines.length * step
          let textY = y + (height - blockHeight) / 2 + step * 0.78
          for (const line of label.lines) {
            pdf.text(line, x + cellWidth / 2, textY, { align: 'center' })
            textY += step
          }
        }
        x += cellWidth
      })
      y += heights[rowIndex]
    })
  }

  const drawLegend = () => {
    if (voices.length === 0) return
    const step = 5.6
    const legendHeight = voices.length * step
    if (y + legendHeight + 4 > pageBottom) {
      pdf.addPage([pageWidth, pageHeight], 'landscape')
      y = margin
      drawHeading()
    }
    y += 3
    const labelSize = Math.max(7, 8.5 * fontScale)
    voices.forEach((voice, index) => {
      const top = y + index * step
      pdf.setFillColor(...hexToRgb(koroVoiceColor(voice.id, voices)))
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.25)
      pdf.rect(margin, top, 9, step - 1.4, 'FD')
      pdf.setFont('times', 'normal')
      pdf.setFontSize(labelSize)
      pdf.text(voice.name.toUpperCase(), margin + 11, top + step - 2.4)
    })
    y += legendHeight
  }

  drawHeading()
  for (const table of document.tables) {
    drawServiceLine(table)
    drawTable(table)
    y += 4
  }
  drawLegend()

  if (options.output === 'preview') return pdf.output('blob')
  const safeTitle =
    (document.title.trim() || 'Koro').replace(/[<>:"/\\|?*]+/g, '').trim() ||
    'Koro'
  pdf.save(filename ?? exportFileName(`${safeTitle} - Koro`, 'pdf'))
}
