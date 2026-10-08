import bookAntiquaRegularUrl from '@/assets/fonts/BookAntiqua-Regular.ttf?url'
import bookAntiquaBoldUrl from '@/assets/fonts/BookAntiqua-Bold.ttf?url'
import segoeScriptUrl from '@/assets/fonts/SegoeScript.ttf?url'
import {
  getVoiceName,
  UNASSIGNED_VOICE_ID,
} from '@/core/constants/voicePositions'
import type { Member, Trainee } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  groupMasterListPdfSections,
  masterListPdfName,
  masterListPdfPosition,
  sortMasterListPdfMembers,
  splitMasterListPdfSections,
  summarizeMasterList,
} from '@/lib/masterListPdfData'
import type { DutyRole } from '@/core/types/suguan'
import {
  MASTER_LIST_PAPER_SIZES,
  type MasterListPaperSize,
} from './masterListPaperSizes'
import {
  formatMasterListPdfTimestamp,
  paperSizePoints,
} from './masterListPdfUtils'

const PAGE_MARGIN = 38
const FOOTER_MARGIN = 28
const TABLE_HEADERS = ['Blg.', 'Pangalan', 'Voice', 'Status', 'Position']
const TABLE_COLUMN_SHARES = [60, 220, 96, 78, 120]
const TABLE_COLUMN_SHARE_TOTAL = TABLE_COLUMN_SHARES.reduce(
  (total, value) => total + value,
  0,
)

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

function traineeVoiceName(
  trainee: Trainee,
  voices: VoicePosition[],
): string {
  return trainee.voicePosition === UNASSIGNED_VOICE_ID
    ? 'Unassigned'
    : getVoiceName(trainee.voicePosition, voices)
}

export async function exportMasterListPdf(
  members: Member[],
  trainees: Trainee[],
  voices: VoicePosition[],
  dutyRoles: DutyRole[],
  localeName: string,
  paperSize: MasterListPaperSize,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const [bookRegular, bookBold, segoeScript] = await Promise.all([
    fontAsBase64(bookAntiquaRegularUrl),
    fontAsBase64(bookAntiquaBoldUrl),
    fontAsBase64(segoeScriptUrl),
  ])
  const paper = MASTER_LIST_PAPER_SIZES.find((item) => item.id === paperSize)
  if (!paper) throw new Error('The selected paper size is not supported.')
  const { width: widthPt, height: heightPt } = paperSizePoints(
    paper.width,
    paper.height,
  )
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: [widthPt, heightPt],
  })
  doc.addFileToVFS('BookAntiqua-Regular.ttf', bookRegular)
  doc.addFont('BookAntiqua-Regular.ttf', 'BookAntiqua', 'normal')
  doc.addFileToVFS('BookAntiqua-Bold.ttf', bookBold)
  doc.addFont('BookAntiqua-Bold.ttf', 'BookAntiqua', 'bold')
  doc.addFileToVFS('SegoeScript.ttf', segoeScript)
  doc.addFont('SegoeScript.ttf', 'SegoeScript', 'normal')

  doc.setFont('SegoeScript', 'normal')
  doc.setFontSize(21)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.text('MASTER LIST', pageWidth / 2, 49, { align: 'center' })

  let nextY = 70
  const sections = groupMasterListPdfSections(
    members,
    trainees,
    localeName,
    dutyRoles,
  )
  const { contentSections, hierarchySections } =
    splitMasterListPdfSections(sections)
  const tableWidth = pageWidth - PAGE_MARGIN * 2
  const renderSections = (renderedSections: typeof sections) => {
    for (const section of renderedSections) {
      const rows =
        section.kind === 'members'
          ? sortMasterListPdfMembers(section.members, voices, section.order).map(
              (member, index) => [
                `${index + 1}.`,
                masterListPdfName(member),
                getVoiceName(member.voicePosition, voices),
                member.isActive ? 'Active' : 'Inactive',
                masterListPdfPosition(member, dutyRoles),
              ],
            )
          : section.trainees.map((trainee, index) => [
              `${index + 1}.`,
              masterListPdfName(trainee),
              traineeVoiceName(trainee, voices),
              trainee.status === 'active' ? 'Active' : 'Inactive',
              'Nagsasanay',
            ])

      if (nextY > pageHeight - PAGE_MARGIN - FOOTER_MARGIN - 90) {
        doc.addPage()
        nextY = PAGE_MARGIN
      }
      let tableFinalY = nextY
      autoTable(doc, {
        startY: nextY,
        margin: {
          left: PAGE_MARGIN,
          right: PAGE_MARGIN,
          bottom: FOOTER_MARGIN,
        },
        head: [
          [{ content: section.title, colSpan: TABLE_HEADERS.length }],
          TABLE_HEADERS,
        ],
        body: rows,
        showHead: 'everyPage',
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        theme: 'grid',
        styles: {
          font: 'BookAntiqua',
          fontStyle: 'normal',
          fontSize: 10,
          textColor: 0,
          lineColor: 0,
          lineWidth: 0.45,
          cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
          overflow: 'linebreak',
        },
        headStyles: {
          font: 'BookAntiqua',
          fontStyle: 'bold',
          fillColor: [255, 255, 255],
          textColor: 0,
          halign: 'center',
          valign: 'middle',
        },
        columnStyles: {
          0: {
            cellWidth:
              (tableWidth * TABLE_COLUMN_SHARES[0]) / TABLE_COLUMN_SHARE_TOTAL,
            halign: 'center',
          },
          1: {
            cellWidth:
              (tableWidth * TABLE_COLUMN_SHARES[1]) / TABLE_COLUMN_SHARE_TOTAL,
            halign: 'left',
          },
          2: {
            cellWidth:
              (tableWidth * TABLE_COLUMN_SHARES[2]) / TABLE_COLUMN_SHARE_TOTAL,
            halign: 'center',
          },
          3: {
            cellWidth:
              (tableWidth * TABLE_COLUMN_SHARES[3]) / TABLE_COLUMN_SHARE_TOTAL,
            halign: 'center',
          },
          4: {
            cellWidth:
              (tableWidth * TABLE_COLUMN_SHARES[4]) / TABLE_COLUMN_SHARE_TOTAL,
            halign: 'center',
          },
        },
        didParseCell: (data) => {
          if (data.section === 'head' && data.row.index === 0) {
            data.cell.styles.fontSize = 11
          }
        },
        didDrawPage: (data) => {
          if (data.cursor) tableFinalY = data.cursor.y
        },
      })
      nextY = tableFinalY + 18
    }
  }

  renderSections(contentSections)
  doc.addPage()
  doc.setFont('SegoeScript', 'normal')
  doc.setFontSize(20)
  doc.text('PANGULUHAN', pageWidth / 2, 49, { align: 'center' })
  nextY = 70
  if (hierarchySections.length > 0) {
    renderSections(hierarchySections)
  } else {
    doc.setFont('BookAntiqua', 'normal')
    doc.setFontSize(11)
    doc.text('No assigned rankings', PAGE_MARGIN, nextY)
  }

  const summaryDetails = summarizeMasterList(members, trainees, voices)
  const summaryRows = summaryDetails.map(
    (row) => [row.category, row.kind === 'item' ? String(row.count) : ''],
  )
  doc.addPage()
  autoTable(doc, {
    startY: PAGE_MARGIN,
    margin: {
      left: PAGE_MARGIN,
      right: PAGE_MARGIN,
      bottom: FOOTER_MARGIN,
    },
    head: [['MASTER LIST SUMMARY', 'COUNT']],
    body: summaryRows,
    showHead: 'everyPage',
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: tableWidth - 76, halign: 'left' },
      1: { cellWidth: 76, halign: 'center' },
    },
    styles: {
      font: 'BookAntiqua',
      fontStyle: 'normal',
      fontSize: 12,
      textColor: 0,
      lineColor: 0,
      lineWidth: 0.45,
      cellPadding: { top: 6, right: 8, bottom: 6, left: 8 },
    },
    headStyles: {
      font: 'BookAntiqua',
      fontStyle: 'bold',
      fontSize: 12,
      fillColor: [255, 255, 255],
      textColor: 0,
      halign: 'center',
      minCellHeight: 28,
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const summaryRow = summaryDetails[data.row.index]
        if (summaryRow?.kind === 'section') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = [242, 242, 242]
        }
      }
    },
  })

  const timestamp = formatMasterListPdfTimestamp(new Date())
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page)
    doc.setFont('BookAntiqua', 'normal')
    doc.setFontSize(8)
    const footerY = doc.internal.pageSize.getHeight() - 16
    doc.text(timestamp, PAGE_MARGIN, footerY, {
      align: 'left',
    })
    doc.text(
      `Page ${page} of ${doc.getNumberOfPages()}`,
      pageWidth - PAGE_MARGIN,
      footerY,
      { align: 'right' },
    )
  }

  doc.save(`master-list-${paperSize}.pdf`)
}
