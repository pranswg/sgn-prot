import bookAntiquaRegularUrl from '@/assets/fonts/BookAntiqua-Regular.ttf?url'
import bookAntiquaBoldUrl from '@/assets/fonts/BookAntiqua-Bold.ttf?url'
import type { Choir, Member, Trainee } from '@/core/types/member'
import type { SuguanDocFormat, VoicePosition } from '@/core/types/suguan'
import { createAttendanceDatePanels } from '@/lib/attendanceDatePanels'
import { formatDateKeyNumeric, isDateKey, type DateKey } from '@/lib/phDate'
import {
  docMarginsMm,
  docPaperDimensionsMm,
  normalizeDocFormat,
} from '@/lib/suguanUtils'
import {
  attendanceNameFontSize,
  buildMasterListAttendanceSheets,
  fitAttendanceRowHeights,
  formatAttendanceDateSummary,
  paginateMasterListAttendanceRows,
} from './masterListAttendance'

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
  separateChoirs: boolean
  lastNameFirst: boolean
  docFormat: SuguanDocFormat
  choir: Choir
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

const mmToPt = (mm: number) => (mm * 72) / 25.4

/**
 * The sheet reads like the Suguan sheet: title, date summary, an optional
 * choir label, then the table. Header rows stay at Normal size; only member
 * names follow the selected font size.
 */
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
    separateChoirs,
    lastNameFirst,
    docFormat,
    choir,
    pangulongName,
    filename,
  } = options
  if (!title.trim()) throw new Error('Enter a title for the attendance sheet.')
  if (choir === 'aws' && !pangulongName.trim()) {
    throw new Error('Select an active Pangulong Mang-aawit for the signatory.')
  }
  if (dates.length === 0 || dates.some((date) => !isDateKey(date))) {
    throw new Error('Add at least one valid attendance date.')
  }
  const format = normalizeDocFormat(docFormat)
  const dimensions = docPaperDimensionsMm(format)
  const margins = docMarginsMm(format)

  const [{ jsPDF }, regular, bold] = await Promise.all([
    import('jspdf'),
    fontAsBase64(bookAntiquaRegularUrl),
    fontAsBase64(bookAntiquaBoldUrl),
  ])
  const widthPt = mmToPt(dimensions.width)
  const heightPt = mmToPt(dimensions.height)
  const isLandscape = format.orientation === 'landscape'
  const doc = new jsPDF({
    orientation: format.orientation,
    unit: 'pt',
    format: isLandscape ? [heightPt, widthPt] : [widthPt, heightPt],
  })
  doc.addFileToVFS('BookAntiqua-Regular.ttf', regular)
  doc.addFont('BookAntiqua-Regular.ttf', 'BookAntiqua', 'normal')
  doc.addFileToVFS('BookAntiqua-Bold.ttf', bold)
  doc.addFont('BookAntiqua-Bold.ttf', 'BookAntiqua', 'bold')

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
  const dateSummary = formatAttendanceDateSummary(dates)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginLeft = mmToPt(margins.left)
  const marginRight = mmToPt(margins.right)
  const marginTop = mmToPt(margins.top)
  const pageBottom = pageHeight - mmToPt(margins.bottom)
  const tableWidth = pageWidth - marginLeft - marginRight
  const numberWidth = 34
  const titleLines = doc.splitTextToSize(title.trim(), tableWidth)
  const titleTop = marginTop
  const dateSummaryTop = titleTop + titleLines.length * 23 + 9
  // The choir indicator sits directly under the dates, like a second title
  // line: no extra gap above or below it.
  const choirLabelTop = dateSummaryTop + 16
  const choirLabelFontSize = 14
  const continuationTableTop = marginTop
  // Date over Lagda: one tight pair, not two spaced lines.
  const tableHeaderHeight = 36
  const dateHeaderY = 12
  const lagdaHeaderY = 24
  const nameFontSize = attendanceNameFontSize(format)
  const nameSpacing =
    (format.tableSpacingBeforePt ?? 0) + (format.tableSpacingAfterPt ?? 0)
  // Roster names only: a larger chosen size grows the row, and table spacing
  // adds to it without ever changing the font size.
  const baseMemberRowHeight = Math.max(26, nameFontSize * 1.8)
  const baseSectionRowHeight = 22
  const signatureReserve = 20 + 30 + (choir === 'aws' ? 54 : 0)
  const regularPageHeight =
    pageBottom - continuationTableTop - tableHeaderHeight - 32
  const finalPageHeight =
    pageBottom - signatureReserve - continuationTableTop - tableHeaderHeight

  const plans = sheets.map((sheet) => {
    const tableTop = sheet.label ? choirLabelTop + 17 : dateSummaryTop + 16
    const firstPageHeight = pageBottom - tableTop - tableHeaderHeight - 32
    const firstFinalPageHeight =
      pageBottom - signatureReserve - tableTop - tableHeaderHeight
    const fit = fitAttendanceRowHeights(
      sheet.rows,
      firstFinalPageHeight,
      baseMemberRowHeight,
      baseSectionRowHeight,
      format.scaling,
    )
    const memberRowHeight = fit.memberRowHeight + nameSpacing
    const sectionRowHeight = fit.sectionRowHeight
    const rowPages = paginateMasterListAttendanceRows(
      sheet.rows,
      regularPageHeight,
      finalPageHeight,
      memberRowHeight,
      sectionRowHeight,
      { height: firstPageHeight, finalHeight: firstFinalPageHeight },
    )
    return { sheet, tableTop, memberRowHeight, sectionRowHeight, rowPages }
  })

  let pageNumber = 0
  const totalPages = plans.reduce(
    (total, plan) => total + datePanels.length * plan.rowPages.length,
    0,
  )
  for (const plan of plans) {
    let sheetPage = 0
    for (const datePanel of datePanels) {
      for (const pageRows of plan.rowPages) {
        if (pageNumber > 0) doc.addPage()
        pageNumber += 1
        sheetPage += 1

        const columnsInPanel = datePanel.length
        const nameWidth =
          columnsInPanel === 1
            ? tableWidth - numberWidth - 64
            : Math.min(180, tableWidth * 0.34)
        const columnWidth = (tableWidth - numberWidth - nameWidth) / columnsInPanel
        const firstSheetPage = sheetPage === 1
        const headerY = firstSheetPage ? plan.tableTop : continuationTableTop
        if (firstSheetPage) {
          doc.setFont('BookAntiqua', 'bold')
          doc.setFontSize(18)
          doc.text(titleLines, pageWidth / 2, titleTop, {
            align: 'center',
            baseline: 'top',
          })
          doc.setFont('BookAntiqua', 'normal')
          doc.setFontSize(12)
          doc.text(dateSummary, pageWidth / 2, dateSummaryTop, {
            align: 'center',
            maxWidth: tableWidth,
          })
          if (plan.sheet.label) {
            doc.setFont('BookAntiqua', 'bold')
            doc.setFontSize(choirLabelFontSize)
            doc.text(plan.sheet.label, pageWidth / 2, choirLabelTop, {
              align: 'center',
            })
          }
        }

        doc.setFillColor(239, 242, 245)
        doc.rect(marginLeft, headerY, tableWidth, tableHeaderHeight, 'F')
        doc.setDrawColor(60, 60, 60)
        doc.setLineWidth(0.6)
        doc.rect(marginLeft, headerY, tableWidth, tableHeaderHeight)
        const widths = [numberWidth, nameWidth, ...datePanel.map(() => columnWidth)]
        let x = marginLeft
        const headers = [
          'Blg.',
          'Pangalan',
          ...datePanel.map((date) => formatDateKeyNumeric(date)),
        ]
        doc.setFont('BookAntiqua', 'bold')
        headers.forEach((header, index) => {
          const cellWidth = widths[index]
          doc.setFontSize(index < 2 ? 11 : 8)
          if (index < 2) {
            doc.text(header, x + cellWidth / 2, headerY + tableHeaderHeight / 2, {
              align: 'center',
              baseline: 'middle',
              maxWidth: cellWidth - 4,
            })
          } else {
            const centerX = x + cellWidth / 2
            doc.text(header, centerX, headerY + dateHeaderY, {
              align: 'center',
              baseline: 'middle',
              maxWidth: cellWidth - 4,
            })
            doc.setFont('BookAntiqua', 'normal')
            doc.text('Lagda', centerX, headerY + lagdaHeaderY, {
              align: 'center',
              baseline: 'middle',
              maxWidth: cellWidth - 4,
            })
            doc.setFont('BookAntiqua', 'bold')
          }
          x += cellWidth
          if (index < headers.length - 1) {
            doc.line(x, headerY, x, headerY + tableHeaderHeight)
          }
        })

        let y = headerY + tableHeaderHeight
        for (const row of pageRows) {
          if (row.kind === 'section') {
            doc.setFillColor(248, 248, 248)
            doc.rect(marginLeft, y, tableWidth, plan.sectionRowHeight, 'F')
            doc.rect(marginLeft, y, tableWidth, plan.sectionRowHeight)
            doc.setFont('BookAntiqua', 'bold')
            doc.setFontSize(9)
            doc.text(row.label, marginLeft + 8, y + plan.sectionRowHeight / 2, {
              baseline: 'middle',
            })
            y += plan.sectionRowHeight
            continue
          }
          doc.rect(marginLeft, y, tableWidth, plan.memberRowHeight)
          let cellX = marginLeft
          widths.forEach((cellWidth, index) => {
            if (index > 0) doc.line(cellX, y, cellX, y + plan.memberRowHeight)
            if (index === 0) {
              doc.setFont('BookAntiqua', 'normal')
              doc.setFontSize(8)
              doc.text(
                String(row.number),
                cellX + cellWidth / 2,
                y + plan.memberRowHeight / 2,
                { align: 'center', baseline: 'middle' },
              )
            } else if (index === 1) {
              doc.setFont('BookAntiqua', 'normal')
              doc.setFontSize(nameFontSize)
              doc.text(
                row.name,
                cellX + 5,
                y + plan.memberRowHeight / 2,
                {
                  baseline: 'middle',
                  maxWidth: cellWidth - 10,
                },
              )
            }
            cellX += cellWidth
          })
          y += plan.memberRowHeight
        }
        doc.setFont('BookAntiqua', 'normal')
        doc.setFontSize(7)
        // Inside the content box, not in the printer's unprintable bottom
        // margin where a page number gets clipped.
        doc.text(
          `${pageNumber} / ${totalPages}`,
          pageWidth - marginRight,
          pageBottom - 3,
          { align: 'right' },
        )
        if (pageNumber === totalPages && choir === 'aws') {
          const lastTableBottom =
            headerY +
            tableHeaderHeight +
            pageRows.reduce(
              (height, row) =>
                height +
                (row.kind === 'section'
                  ? plan.sectionRowHeight
                  : plan.memberRowHeight),
              0,
            )
          const signatureTop = Math.max(lastTableBottom + 30, pageBottom - 100)
          doc.setFont('BookAntiqua', 'normal')
          doc.setFontSize(10)
          doc.text('Naghanda:', pageWidth / 2, signatureTop, { align: 'center' })
          doc.setFont('BookAntiqua', 'bold')
          doc.setFontSize(10)
          doc.text(pangulongName.trim(), pageWidth / 2, signatureTop + 31, {
            align: 'center',
            maxWidth: pageWidth - marginLeft - marginRight,
          })
          doc.setLineWidth(0.6)
          doc.line(
            pageWidth / 2 - 75,
            signatureTop + 37,
            pageWidth / 2 + 75,
            signatureTop + 37,
          )
          doc.setFont('BookAntiqua', 'normal')
          doc.setFontSize(9)
          doc.text(
            'Pangulong Mang-aawit',
            pageWidth / 2,
            signatureTop + 54,
            { align: 'center' },
          )
        }
      }
    }
  }
  doc.save(filename)
}
