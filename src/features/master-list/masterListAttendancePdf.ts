import bookAntiquaRegularUrl from '@/assets/fonts/BookAntiqua-Regular.ttf?url'
import bookAntiquaBoldUrl from '@/assets/fonts/BookAntiqua-Bold.ttf?url'
import type { Member, Trainee } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { createAttendanceDatePanels } from '@/lib/attendanceDatePanels'
import { formatDateKeyNumeric, isDateKey, type DateKey } from '@/lib/phDate'
import {
  buildMasterListAttendanceRows,
  paginateMasterListAttendanceRows,
} from './masterListAttendance'
import {
  MASTER_LIST_PAPER_SIZES,
  type MasterListPaperSize,
} from './masterListPaperSizes'

export type MasterListAttendanceOrientation = 'portrait' | 'landscape'

export interface MasterListAttendanceOptions {
  members: Member[]
  trainees: Trainee[]
  voices: VoicePosition[]
  dates: DateKey[]
  title: string
  groupByVoice: boolean
  selectedVoiceIds: string[]
  includeNagsasanayMen: boolean
  includeNagsasanayWomen: boolean
  lastNameFirst: boolean
  paperSize: MasterListPaperSize
  orientation: MasterListAttendanceOrientation
  pangulongName: string
  filename: string
}

async function fontAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Could not load a PDF font asset (${response.status}).`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

export async function exportMasterListAttendancePdf(
  options: MasterListAttendanceOptions,
): Promise<void> {
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
    pangulongName,
    filename,
  } = options
  if (!title.trim()) throw new Error('Enter a title for the attendance sheet.')
  if (!pangulongName.trim()) {
    throw new Error('Select an active Pangulong Mang-aawit for the signatory.')
  }
  if (dates.length === 0 || dates.some((date) => !isDateKey(date))) {
    throw new Error('Add at least one valid attendance date.')
  }
  const paper = MASTER_LIST_PAPER_SIZES.find(({ id }) => id === paperSize)
  if (!paper) throw new Error('The selected paper size is not supported.')

  const [{ jsPDF }, regular, bold] = await Promise.all([
    import('jspdf'),
    fontAsBase64(bookAntiquaRegularUrl),
    fontAsBase64(bookAntiquaBoldUrl),
  ])
  const widthPt = (paper.width * 72) / 25.4
  const heightPt = (paper.height * 72) / 25.4
  const isLandscape = orientation === 'landscape'
  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: isLandscape
      ? [heightPt, widthPt]
      : [widthPt, heightPt],
  })
  doc.addFileToVFS('BookAntiqua-Regular.ttf', regular)
  doc.addFont('BookAntiqua-Regular.ttf', 'BookAntiqua', 'normal')
  doc.addFileToVFS('BookAntiqua-Bold.ttf', bold)
  doc.addFont('BookAntiqua-Bold.ttf', 'BookAntiqua', 'bold')

  const rows = buildMasterListAttendanceRows(
    members,
    voices,
    groupByVoice ? selectedVoiceIds : null,
    trainees,
    includeNagsasanayMen,
    includeNagsasanayWomen,
    lastNameFirst,
  )
  if (rows.length === 0) {
    throw new Error('There are no active members or selected trainees to include.')
  }
  const datePanels = createAttendanceDatePanels(
    [...new Set(dates)].sort((left, right) => left.localeCompare(right)),
  )
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 34
  const tableWidth = pageWidth - margin * 2
  const numberWidth = 34
  const titleLines = doc.splitTextToSize(title.trim(), tableWidth)
  const titleTop = 34
  const tableTop = titleTop + titleLines.length * 23 + 16
  const tableHeaderHeight = 38
  const memberRowHeight = 26
  const sectionRowHeight = 22
  const regularPageHeight =
    pageHeight - tableTop - tableHeaderHeight - 32
  const finalPageHeight =
    pageHeight - 20 - 30 - 45 - tableTop - tableHeaderHeight
  const rowPages = paginateMasterListAttendanceRows(
    rows,
    regularPageHeight,
    finalPageHeight,
    memberRowHeight,
    sectionRowHeight,
  )

  let pageNumber = 0
  const totalPages = datePanels.length * rowPages.length
  for (const datePanel of datePanels) {
    for (const pageRows of rowPages) {
      if (pageNumber > 0) doc.addPage()
      pageNumber += 1

      const columnsInPanel = datePanel.length
      const nameWidth =
        columnsInPanel === 1
          ? tableWidth - numberWidth - 64
          : Math.min(180, tableWidth * 0.34)
      const columnWidth = (tableWidth - numberWidth - nameWidth) / columnsInPanel
      doc.setFont('BookAntiqua', 'bold')
      doc.setFontSize(18)
      doc.text(titleLines, pageWidth / 2, titleTop, {
        align: 'center',
        baseline: 'top',
      })

      const headerY = tableTop
      doc.setFillColor(239, 242, 245)
      doc.rect(margin, headerY, tableWidth, tableHeaderHeight, 'F')
      doc.setDrawColor(60, 60, 60)
      doc.setLineWidth(0.6)
      doc.rect(margin, headerY, tableWidth, tableHeaderHeight)
      const widths = [numberWidth, nameWidth, ...datePanel.map(() => columnWidth)]
      let x = margin
      const headers = [
        'Blg.',
        'Pangalan',
        ...datePanel.map((date) => formatDateKeyNumeric(date)),
      ]
      doc.setFont('BookAntiqua', 'bold')
      headers.forEach((header, index) => {
        const cellWidth = widths[index]
        doc.setFontSize(index < 2 ? 11 : 8)
        doc.text(header, x + cellWidth / 2, headerY + tableHeaderHeight / 2, {
          align: 'center',
          baseline: 'middle',
          maxWidth: cellWidth - 4,
        })
        x += cellWidth
        if (index < headers.length - 1) {
          doc.line(x, headerY, x, headerY + tableHeaderHeight)
        }
      })

      let y = headerY + tableHeaderHeight
      for (const row of pageRows) {
        if (row.kind === 'section') {
          doc.setFillColor(248, 248, 248)
          doc.rect(margin, y, tableWidth, sectionRowHeight, 'F')
          doc.rect(margin, y, tableWidth, sectionRowHeight)
          doc.setFont('BookAntiqua', 'bold')
          doc.setFontSize(9)
          doc.text(row.label, margin + 8, y + sectionRowHeight / 2, {
            baseline: 'middle',
          })
          y += sectionRowHeight
          continue
        }
        doc.rect(margin, y, tableWidth, memberRowHeight)
        let cellX = margin
        widths.forEach((cellWidth, index) => {
          if (index > 0) doc.line(cellX, y, cellX, y + memberRowHeight)
          if (index === 0) {
            doc.setFont('BookAntiqua', 'normal')
            doc.setFontSize(8)
            doc.text(String(row.number), cellX + cellWidth / 2, y + memberRowHeight / 2, {
              align: 'center',
              baseline: 'middle',
            })
          } else if (index === 1) {
            doc.setFont('BookAntiqua', 'normal')
            doc.setFontSize(9)
            doc.text(
              row.name,
              cellX + 5,
              y + memberRowHeight / 2,
              {
                baseline: 'middle',
                maxWidth: cellWidth - 10,
              },
            )
          }
          cellX += cellWidth
        })
        y += memberRowHeight
      }
      doc.setFont('BookAntiqua', 'normal')
      doc.setFontSize(7)
      doc.text(
        `${pageNumber} / ${totalPages}`,
        pageWidth - margin,
        pageHeight - 14,
        { align: 'right' },
      )
      if (pageNumber === totalPages) {
        const lastTableBottom =
          headerY +
          tableHeaderHeight +
          pageRows.reduce(
            (height, row) =>
              height + (row.kind === 'section' ? sectionRowHeight : memberRowHeight),
            0,
          )
        const signatureTop = Math.max(lastTableBottom + 30, pageHeight - 100)
        doc.setFont('BookAntiqua', 'normal')
        doc.setFontSize(10)
        doc.text('Naghanda:', pageWidth / 2, signatureTop, { align: 'center' })
        doc.setLineWidth(0.6)
        doc.line(
          pageWidth / 2 - 75,
          signatureTop + 16,
          pageWidth / 2 + 75,
          signatureTop + 16,
        )
        doc.setFont('BookAntiqua', 'bold')
        doc.setFontSize(10)
        doc.text(pangulongName.trim(), pageWidth / 2, signatureTop + 31, {
          align: 'center',
          maxWidth: pageWidth - margin * 2,
        })
        doc.setFont('BookAntiqua', 'normal')
        doc.setFontSize(9)
        doc.text(
          'Pangulong Mang-aawit',
          pageWidth / 2,
          signatureTop + 45,
          { align: 'center' },
        )
      }
    }
  }
  doc.save(filename)
}
