import type { KoroDocument } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { DEFAULT_VOICE_POSITIONS } from '@/core/constants/voicePositions'
import { FONT_SIZE_PRESETS, docPaperDimensionsMm } from '@/lib/suguanUtils'
import { fitFontSizePt, suguanSheetAccent } from '@/lib/suguanExport'
import {
  balanceKoroVoiceSections,
  buildKoroSuguanVoiceSections,
  koroDayLabel,
  koroVoiceColor,
} from '@/lib/koro'
import { formatDateLong, formatDateLongDate } from '@/lib/format'

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ]
}

export async function exportKoroTablePdf(
  document: KoroDocument,
  members: Member[],
  voices: VoicePosition[] = DEFAULT_VOICE_POSITIONS,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const docFormat = {
    paperSize: 'legal' as const,
    orientation: 'landscape' as const,
    margins: 'normal' as const,
    scaling: 'auto' as const,
    fontSize: 'normal' as const,
  }
  const dimensions = docPaperDimensionsMm(docFormat)
  const margin = 10
  const pageBottom = dimensions.height - margin
  const contentWidth = dimensions.width - margin * 2
  const fontPreset =
    FONT_SIZE_PRESETS[document.exportFontSize ?? 'large']
  const fontScale = fontPreset.bodyFontSize / FONT_SIZE_PRESETS.normal.bodyFontSize
  const title = document.title.trim() || 'KORO'
  const date = document.date ? formatDateLong(document.date) : ''
  const headingTop = 12
  let y = headingTop

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [dimensions.width, dimensions.height],
  })

  const drawHeading = () => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(fontPreset.titleFontSize)
    pdf.text(title.toUpperCase(), dimensions.width / 2, y, { align: 'center' })
    y += 6 * fontScale
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(fontPreset.headerFontSize)
    pdf.text(`${date}${date ? ' · ' : ''}${document.group.toUpperCase()}`, dimensions.width / 2, y, {
      align: 'center',
    })
    y += 8 * fontScale
  }

  const newPage = () => {
    pdf.addPage([dimensions.width, dimensions.height], 'landscape')
    y = headingTop
    drawHeading()
  }

  drawHeading()

  for (const table of document.tables) {
    const columnCount = Math.max(1, ...table.rows.map((row) => row.cells.length))
    const columnWidth = contentWidth / columnCount
    const rowHeight = 12 * fontScale
    const labelHeight = 7 * fontScale
    let rowIndex = 0
    let continued = false

    while (rowIndex < table.rows.length) {
      if (y + labelHeight + rowHeight > pageBottom) newPage()
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(fontPreset.headerFontSize)
      pdf.text(`${table.title || 'KORO'}${continued ? ' (CONTINUED)' : ''}`, margin, y + 5)
      y += labelHeight

      const rowsOnPage = Math.max(
        1,
        Math.floor((pageBottom - y) / rowHeight),
      )
      const rowEnd = Math.min(table.rows.length, rowIndex + rowsOnPage)
      for (; rowIndex < rowEnd; rowIndex++) {
        const row = table.rows[rowIndex]
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
          const cell = row.cells[columnIndex]
          const x = margin + columnIndex * columnWidth
          const member = cell?.memberId
            ? members.find((entry) => entry.id === cell.memberId)
            : undefined
          const fill = cell?.memberId
            ? koroVoiceColor(
                cell.voicePosition || member?.voicePosition || '',
                voices,
              )
            : '#ffffff'
          pdf.setFillColor(...hexToRgb(fill))
          pdf.setDrawColor(0, 0, 0)
          pdf.rect(x, y, columnWidth, rowHeight, 'FD')
          const name = member
            ? member.lastName.trim()
              ? `${member.lastName.trim()}, ${member.firstName.trim()}`.trim()
              : member.firstName.trim()
            : cell?.firstName.trim() ?? ''
          if (name) {
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(
              Math.min(
                fontPreset.bodyFontSize,
                Math.max(6, columnWidth * 0.38 * fontScale),
              ),
            )
            pdf.text(name, x + columnWidth / 2, y + rowHeight / 2, {
              align: 'center',
              baseline: 'middle',
              maxWidth: Math.max(1, columnWidth - 2),
            })
          }
        }
        y += rowHeight
      }
      y += 5
      continued = true
    }
  }

  const legendItemWidth = 33
  const legendHeight = 7 * fontScale
  if (y + legendHeight + 5 > pageBottom) newPage()
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(fontPreset.smallFontSize)
  pdf.text('VOICE ARRANGEMENT', margin, y + 5)
  y += 7

  voices.forEach((voice, index) => {
    const x = margin + index * legendItemWidth
    pdf.setFillColor(...hexToRgb(koroVoiceColor(voice.id, voices)))
    pdf.setDrawColor(0, 0, 0)
    pdf.rect(x, y, 6, 5, 'FD')
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(fontPreset.smallFontSize)
    pdf.text(voice.shortName, x + 8, y + 4)
  })

  const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Koro'
  pdf.save(`${safeTitle} - Koro.pdf`)
}

export async function exportKoroAsSuguanPdf(
  document: KoroDocument,
  members: Member[],
  voices: VoicePosition[] = DEFAULT_VOICE_POSITIONS,
  output: 'download' | 'preview' = 'download',
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
  const choirTitle = document.tables[0]?.title.trim() || 'PRINCIPAL CHOIR'
  const serviceDay = koroDayLabel(document.date)
  const serviceTime = document.serviceTime?.trim() || '6:00AM'
  const dateLabel = document.date ? formatDateLongDate(document.date) : ''
  const fontPreset = FONT_SIZE_PRESETS[document.exportFontSize ?? 'large']
  const fontScale =
    fontPreset.bodyFontSize / FONT_SIZE_PRESETS.normal.bodyFontSize
  const accent = suguanSheetAccent(document.group)
  const serviceFill = hexToRgb(accent.pagtupadFill)
  const sections = buildKoroSuguanVoiceSections(document, members, voices)
  const [leftSections, rightSections] = balanceKoroVoiceSections(sections)
  type Section = (typeof sections)[number]
  type PanelRow =
    | { kind: 'voice'; section: Section }
    | { kind: 'member'; name: string; number: number }
  const rowsForSections = (voiceSections: Section[]): PanelRow[] =>
    voiceSections.flatMap((section) => [
      { kind: 'voice' as const, section },
      ...section.members.map((name, index) => ({
        kind: 'member' as const,
        name,
        number: index + 1,
      })),
    ])
  const leftRows = rowsForSections(leftSections)
  const rightRows = rowsForSections(rightSections)
  const organist = members.find(
    (member) => member.id === document.organistMemberId,
  )

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
  const centerX = pageWidth / 2

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [dimensions.width, dimensions.height],
  })
  pdf.setLineWidth(0.2)
  pdf.setDrawColor(0, 0, 0)
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
    serviceTime.toUpperCase(),
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
      name: organist
        ? `${organist.lastName}, ${organist.firstName}`
        : '',
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

  if (output === 'preview') return pdf.output('blob')
  const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Suguan'
  pdf.save(`${safeTitle} - Suguan.pdf`)
}
