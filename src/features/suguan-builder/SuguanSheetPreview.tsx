import type { Suguan, SuguanDocFormat } from '@/core/types/suguan'
import {
  eventTypeLabel,
  FONT_SIZE_PRESETS,
  formatEventDate,
  groupLabel,
  normalizeDocFormat,
  suguanTitle,
} from '@/lib/suguanUtils'
import {
  computeSuguanLayout,
  type SheetMembers,
  type SheetPageBlock,
} from '@/lib/suguanExport'
import { resolveSignatureNames } from '@/lib/suguanUtils'
import { cn } from '@/lib/utils'

interface SuguanSheetPreviewProps {
  suguan: Suguan
  members: SheetMembers[]
  docFormat?: SuguanDocFormat | null
  previewWidth?: number
  className?: string
}

const BORDER = '#8b8b8b'
const PT_TO_PX = 96 / 72

export function SuguanSheetPreview({
  suguan,
  members,
  docFormat,
  previewWidth = 760,
  className,
}: SuguanSheetPreviewProps) {
  const fmt = normalizeDocFormat(docFormat)
  const layout = computeSuguanLayout(suguan, members, docFormat)
  const fs = FONT_SIZE_PRESETS[fmt.fontSize]
  const events = layout.events

  const mmToPx = previewWidth / layout.paperWidthMm
  const px = (mm: number) => mm * mmToPx
  const paperH = layout.paperHeightMm * mmToPx

  const pad = {
    top: layout.margins.top * mmToPx,
    bottom: layout.margins.bottom * mmToPx,
    left: layout.margins.left * mmToPx,
    right: layout.margins.right * mmToPx,
  }

  const titlePx = fs.titleFontSize * layout.scale * PT_TO_PX
  const headerPx = fs.headerFontSize * layout.scale * PT_TO_PX
  const bodyPx = layout.nameFontSize * layout.scale * PT_TO_PX
  const smallPx = fs.smallFontSize * layout.scale * PT_TO_PX

  const { pmName, destinadoName } = resolveSignatureNames(suguan, members)

  const renderBlock = (block: SheetPageBlock) => {
    if (block.kind === 'section-label') {
      const section = layout.sections[block.sectionIndex]
      return (
        <tr key={`${block.kind}-${block.sectionIndex}`}>
          <td
            colSpan={layout.totalCols}
            className="px-1 font-semibold text-black"
            style={{
              height: px(layout.sectionLabelRowH),
              fontSize: headerPx,
              background: '#F9F9F9',
              border: `0.5px solid ${BORDER}`,
              textAlign: 'left',
              lineHeight: 1.2,
            }}
          >
            {section.label}
          </td>
        </tr>
      )
    }

    if (block.kind === 'section-header') {
      return (
        <tr key={`${block.kind}-${block.sectionIndex}`}>
          <td
            className="text-center font-semibold text-black"
            style={{
              height: px(layout.sectionHeaderRowH),
              fontSize: headerPx,
              background: '#F2F2F2',
              border: `0.5px solid ${BORDER}`,
            }}
          >
            No.
          </td>
          <td
            className="text-center font-semibold text-black"
            style={{
              height: px(layout.sectionHeaderRowH),
              fontSize: headerPx,
              background: '#F2F2F2',
              border: `0.5px solid ${BORDER}`,
            }}
          >
            PANGALAN
          </td>
          {events.map((e, i) => {
            const bg = e.type === 'pagsasanay' ? '#FFF2CC' : '#D9EAD3'
            return (
              <td
                key={i}
                className="text-center font-semibold text-black"
                style={{
                  height: px(layout.sectionHeaderRowH),
                  fontSize: headerPx,
                  background: bg,
                  border: `0.5px solid ${BORDER}`,
                }}
              >
                {eventTypeLabel(e.type)}
              </td>
            )
          })}
        </tr>
      )
    }

    if (block.kind === 'member') {
      const section = layout.sections[block.sectionIndex]
      const row = section.rows[block.rowIndex]
      return (
        <tr key={`m-${block.sectionIndex}-${block.rowIndex}`}>
          <td
            className="text-center text-black"
            style={{
              height: px(layout.bodyRowH),
              fontSize: bodyPx,
              border: `0.5px solid ${BORDER}`,
            }}
          >
            {row.no}
          </td>
          <td
            className="overflow-hidden whitespace-nowrap text-black"
            style={{
              height: px(layout.bodyRowH),
              fontSize: bodyPx,
              border: `0.5px solid ${BORDER}`,
              paddingLeft: 3,
            }}
          >
            {row.name}
          </td>
          {events.map((_, j) => (
            <td
              key={j}
              style={{
                height: px(layout.bodyRowH),
                border: `0.5px solid ${BORDER}`,
              }}
            />
          ))}
        </tr>
      )
    }

    if (block.kind === 'sig-gap') {
      return (
        <tr key="sig-gap">
          <td
            colSpan={layout.totalCols}
            style={{ height: px(layout.sigGapH), border: 'none' }}
          />
        </tr>
      )
    }

    if (block.kind === 'sig-name') {
      return (
        <tr key="sig-name">
          <td
            colSpan={layout.totalCols}
            style={{ height: px(layout.sigRowH), border: 'none' }}
          >
            <div
              className="flex w-full text-black"
              style={{ height: px(layout.sigRowH) }}
            >
              <div className="flex flex-1 items-center justify-center">
                <span
                  className="border-b border-black px-4 pb-0.5 font-semibold"
                  style={{ fontSize: bodyPx }}
                >
                  {pmName}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <span
                  className="border-b border-black px-4 pb-0.5 font-semibold"
                  style={{ fontSize: bodyPx }}
                >
                  {destinadoName}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )
    }

    return (
      <tr key="sig-title">
        <td
          colSpan={layout.totalCols}
          style={{ height: px(layout.sigRowH), border: 'none' }}
        >
          <div className="flex w-full text-black" style={{ height: px(layout.sigRowH) }}>
            <div
              className="flex flex-1 items-start justify-center"
              style={{ fontSize: smallPx }}
            >
              PANGULONG MANG-AAWIT
            </div>
            <div
              className="flex flex-1 items-start justify-center"
              style={{ fontSize: smallPx }}
            >
              DESTINADO
            </div>
          </div>
        </td>
      </tr>
    )
  }

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
              style={{ width: previewWidth, height: paperH }}
            >
              <div
                className="flex flex-col"
                style={{
                  paddingTop: pad.top,
                  paddingBottom: pad.bottom,
                  paddingLeft: pad.left,
                  paddingRight: pad.right,
                }}
              >
                <table
                  className="w-full border-collapse"
                  style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}
                >
                  <colgroup>
                    <col style={{ width: px(layout.noColWidthMm) }} />
                    <col style={{ width: px(layout.nameColWidthMm) }} />
                    {events.map((_, i) => (
                      <col key={i} style={{ width: px(layout.eventColWidthMm) }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        colSpan={layout.totalCols}
                        className="px-1 text-center font-semibold text-black"
                        style={{
                          height: px(layout.titleRowH),
                          fontSize: titlePx,
                          borderTop: `0.5px solid ${BORDER}`,
                          borderBottom: `0.5px solid ${BORDER}`,
                          lineHeight: 1.15,
                        }}
                      >
                        {suguanTitle(suguan)}
                      </th>
                    </tr>
                    <tr>
                      <th
                        colSpan={layout.totalCols}
                        className="py-0"
                        style={{
                          height: px(layout.groupRowH),
                          textAlign: 'center',
                          fontSize: headerPx,
                          borderBottom: `0.5px solid ${BORDER}`,
                        }}
                      >
                        <span className="text-black font-semibold">
                          {groupLabel(suguan.group)}
                        </span>
                      </th>
                    </tr>
                    <tr>
                      <th
                        rowSpan={2}
                        className="text-center font-semibold text-black"
                        style={{
                          width: px(layout.noColWidthMm),
                          height: px(layout.headerRowH * 2),
                          fontSize: headerPx,
                          background: '#F2F2F2',
                          border: `0.5px solid ${BORDER}`,
                        }}
                      >
                        No.
                      </th>
                      <th
                        rowSpan={2}
                        className="text-center font-semibold text-black"
                        style={{
                          width: px(layout.nameColWidthMm),
                          height: px(layout.headerRowH * 2),
                          fontSize: headerPx,
                          background: '#F2F2F2',
                          border: `0.5px solid ${BORDER}`,
                        }}
                      >
                        PANGALAN
                      </th>
                      {events.map((e, i) => {
                        const bg = e.type === 'pagsasanay' ? '#FFF2CC' : '#D9EAD3'
                        return (
                          <th
                            key={i}
                            className="text-center font-semibold text-black"
                            style={{
                              height: px(layout.headerRowH),
                              fontSize: headerPx,
                              background: bg,
                              border: `0.5px solid ${BORDER}`,
                            }}
                          >
                            {eventTypeLabel(e.type)}
                          </th>
                        )
                      })}
                    </tr>
                    <tr>
                      {events.map((e, i) => {
                        const bg = e.type === 'pagsasanay' ? '#FFF2CC' : '#D9EAD3'
                        return (
                          <th
                            key={`d${i}`}
                            className="text-center text-black"
                            style={{
                              height: px(layout.headerRowH),
                              fontSize: headerPx * 0.95,
                              background: bg,
                              border: `0.5px solid ${BORDER}`,
                              fontWeight: 600,
                            }}
                          >
                            {formatEventDate(e)}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>{blocks.map(renderBlock)}</tbody>
                </table>
              </div>
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