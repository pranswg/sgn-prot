import type { KoroDocument, KoroTable } from '@/core/types/koro'
import type { KoroRosterEntry, KoroSuguanVoiceSection } from '@/lib/koro'
import type { VoicePosition } from '@/core/types/suguan'
import { FONT_SIZE_PRESETS, docPaperDimensionsMm } from '@/lib/suguanUtils'
import { fitFontSizePt, suguanSheetAccent } from '@/lib/suguanExport'
import {
  balanceKoroVoiceSections,
  buildKoroTableVoiceSections,
  formatKoroTime,
  koroDayLabel,
} from '@/lib/koro'
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

type PanelRow =
  | { kind: 'voice'; section: KoroSuguanVoiceSection }
  | { kind: 'member'; name: string; number: number }

/**
 * The Koro printed as a Choir Suguan sheet. Every table is its own sheet — a
 * page with its own date band (the table's own date, day and time) and its own
 * voice sections — because each formation sings its own service.
 */
export async function exportKoroAsSuguanPdf(
  document: KoroDocument,
  members: KoroRosterEntry[],
  voices: VoicePosition[] = [],
  output: 'download' | 'preview' = 'download',
  filename?: string,
): Promise<Blob | void> {
  const { jsPDF } = await import('jspdf')
  const dimensions = docPaperDimensionsMm({
    paperSize: 'legal',
    orientation: 'portrait',
    margins: 'normal',
    scaling: 'auto',
    fontSize: 'normal',
  })
  const margin = 10
  const pageWidth = dimensions.width
  const containerWidth = pageWidth - margin * 2
  const halfWidth = containerWidth / 2
  const numberWidth = 9
  const signatureWidth = 20
  const nameWidth = halfWidth - numberWidth - signatureWidth
  const title = document.title.trim() || 'SPECIAL OCCASION'
  const fontPreset = FONT_SIZE_PRESETS[document.exportFontSize ?? 'large']
  const fontScale =
    fontPreset.bodyFontSize / FONT_SIZE_PRESETS.normal.bodyFontSize
  const accent = suguanSheetAccent(document.group)
  const serviceFill = hexToRgb(accent.pagtupadFill)
  const organist = members.find(
    (member) => member.id === document.organistMemberId,
  )

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [dimensions.width, dimensions.height],
  })
  pdf.setLineWidth(0.2)
  pdf.setDrawColor(0, 0, 0)
  const centerX = pageWidth / 2

  const rowsForSections = (sections: KoroSuguanVoiceSection[]): PanelRow[] =>
    sections.flatMap((section) => [
      { kind: 'voice' as const, section },
      ...section.members.map((name, index) => ({
        kind: 'member' as const,
        name,
        number: index + 1,
      })),
    ])

  const drawSheet = (table: KoroTable, firstPage: boolean) => {
    if (!firstPage) pdf.addPage([dimensions.width, dimensions.height], 'portrait')

    const choirTitle = (table.title ?? '').trim() || 'PRINCIPAL CHOIR'
    const dateLabel = table.date ? formatDateLongDate(table.date) : ''
    const serviceDay = koroDayLabel(table.date)
    const serviceTime =
      (table.time ?? '').trim() || document.serviceTime?.trim() || '06:00'
    const sections = buildKoroTableVoiceSections(table, members, voices)
    const [leftSections, rightSections] = balanceKoroVoiceSections(sections)
    const leftRows = rowsForSections(leftSections)
    const rightRows = rowsForSections(rightSections)

    const headingHeight = 18 * fontScale
    const dateBandHeight = 10 * fontScale
    const columnHeaderHeight = 7 * fontScale
    const voiceRowHeight = 6 * fontScale
    const memberRowHeight = 5.8 * fontScale
    const signatureHeight = 17 * fontScale
    const organistHeight = voiceRowHeight + memberRowHeight
    const rowCount = Math.max(leftRows.length, rightRows.length, 1)
    const contentHeight =
      headingHeight +
      dateBandHeight +
      columnHeaderHeight +
      rowCount * Math.max(voiceRowHeight, memberRowHeight) +
      organistHeight +
      signatureHeight
    const availableHeight = dimensions.height - margin * 2
    const scale = Math.min(1, Math.max(0.4, availableHeight / contentHeight))
    const scaledHeading = headingHeight * scale
    const scaledDateBand = dateBandHeight * scale
    const scaledColumnHeader = columnHeaderHeight * scale
    const scaledVoiceRow = voiceRowHeight * scale
    const scaledMemberRow = memberRowHeight * scale
    const scaledSignature = signatureHeight * scale
    const scaledOrganistVoice = scaledVoiceRow
    const scaledOrganistMember = scaledMemberRow

    let y = margin

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(Math.max(6, fontPreset.titleFontSize * scale))
    pdf.text('SUGUAN NG MGA MANG-AAWIT', centerX, y + 6 * scale, {
      align: 'center',
    })
    pdf.setFont('times', 'italic')
    pdf.setFontSize(Math.max(6, fontPreset.titleFontSize * scale))
    pdf.text(title.toUpperCase(), centerX, y + 12 * scale, {
      align: 'center',
      maxWidth: containerWidth - 8,
    })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(Math.max(6, fontPreset.headerFontSize * scale))
    pdf.text(choirTitle.toUpperCase(), centerX, y + 18 * scale, {
      align: 'center',
    })
    y += scaledHeading

    const drawCell = (
      x: number,
      width: number,
      height: number,
      fill: [number, number, number],
    ) => {
      pdf.setFillColor(...fill)
      pdf.rect(x, y, width, height, 'FD')
    }
    const drawPanelRow = (
      x: number,
      row: PanelRow | undefined,
      rowHeight: number,
    ) => {
      const fill: [number, number, number] = [255, 255, 255]
      const widths = [numberWidth, nameWidth, signatureWidth]
      let cellX = x
      for (const width of widths) {
        drawCell(cellX, width, rowHeight, fill)
        cellX += width
      }

      if (row?.kind === 'voice') {
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(Math.max(6, fontPreset.headerFontSize * scale))
        pdf.text(row.section.label, x + numberWidth + 2, y + rowHeight * 0.68)
      } else if (row?.kind === 'member') {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(Math.max(6, fontPreset.bodyFontSize * scale))
        pdf.text(`${row.number}.`, x + numberWidth / 2, y + rowHeight * 0.68, {
          align: 'center',
        })
        const fittedSize = fitFontSizePt({
          text: row.name,
          startSizePt: fontPreset.bodyFontSize * scale,
          maxWidthMm: nameWidth - 4,
          measureMm: (text, sizePt) => {
            pdf.setFontSize(sizePt)
            return pdf.getTextWidth(text)
          },
        })
        pdf.setFontSize(fittedSize)
        pdf.text(row.name, x + numberWidth + 2, y + rowHeight * 0.68)
      }
    }

    drawCell(margin, containerWidth, scaledDateBand, serviceFill)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(Math.max(6, fontPreset.headerFontSize * scale))
    pdf.text(`PETSA: ${dateLabel}`, margin + 3, y + scaledDateBand * 0.65)
    pdf.text(serviceDay.toUpperCase(), centerX, y + scaledDateBand * 0.65, {
      align: 'center',
    })
    pdf.text(
      formatKoroTime(serviceTime),
      pageWidth - margin - 3,
      y + scaledDateBand * 0.65,
      { align: 'right' },
    )
    y += scaledDateBand

    const drawPanelHeader = (x: number) => {
      const widths = [numberWidth, nameWidth, signatureWidth]
      const labels = ['Blg.', 'Pangalan', 'Lagda']
      let cellX = x
      for (let index = 0; index < widths.length; index++) {
        drawCell(cellX, widths[index], scaledColumnHeader, [255, 255, 255])
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(Math.max(6, fontPreset.headerFontSize * scale))
        pdf.text(
          labels[index],
          cellX + widths[index] / 2,
          y + scaledColumnHeader * 0.68,
          { align: 'center' },
        )
        cellX += widths[index]
      }
    }
    drawPanelHeader(margin)
    drawPanelHeader(margin + halfWidth)
    y += scaledColumnHeader

    for (let index = 0; index < rowCount; index++) {
      const left = leftRows[index]
      const right = rightRows[index]
      const rowHeight =
        left?.kind === 'voice' || right?.kind === 'voice'
          ? scaledVoiceRow
          : scaledMemberRow
      drawPanelRow(margin, left, rowHeight)
      drawPanelRow(margin + halfWidth, right, rowHeight)
      y += rowHeight
    }

    const organistHeader: PanelRow = {
      kind: 'voice',
      section: { voicePosition: '', label: 'ORGANISTA', members: [] },
    }
    drawPanelRow(margin, organistHeader, scaledOrganistVoice)
    drawPanelRow(margin + halfWidth, undefined, scaledOrganistVoice)
    y += scaledOrganistVoice
    drawPanelRow(
      margin,
      {
        kind: 'member',
        name: organist ? `${organist.lastName}, ${organist.firstName}` : '',
        number: 1,
      },
      scaledOrganistMember,
    )
    drawPanelRow(margin + halfWidth, undefined, scaledOrganistMember)
    y += scaledOrganistMember

    const signatureHalf = containerWidth / 2
    const signatoryNames = ['PANGULONG MANG-AAWIT', 'DESTINADO']
    for (let index = 0; index < signatoryNames.length; index++) {
      const x = margin + index * signatureHalf
      drawCell(x, signatureHalf, scaledSignature, [255, 255, 255])
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(Math.max(6, fontPreset.smallFontSize * scale))
      pdf.text(
        signatoryNames[index],
        x + signatureHalf / 2,
        y + scaledSignature * 0.72,
        { align: 'center' },
      )
      pdf.line(
        x + signatureHalf * 0.2,
        y + scaledSignature * 0.44,
        x + signatureHalf * 0.8,
        y + scaledSignature * 0.44,
      )
    }
    pdf.rect(margin, margin, containerWidth, y + scaledSignature - margin)
  }

  document.tables.forEach((table, index) => drawSheet(table, index === 0))

  if (output === 'preview') return pdf.output('blob')
  const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Suguan'
  pdf.save(filename ?? exportFileName(`${safeTitle} - Suguan`, 'pdf'))
}
