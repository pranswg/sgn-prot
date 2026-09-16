import type { Suguan, SuguanDocFormat } from '@/core/types/suguan'
import { computeSuguanLayout, type SheetMembers } from '@/lib/suguanExport'
import {
  eventTypeLabel,
  formatEventDate,
  resolveSignatureNames,
  suguanFileName,
  suguanSheetTitle,
} from '@/lib/suguanUtils'
import robotoBoldUrl from '@/assets/fonts/Roboto-Bold.ttf?url'
import robotoRegularUrl from '@/assets/fonts/Roboto-Regular.ttf?url'

const PT_TO_MM = 25.4 / 72
const BORDER = { r: 139, g: 139, b: 139 }
const HEADER_FILL = { r: 242, g: 242, b: 242 }
const PAGSASANAY_FILL = { r: 255, g: 242, b: 204 }
const PAGTUPAD_FILL = { r: 217, g: 234, b: 211 }
const SCHEDULE_FILL = { r: 198, g: 239, b: 206 }

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load font asset (${res.status})`)
  const data = new Uint8Array(await res.arrayBuffer())
  let binary = ''
  for (let i = 0; i < data.length; i += 0x8000) {
    const chunk = data.subarray(i, i + 0x8000)
    binary += Array.from(chunk, (c) => String.fromCharCode(c)).join('')
  }
  return btoa(binary)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportSuguanPdf(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const layout = computeSuguanLayout(suguan, members, docFormat)
  const { fmt, fs } = layout
  const m = layout.margins
  const scale = layout.scale || 1

  const titleSz = fs.titleFontSize * scale
  const headerSz = fs.headerFontSize * scale
  const bodySz = Math.max(6, layout.nameFontSize * scale)
  const smallSz = fs.smallFontSize * scale

  const x0 = m.left
  const tableW = layout.paperWidthMm - m.left - m.right
  const xName = x0 + layout.noColWidthMm
  const eventXs = layout.events.map(
    (_, i) => xName + layout.nameColWidthMm + i * layout.eventColWidthMm,
  )
  const x1 = xName + layout.nameColWidthMm + layout.events.length * layout.eventColWidthMm

  const [regularB64, boldB64] = await Promise.all([
    fetchAsBase64(robotoRegularUrl),
    fetchAsBase64(robotoBoldUrl),
  ])

  const doc = new jsPDF({
    orientation: fmt.orientation as 'landscape' | 'portrait',
    unit: 'mm',
    format: [layout.paperWidthMm, layout.paperHeightMm],
  })
  doc.setLineWidth(0.13)
  doc.addFileToVFS('Roboto-Regular.ttf', regularB64)
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', boldB64)
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')

  const applyFont = (style: 'normal' | 'bold', sizePt: number) => {
    doc.setFont('Roboto', style)
    doc.setFontSize(sizePt)
  }
  const textWidth = (text: string) => doc.getTextWidth(text)
  const centerText = (text: string, x: number, y: number) =>
    doc.text(text, x, y, { align: 'center', baseline: 'middle' })
  const leftText = (text: string, x: number, y: number) =>
    doc.text(text, x, y, { align: 'left', baseline: 'middle' })

  const drawTop = () => {
    const headerTopY = layout.headerTopY

    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
    doc.line(x0, m.top, x1, m.top)
    doc.line(x0, headerTopY, x1, headerTopY)
    doc.line(x0, m.top, x0, headerTopY)
    doc.line(x1, m.top, x1, headerTopY)

    applyFont('bold', titleSz)
    const titleLines = doc.splitTextToSize(suguanSheetTitle(suguan), tableW - 1.1)
    const titleLineH = titleSz * 1.15 * PT_TO_MM
    const titleBlockH = titleLines.length * titleLineH
    let titleY = m.top + Math.max(0.5, (layout.titleRowH - titleBlockH) / 2)
    for (const line of titleLines) {
      centerText(line, x0 + tableW / 2, titleY + titleLineH / 2)
      titleY += titleLineH
    }

    doc.setFillColor(HEADER_FILL.r, HEADER_FILL.g, HEADER_FILL.b)
    doc.rect(x0, headerTopY, layout.noColWidthMm, layout.headerRowH * 2, 'F')
    doc.rect(xName, headerTopY, layout.nameColWidthMm, layout.headerRowH * 2, 'F')

    layout.events.forEach((e, i) => {
      const fill = e.type === 'pagsasanay' ? PAGSASANAY_FILL : PAGTUPAD_FILL
      doc.setFillColor(fill.r, fill.g, fill.b)
      doc.rect(eventXs[i], headerTopY, layout.eventColWidthMm, layout.headerRowH, 'F')
      doc.rect(eventXs[i], headerTopY + layout.headerRowH, layout.eventColWidthMm, layout.headerRowH, 'F')
    })

    const headerBottom = headerTopY + layout.headerRowH * 2
    doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
    doc.line(x0, headerTopY, x1, headerTopY)
    if (layout.events.length > 0) {
      doc.line(eventXs[0], headerTopY + layout.headerRowH, x1, headerTopY + layout.headerRowH)
    }
    doc.line(x0, headerBottom, x1, headerBottom)
    ;[x0, xName, ...eventXs, x1].forEach((vx) => {
      doc.line(vx, headerTopY, vx, headerBottom)
    })

    applyFont('bold', headerSz)
    centerText('No.', x0 + layout.noColWidthMm / 2, headerTopY + layout.headerRowH)
    centerText(
      'PANGALAN',
      xName + layout.nameColWidthMm / 2,
      headerTopY + layout.headerRowH,
    )
    layout.events.forEach((e, i) => {
      const cx = eventXs[i] + layout.eventColWidthMm / 2
      centerText(
        eventTypeLabel(e.type),
        cx,
        headerTopY + layout.headerRowH / 2,
      )
      applyFont('bold', headerSz * 0.95)
      centerText(
        formatEventDate(e),
        cx,
        headerTopY + layout.headerRowH * 1.5,
      )
      applyFont('bold', headerSz)
    })
  }

  const fitSizeToWidth = (
    text: string,
    startSize: number,
    maxWidth: number,
    style: 'normal' | 'bold',
    minSize = 6,
  ): number => {
    let size = startSize
    applyFont(style, size)
    while (size > minSize && textWidth(text) > maxWidth) {
      size -= 0.5
      applyFont(style, size)
    }
    return size
  }

  layout.pages.forEach((blocks, pi) => {
    if (pi > 0) doc.addPage()
    drawTop()

    let y = layout.headerTopY + layout.headerRowH * 2
    const cols = [
      { x: x0, w: layout.noColWidthMm },
      { x: xName, w: layout.nameColWidthMm },
      ...eventXs.map((x, i) => ({ x, w: layout.eventColWidthMm, i })),
    ]

    for (const block of blocks) {
if (block.kind === 'section-label') {
        const section = layout.sections[block.sectionIndex]
        doc.setFillColor(SCHEDULE_FILL.r, SCHEDULE_FILL.g, SCHEDULE_FILL.b)
        doc.rect(xName, y, layout.nameColWidthMm, layout.sectionLabelRowH, 'F')
        doc.rect(x0, y, layout.noColWidthMm, layout.sectionLabelRowH, 'S')
        doc.rect(xName, y, layout.nameColWidthMm, layout.sectionLabelRowH, 'S')
        for (const ev of eventXs) {
          doc.rect(ev, y, layout.eventColWidthMm, layout.sectionLabelRowH, 'S')
        }
        applyFont('bold', headerSz)
        centerText(
          section.label,
          xName + layout.nameColWidthMm / 2,
          y + layout.sectionLabelRowH / 2,
        )
        y += layout.sectionLabelRowH
      } else if (block.kind === 'member') {
        const section = layout.sections[block.sectionIndex]
        const row = section.rows[block.rowIndex]
        applyFont('normal', bodySz)
        const nameSize = fitSizeToWidth(
          row.name,
          bodySz,
          layout.nameColWidthMm - 1.6,
          'normal',
        )
        for (const col of cols) {
          doc.rect(col.x, y, col.w, layout.bodyRowH, 'S')
        }
        applyFont('normal', nameSize)
        centerText(String(row.no), x0 + layout.noColWidthMm / 2, y + layout.bodyRowH / 2)
        leftText(row.name, xName + 0.79, y + layout.bodyRowH / 2)
        y += layout.bodyRowH
      } else if (block.kind === 'sig-name') {
        const { pmName, destinadoName } = resolveSignatureNames(suguan, members)
        const halfCx1 = x0 + tableW * 0.25
        const halfCx2 = x0 + tableW * 0.75
        const halfWidth = tableW / 2
        const midY = y + layout.sigRowH / 2
        applyFont('bold', bodySz)
        ;[
          { name: pmName, cx: halfCx1 },
          { name: destinadoName, cx: halfCx2 },
        ].forEach(({ name, cx }) => {
          const size = fitSizeToWidth(name, bodySz, halfWidth - 2, 'bold')
          centerText(name, cx, midY)
          const ulY = y + layout.sigRowH / 2 + size * 0.75 * PT_TO_MM
          const ulHalf = (textWidth(name) + 4.3) / 2
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.3)
          doc.line(cx - ulHalf, ulY, cx + ulHalf, ulY)
          doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b)
          doc.setLineWidth(0.13)
        })
        y += layout.sigRowH
      } else if (block.kind === 'sig-title') {
        const halfCx1 = x0 + tableW * 0.25
        const halfCx2 = x0 + tableW * 0.75
        applyFont('normal', smallSz)
        const labelY = y + smallSz * 1.05 * PT_TO_MM
        centerText('PANGULONG MANG-AAWIT', halfCx1, labelY)
        centerText('DESTINADO', halfCx2, labelY)
        y += layout.sigRowH
      }
    }
  })

  downloadBlob(doc.output('blob'), suguanFileName(suguan, 'pdf'))
}