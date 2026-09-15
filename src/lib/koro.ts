import type {
  SuguanFormation,
  SuguanFormationCell,
  SuguanDocFormat,
} from '@/core/types/suguan'
import { docPaperDimensionsMm, normalizeDocFormat } from '@/lib/suguanUtils'

export interface KoroExportInput {
  formation: SuguanFormation
  title: string
  subtitle: string
  fileName: string
  voiceLabels: Record<string, string>
  docFormat?: SuguanDocFormat | null
}

const KORO_VOICE_COLORS: Record<string, string> = {
  soprano: '#0ea5e9',
  alto: '#8b5cf6',
  tenor: '#d97706',
  bass: '#10b981',
}

export function koroVoiceColor(voicePosition: string): string {
  return KORO_VOICE_COLORS[voicePosition] ?? '#64748b'
}

export function trimFormation(
  g: SuguanFormation,
): SuguanFormation {
  const rows = g.rows
  const cols = g.cols
  const cells = g.cells
  let minR = rows
  let maxR = -1
  let minC = cols
  let maxC = -1
  cells.forEach((cell, i) => {
    if (!cell) return
    const r = Math.floor(i / cols)
    const c = i % cols
    if (r < minR) minR = r
    if (r > maxR) maxR = r
    if (c < minC) minC = c
    if (c > maxC) maxC = c
  })
  if (maxR < 0) return { rows, cols, cells }
  const newRows = maxR - minR + 1
  const newCols = maxC - minC + 1
  const out: (SuguanFormationCell | null)[] = Array(newRows * newCols).fill(null)
  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      const src = (r + minR) * cols + (c + minC)
      if (src < cells.length && cells[src]) {
        out[r * newCols + c] = cells[src]
      }
    }
  }
  return { rows: newRows, cols: newCols, cells: out }
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxPx: number): string {
  if (ctx.measureText(text).width <= maxPx) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxPx) {
    t = t.slice(0, -1)
  }
  return `${t}…`
}

export function drawKoroCanvas(input: KoroExportInput): HTMLCanvasElement {
  const g = trimFormation(input.formation)
  const rows = Math.max(0, g.rows)
  const cols = Math.max(0, g.cols)

  const cellW = 190
  const cellH = 58
  const gapX = 18
  const gapY = 18
  const top = 200
  const bottom = 170
  const width = 1560
  const gridW = cols === 0 ? 0 : cols * cellW + (cols - 1) * gapX
  const gridH = rows === 0 ? 0 : rows * cellH + (rows - 1) * gapY
  const height = Math.max(top + gridH + bottom, 400)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = '#111827'
  ctx.font = '700 46px "Segoe UI", Arial, sans-serif'
  ctx.fillText(truncate(ctx, input.title, width - 80), width / 2, 78)

  ctx.fillStyle = '#6b7280'
  ctx.font = '500 26px "Segoe UI", Arial, sans-serif'
  ctx.fillText(truncate(ctx, input.subtitle, width - 80), width / 2, 128)

  ctx.fillStyle = '#9ca3af'
  ctx.font = '400 18px "Segoe UI", Arial, sans-serif'
  ctx.fillText('KORO FORMATION', width / 2, 160)

  const gridX = (width - gridW) / 2
  const gridY = top

  const roundRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  const distinctVoices = new Set<string>()
  for (const cell of g.cells) {
    if (cell) distinctVoices.add(cell.voicePosition)
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = g.cells[r * cols + c]
      const x = gridX + c * (cellW + gapX)
      const y = gridY + r * (cellH + gapY)
      if (cell) {
        const color = koroVoiceColor(cell.voicePosition)
        roundRect(x, y, cellW, cellH, 10)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.lineWidth = 3
        ctx.strokeStyle = color
        ctx.stroke()

        ctx.fillStyle = color
        ctx.fillRect(x, y, 8, cellH)

        ctx.fillStyle = '#1f2937'
        ctx.font = '600 24px "Segoe UI", Arial, sans-serif'
        ctx.fillText(
          truncate(ctx, cell.memberName, cellW - 34),
          x + cellW / 2 + 6,
          y + 26,
        )
        const voiceLabel = input.voiceLabels[cell.voicePosition] ?? cell.voicePosition
        ctx.fillStyle = color
        ctx.font = '600 15px "Segoe UI", Arial, sans-serif'
        ctx.fillText(voiceLabel, x + cellW / 2 + 6, y + 47)
      } else {
        roundRect(x, y, cellW, cellH, 10)
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 1.5
        ctx.strokeStyle = '#e5e7eb'
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  const legendY = gridY + gridH + 70
  if (distinctVoices.size > 0) {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#374151'
    ctx.font = '600 24px "Segoe UI", Arial, sans-serif'
    const label = 'VOICES:'
    ctx.fillText(label, gridX, legendY)
    let lx = gridX + ctx.measureText(label).width + 28
    for (const vp of distinctVoices) {
      const color = koroVoiceColor(vp)
      ctx.fillStyle = color
      ctx.fillRect(lx, legendY - 22, 26, 26)
      ctx.fillStyle = '#374151'
      ctx.font = '600 22px "Segoe UI", Arial, sans-serif'
      const name = input.voiceLabels[vp] ?? vp
      ctx.fillText(name, lx + 34, legendY + 3)
      lx += 34 + ctx.measureText(name).width + 48
    }
  }

  return canvas
}

export function exportKoroPng(input: KoroExportInput): Promise<void> {
  const canvas = drawKoroCanvas(input)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not encode PNG.'))
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${input.fileName}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve()
    }, 'image/png')
  })
}

export async function exportKoroPdf(input: KoroExportInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const fmt = normalizeDocFormat(input.docFormat)
  const dims = docPaperDimensionsMm(fmt)
  const canvas = drawKoroCanvas(input)
  const dataUrl = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: fmt.orientation,
    unit: 'mm',
    format: [dims.width, dims.height],
  })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 10
  const availW = pageW - margin * 2
  const availH = pageH - margin * 2
  const scale = Math.min(availW / canvas.width, availH / canvas.height)
  const w = canvas.width * scale
  const h = canvas.height * scale
  pdf.addImage(dataUrl, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h)
  pdf.save(`${input.fileName}.pdf`)
}