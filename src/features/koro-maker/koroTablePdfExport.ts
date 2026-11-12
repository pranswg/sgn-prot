import type { KoroDocument, KoroRow, KoroTable } from '@/core/types/koro'
import type { KoroRosterEntry } from '@/lib/koro'
import type { VoicePosition } from '@/core/types/suguan'
import { FONT_SIZE_PRESETS, docPaperDimensionsMm } from '@/lib/suguanUtils'
import { fitFontSizePt } from '@/lib/suguanExport'
import { formatKoroTime, koroDayLabel, koroVoiceColor } from '@/lib/koro'
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
 * exactly like the sample. Seats print the singer's given name only; a long
 * name wraps and the row grows rather than the font collapsing.
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

  const drawRow = (row: KoroRow, table: KoroTable) => {
    const columns = Math.max(1, row.cells.length)
    const cellWidth = contentWidth / columns
    const padding = 1.3
    const maxTextWidth = Math.max(6, cellWidth - padding * 2)

    const prepared = row.cells.map((cell) => {
      const member = cell.memberId ? memberById.get(cell.memberId) : undefined
      // The seating chart prints given names only, never surnames.
      const first = (member?.firstName ?? cell.firstName).trim()
      if (!first) return { cell, lines: [] as string[], size: 0 }
      let size = Math.max(
        5.5,
        Math.min(fontPreset.bodyFontSize, maxTextWidth * 0.62),
      )
      let lines: string[] = []
      for (let attempt = 0; attempt < 6; attempt += 1) {
        pdf.setFont('times', 'normal')
        pdf.setFontSize(size)
        lines = pdf
          .splitTextToSize(first, maxTextWidth)
          .filter((line: string) => line.trim().length > 0)
        if (lines.length <= 2 || size <= 5.5) break
        size -= 0.5
      }
      return {
        cell,
        lines: lines.slice(0, 2),
        size,
      }
    })

    const lineHeight = (sizePt: number) => sizePt * 0.3528 * 1.1
    const tallest = prepared.reduce((height, entry) => {
      if (entry.lines.length === 0) return height
      return Math.max(
        height,
        entry.lines.length * lineHeight(entry.size) + padding * 2,
      )
    }, 0)
    const rowHeight = Math.max(8.5 * fontScale, tallest)

    if (y + rowHeight > pageBottom) newPage(table)

    let x = margin
    for (const { cell, lines, size } of prepared) {
      const member = cell.memberId ? memberById.get(cell.memberId) : undefined
      const voice = cell.voicePosition || member?.voicePosition || ''
      const fill = cell.memberId ? koroVoiceColor(voice, voices) : '#ffffff'
      pdf.setFillColor(...hexToRgb(fill))
      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.25)
      pdf.rect(x, y, cellWidth, rowHeight, 'FD')

      if (lines.length > 0 && size > 0) {
        pdf.setFont('times', 'normal')
        pdf.setFontSize(size)
        const step = lineHeight(size)
        const blockHeight = lines.length * step
        let textY = y + (rowHeight - blockHeight) / 2 + step * 0.78
        for (const line of lines) {
          pdf.text(line, x + cellWidth / 2, textY, { align: 'center' })
          textY += step
        }
      }
      x += cellWidth
    }
    y += rowHeight + 4 * fontScale
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
    for (const row of table.rows) drawRow(row, table)
    y += 4
  }
  drawLegend()

  if (options.output === 'preview') return pdf.output('blob')
  const safeTitle =
    (document.title.trim() || 'Koro').replace(/[<>:"/\\|?*]+/g, '').trim() ||
    'Koro'
  pdf.save(filename ?? exportFileName(`${safeTitle} - Koro`, 'pdf'))
}
