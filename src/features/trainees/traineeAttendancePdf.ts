import bookAntiquaRegularUrl from '@/assets/fonts/BookAntiqua-Regular.ttf?url'
import bookAntiquaBoldUrl from '@/assets/fonts/BookAntiqua-Bold.ttf?url'
import segoeScriptUrl from '@/assets/fonts/SegoeScript.ttf?url'
import type { Trainee } from '@/core/types/member'
import { exportFileName } from '@/lib/exportNaming'
import {
  formatDateKeyLongDate,
  isDateKey,
  toDateKeyFromInstant,
  type DateKey,
} from '@/lib/phDate'
import type { jsPDF } from 'jspdf'
import { createAttendanceDatePanels } from './attendanceSheetDates'
import { sortTraineesForAttendanceSheet } from './attendanceSheetSort'

export type AttendancePaperSize = 'a4' | 'letter' | 'legal'
export type AttendanceOrientation = 'portrait' | 'landscape'

const PAPER_DIMENSIONS: Record<AttendancePaperSize, [number, number]> = {
  a4: [210, 297],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
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

function dateRangeLabel(startDate: DateKey, endDate: DateKey): string {
  const start = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${startDate}T00:00:00Z`))
  const end = formatDateKeyLongDate(endDate)
  const year = endDate.slice(0, 4)
  if (startDate.slice(0, 4) !== year) {
    return `${formatDateKeyLongDate(startDate)} - ${end}`
  }
  return `${start} - ${end.replace(`, ${year}`, '')}, ${year}`
}

function shortPracticeDate(date: DateKey): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function traineeFullName(trainee: Trainee): string {
  return [
    trainee.firstName,
    trainee.middleName,
    trainee.lastName,
    trainee.suffix,
  ]
    .filter(Boolean)
    .join(' ')
}

function registerFonts(
  doc: jsPDF,
  bookRegular: string,
  bookBold: string,
  segoeScript: string,
): void {
  doc.addFileToVFS('BookAntiqua-Regular.ttf', bookRegular)
  doc.addFont('BookAntiqua-Regular.ttf', 'BookAntiqua', 'normal')
  doc.addFileToVFS('BookAntiqua-Bold.ttf', bookBold)
  doc.addFont('BookAntiqua-Bold.ttf', 'BookAntiqua', 'bold')
  doc.addFileToVFS('SegoeScript.ttf', segoeScript)
  doc.addFont('SegoeScript.ttf', 'SegoeScript', 'normal')
}

export async function exportTraineeAttendancePdf(options: {
  trainees: Trainee[]
  practiceDates: DateKey[]
  startDate: DateKey
  endDate: DateKey
  localeName: string
  pangulongName: string
  paperSize: AttendancePaperSize
  orientation: AttendanceOrientation
}): Promise<void> {
  const {
    trainees,
    practiceDates,
    startDate,
    endDate,
    localeName,
    pangulongName,
    paperSize,
    orientation,
  } = options
  if (!isDateKey(startDate) || !isDateKey(endDate) || startDate > endDate) {
    throw new Error('Choose a valid attendance date range.')
  }
  if (practiceDates.length === 0) {
    throw new Error('Select at least one practice day in the date range.')
  }
  if (!pangulongName.trim()) {
    throw new Error('Select an active Pangulong Mang-aawit from the Master List.')
  }

  const [{ jsPDF }] = await Promise.all([import('jspdf')])
  const [bookRegular, bookBold, segoeScript] = await Promise.all([
    fontAsBase64(bookAntiquaRegularUrl),
    fontAsBase64(bookAntiquaBoldUrl),
    fontAsBase64(segoeScriptUrl),
  ])
  const generatedAt = new Date()
  const paperDimensions = PAPER_DIMENSIONS[paperSize]
  const [firstMm, secondMm] = paperDimensions
  const firstPt = firstMm * 72 / 25.4
  const secondPt = secondMm * 72 / 25.4
  const isLandscape = orientation === 'landscape'
  const widthPt = isLandscape ? secondPt : firstPt
  const heightPt = isLandscape ? firstPt : secondPt
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [widthPt, heightPt],
  })
  registerFonts(doc, bookRegular, bookBold, segoeScript)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const left = 34
  const tableWidth = pageWidth - left * 2
  const titleTop = 38
  const tableTop = 105
  const tableHeaderHeight = 38
  const rowHeight = 28
  const footerReserve = 162
  const numberWidth = 32
  const nameWidth = Math.min(165, tableWidth * 0.29)
  const rowsPerPage = Math.max(
    1,
    Math.floor(
      (pageHeight - footerReserve - tableTop - tableHeaderHeight) / rowHeight,
    ),
  )
  const sortedTrainees = sortTraineesForAttendanceSheet(trainees)
  const tableRows = [
    ...sortedTrainees.map((trainee) => traineeFullName(trainee)),
    '',
    '',
    '',
  ]
  const datePanels = createAttendanceDatePanels(practiceDates)
  const rowPages: string[][] = []
  for (let index = 0; index < tableRows.length; index += rowsPerPage) {
    rowPages.push(tableRows.slice(index, index + rowsPerPage))
  }
  const dateRange = dateRangeLabel(startDate, endDate)
  const asOfDate = formatDateKeyLongDate(toDateKeyFromInstant(generatedAt))
  let pageNumber = 0
  let lastTableBottom = tableTop

  for (let panelIndex = 0; panelIndex < datePanels.length; panelIndex += 1) {
    const dates = datePanels[panelIndex]
    for (let rowPageIndex = 0; rowPageIndex < rowPages.length; rowPageIndex += 1) {
      if (pageNumber > 0) doc.addPage()
      pageNumber += 1
      const names = rowPages[rowPageIndex]
      const finalPage =
        panelIndex === datePanels.length - 1 &&
        rowPageIndex === rowPages.length - 1
      const currentDateWidth =
        (tableWidth - numberWidth - nameWidth) / dates.length

      doc.setFont('BookAntiqua', 'normal')
      doc.setFontSize(14)
      doc.text(`Lokal ng ${localeName.trim() || 'Sta. Monica'}`, pageWidth / 2, titleTop, {
        align: 'center',
      })
      doc.setFont('SegoeScript', 'normal')
      doc.setFontSize(17)
      doc.text(
        'ATTENDANCE NG MGA NAGSASANAY SA MANG-AAWIT',
        pageWidth / 2,
        titleTop + 23,
        { align: 'center', maxWidth: pageWidth - 50 },
      )
      doc.setFont('BookAntiqua', 'normal')
      doc.setFontSize(11)
      doc.text(dateRange, pageWidth / 2, titleTop + 43, { align: 'center' })

      const columns = [
        { label: 'Blg.', width: numberWidth },
        { label: 'Pangalan', width: nameWidth },
        ...dates.map((date) => ({
          label: shortPracticeDate(date),
          width: currentDateWidth,
        })),
      ]
      let x = left
      doc.setLineWidth(0.55)
      doc.setDrawColor(40, 40, 40)
      doc.setFont('BookAntiqua', 'bold')
      doc.setFontSize(Math.min(10, currentDateWidth / 5.1))
      for (const column of columns) {
        doc.rect(x, tableTop, column.width, tableHeaderHeight)
        const centerX = x + column.width / 2
        if (column.label === 'Blg.' || column.label === 'Pangalan') {
          doc.text(column.label, centerX, tableTop + 23, {
            align: 'center',
            maxWidth: column.width - 4,
          })
        } else {
          doc.text(column.label, centerX, tableTop + 15, {
            align: 'center',
            maxWidth: column.width - 4,
          })
          doc.setFont('BookAntiqua', 'normal')
          doc.text('Lagda', centerX, tableTop + 30, {
            align: 'center',
            maxWidth: column.width - 4,
          })
          doc.setFont('BookAntiqua', 'bold')
        }
        x += column.width
      }

      doc.setFont('BookAntiqua', 'normal')
      doc.setFontSize(10)
      names.forEach((name, index) => {
        const rowIndex = rowPageIndex * rowsPerPage + index
        const y = tableTop + tableHeaderHeight + index * rowHeight
        x = left
        columns.forEach((column, columnIndex) => {
          doc.rect(x, y, column.width, rowHeight)
          const value =
            columnIndex === 0
              ? `${rowIndex + 1}.`
              : columnIndex === 1
                ? name
                : ''
          if (value) {
            doc.text(value, columnIndex === 1 ? x + 5 : x + column.width / 2, y + 15.5, {
              align: columnIndex === 1 ? 'left' : 'center',
              maxWidth: column.width - (columnIndex === 1 ? 9 : 4),
            })
          }
          x += column.width
        })
      })

      lastTableBottom = tableTop + tableHeaderHeight + names.length * rowHeight
      doc.setFont('BookAntiqua', 'normal')
      doc.setFontSize(10)
      doc.text(`printed as of ${asOfDate}`, left, lastTableBottom + 12)

      if (finalPage) {
        const signatureTop = Math.max(lastTableBottom + 65, pageHeight - 155)
        doc.setFontSize(12)
        doc.text('Naghanda:', pageWidth / 2, signatureTop, { align: 'center' })
        doc.setLineWidth(0.6)
        doc.line(pageWidth / 2 - 75, signatureTop + 18, pageWidth / 2 + 75, signatureTop + 18)
        doc.setFont('BookAntiqua', 'bold')
        doc.text(pangulongName.trim(), pageWidth / 2, signatureTop + 34, {
          align: 'center',
          maxWidth: pageWidth - 70,
        })
        doc.setFont('BookAntiqua', 'normal')
        doc.text('Pangulong Mang-aawit', pageWidth / 2, signatureTop + 51, {
          align: 'center',
        })
      }
    }
  }

  doc.save(exportFileName('Nagsasanay Attendance Sheet', 'pdf'))
}
