import type { Suguan, SuguanDocFormat } from '@/core/types/suguan'
import { FONT_SIZE_PRESETS, normalizeDocFormat } from '@/lib/suguanUtils'
import type { SheetMembers } from '@/lib/suguanExport'
import { cn } from '@/lib/utils'
import {
  SuguanSheetPage,
  useSuguanSheetReadout,
} from './SuguanSheetPage'

interface SuguanSheetPreviewProps {
  suguan: Suguan
  members: SheetMembers[]
  docFormat?: SuguanDocFormat | null
  previewWidth?: number
  className?: string
}

export function SuguanSheetPreview({
  suguan,
  members,
  docFormat,
  previewWidth = 760,
  className,
}: SuguanSheetPreviewProps) {
  const fmt = normalizeDocFormat(docFormat)
  const readout = useSuguanSheetReadout(suguan, members, docFormat)
  const { layout } = readout
  const fs = FONT_SIZE_PRESETS[fmt.fontSize]

  const mmToPx = previewWidth / layout.paperWidthMm

  return (
    <div
      data-slot="sheet-preview"
      className={cn(
        'overflow-x-auto rounded-lg border border-border/60 bg-slate-200/60 p-3 dark:bg-slate-900/40',
        className,
      )}
    >
      <div className="mx-auto flex flex-col gap-4">
        {layout.pages.map((blocks, pageIdx) => (
          <div key={pageIdx} className="shrink-0">
            <div
              className="relative mx-auto overflow-hidden bg-white shadow-sm ring-1 ring-black/10"
              style={{ width: previewWidth, height: layout.paperHeightMm * mmToPx }}
            >
              <SuguanSheetPage
                suguan={suguan}
                readout={readout}
                mmToPx={mmToPx}
                blocks={blocks}
              />
            </div>
            <p className="mt-1 text-center text-xs font-medium text-muted-foreground">
              Page {pageIdx + 1} of {layout.pageCount}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          Paper: {layout.paperWidthMm.toFixed(1)} × {layout.paperHeightMm.toFixed(1)}{' '}
          mm ({fmt.paperSize === 'custom' ? 'Custom' : fmt.paperSize}) ·{' '}
          {fmt.orientation}
        </span>
        <span>
          Margins: L {layout.margins.left.toFixed(1)} · R{' '}
          {layout.margins.right.toFixed(1)} · T {layout.margins.top.toFixed(1)} · B{' '}
          {layout.margins.bottom.toFixed(1)} mm
        </span>
        <span>Font: {fs.label}</span>
        <span>
          {layout.sections.length} section{layout.sections.length !== 1 ? 's' : ''} ·{' '}
          {layout.rowCount} member{layout.rowCount !== 1 ? 's' : ''} ·{' '}
          {layout.pageCount} page{layout.pageCount > 1 ? 's' : ''}
        </span>
        {layout.scale < 1 && (
          <span className="text-amber-600 dark:text-amber-400">
            Fit-to-page scale {Math.round(layout.scale * 100)}%
          </span>
        )}
      </div>
    </div>
  )
}