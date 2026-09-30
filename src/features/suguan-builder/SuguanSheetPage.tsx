import { useLayoutEffect, useMemo, useRef, type Ref } from 'react'
import type { Suguan, SuguanDocFormat } from '@/core/types/suguan'
import {
  eventTypeLabel,
  formatEventDate,
  resolveSignatureNames,
  suguanSheetTitle,
} from '@/lib/suguanUtils'
import {
  computeSuguanLayout,
  fitFontSizePt,
  PT_TO_MM,
  SIG_LINE,
  SIG_RULE_BORDER,
  SIG_RULE_GAP,
  SIG_RULE_PAD,
  type SheetMembers,
  type SheetPageBlock,
  type SuguanSheetLayout,
} from '@/lib/suguanExport'

const BORDER = '#8b8b8b'
const SCHEDULE_FILL = '#C6EFCE'
const PT_TO_PX = 96 / 72
const PX_TO_MM = 25.4 / 96

/**
 * Font stack the sheet actually paints with. Kept in one place so the text
 * measurer below can never drift from the rendered text.
 *
 * `SuguanSheet` is the self-hosted Inter registered in `index.css`, and the PDF
 * embeds those very same files, so the preview and the export use one typeface.
 * The system stack after it is a safety net for the rare case where the webfont
 * has not finished loading.
 */
const SHEET_FONT_STACK =
  '"SuguanSheet", "Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, "Noto Sans", sans-serif'

/**
 * Measures rendered text width in millimetres using the same font stack the
 * preview paints with, so a long signature name is shrunk here by the same
 * amount the PDF shrinks it. The PDF passes jsPDF's Roboto metrics instead; only
 * the measurer differs, never the rule.
 */
let measureCtx: CanvasRenderingContext2D | null | undefined
function measureTextMm(text: string, sizePt: number, bold: boolean): number {
  if (typeof document === 'undefined') return text.length * sizePt * 0.5 * PT_TO_MM
  if (measureCtx === undefined) {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  if (!measureCtx) return text.length * sizePt * 0.5 * PT_TO_MM
  measureCtx.font = `${bold ? '700 ' : ''}${sizePt * PT_TO_PX}px ${SHEET_FONT_STACK}`
  return measureCtx.measureText(text).width * PX_TO_MM
}

export interface SuguanSheetReadout {
  layout: SuguanSheetLayout
  sig: { pmName: string; destinadoName: string }
}

export function useSuguanSheetReadout(
  suguan: Suguan,
  members: SheetMembers[],
  docFormat?: SuguanDocFormat | null,
): SuguanSheetReadout {
  const layout = useMemo(
    () => computeSuguanLayout(suguan, members, docFormat),
    [suguan, members, docFormat],
  )
  const sig = useMemo(() => resolveSignatureNames(suguan, members), [suguan, members])
  return { layout, sig }
}

interface SuguanSheetPageProps {
  suguan: Suguan
  readout: SuguanSheetReadout
  mmToPx: number
  blocks: SheetPageBlock[]
  pageRef?: Ref<HTMLDivElement>
}

export function SuguanSheetPage({
  suguan,
  readout,
  mmToPx,
  blocks,
  pageRef,
}: SuguanSheetPageProps) {
  const { layout, sig } = readout
  const fs = layout.fs
  const events = layout.events
  const px = (mm: number) => mm * mmToPx
  const sigGeo = layout.sig

  const titlePx = fs.titleFontSize * layout.scale * PT_TO_PX
  const headerPx = fs.headerFontSize * layout.scale * PT_TO_PX
  const bodyPx = layout.bodyFontSizePt * PT_TO_PX
  // Locked to fixed sizes so fit-page scaling never shrinks the signatures.
  const sigNameMm = sigGeo.nameFontSizePt * PT_TO_MM
  const sigRolePx = sigGeo.roleFontSizePt * PT_TO_PX

  // Long names shrink by the same amount in both renderers.
  const pmNameSizePt = fitFontSizePt({
    text: sig.pmName,
    startSizePt: sigGeo.nameFontSizePt,
    maxWidthMm: sigGeo.columnWidthMm - 2 * SIG_RULE_PAD,
    measureMm: (t, s) => measureTextMm(t, s, true),
  })
  const destinadoNameSizePt = fitFontSizePt({
    text: sig.destinadoName,
    startSizePt: sigGeo.nameFontSizePt,
    maxWidthMm: sigGeo.columnWidthMm - 2 * SIG_RULE_PAD,
    measureMm: (t, s) => measureTextMm(t, s, true),
  })

  // Places the name's line box so its text centre lands on the shared
  // `nameCenterMm`, and its border-bottom on `ruleOffsetMm` from that centre.
  const nameMarginTopMm = sigGeo.nameCenterMm - (SIG_LINE * sigNameMm) / 2
  const namePadBottomMm = SIG_RULE_GAP - SIG_RULE_BORDER / 2

  const renderBlock = (block: SheetPageBlock) => {
    if (block.kind === 'section-label') {
      const section = layout.sections[block.sectionIndex]
      return (
        <tr key={`${block.kind}-${block.sectionIndex}`}>
          <td
            className="text-black"
            style={{
              height: px(layout.sectionLabelRowH),
              border: `0.5px solid ${BORDER}`,
            }}
          />
          <td
            className="px-1 text-center font-semibold text-black"
            style={{
              height: px(layout.sectionLabelRowH),
              fontSize: headerPx,
              background: SCHEDULE_FILL,
              border: `0.5px solid ${BORDER}`,
              textAlign: 'center',
              verticalAlign: 'middle',
              lineHeight: 1,
            }}
          >
            {section.label}
          </td>
          {events.map((_, j) => (
            <td
              key={j}
              style={{
                height: px(layout.sectionLabelRowH),
                border: `0.5px solid ${BORDER}`,
              }}
            />
          ))}
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
            style={{
              height: px(sigGeo.gapMm),
              padding: 0,
              border: 'none',
              fontSize: 0,
              lineHeight: 0,
            }}
          />
        </tr>
      )
    }

    if (block.kind === 'sig-name') {
      return (
        <tr key="sig-name">
          <td
            colSpan={layout.totalCols}
            style={{ height: px(sigGeo.nameRowMm), padding: 0, border: 'none' }}
          >
            <div
              className="flex w-full items-start text-black"
              style={{ height: px(sigGeo.nameRowMm) }}
            >
              <div className="flex flex-1 justify-center">
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: px(nameMarginTopMm),
                    paddingLeft: px(SIG_RULE_PAD),
                    paddingRight: px(SIG_RULE_PAD),
                    paddingBottom: px(namePadBottomMm),
                    borderBottom: `${px(SIG_RULE_BORDER)} solid #000`,
                    lineHeight: SIG_LINE,
                    fontSize: pmNameSizePt * PT_TO_PX,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sig.pmName}
                </span>
              </div>
              <div className="flex flex-1 justify-center">
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: px(nameMarginTopMm),
                    paddingLeft: px(SIG_RULE_PAD),
                    paddingRight: px(SIG_RULE_PAD),
                    paddingBottom: px(namePadBottomMm),
                    borderBottom: `${px(SIG_RULE_BORDER)} solid #000`,
                    lineHeight: SIG_LINE,
                    fontSize: destinadoNameSizePt * PT_TO_PX,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sig.destinadoName}
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
          style={{ height: px(sigGeo.roleRowMm), padding: 0, border: 'none' }}
        >
          <div
            className="flex w-full items-start text-black"
            style={{ height: px(sigGeo.roleRowMm) }}
          >
            <div
              className="flex flex-1 justify-center text-center"
              style={{ fontSize: sigRolePx, lineHeight: SIG_LINE }}
            >
              PANGULONG MANG-AAWIT
            </div>
            <div
              className="flex flex-1 justify-center text-center"
              style={{ fontSize: sigRolePx, lineHeight: SIG_LINE }}
            >
              DESTINADO
            </div>
          </div>
        </td>
      </tr>
    )
  }

  // Role text sits at the top of its row with the shared line height, so its
  // centre is exactly `roleCenterMm` below the row's top edge.
  return (
    <div
      ref={pageRef}
      className="relative overflow-hidden bg-white"
      style={{
        width: px(layout.paperWidthMm),
        height: px(layout.paperHeightMm),
        fontFamily: SHEET_FONT_STACK,
      }}
    >
      <div
        className="flex flex-col"
        style={{
          paddingTop: px(layout.margins.top),
          paddingBottom: px(layout.margins.bottom),
          paddingLeft: px(layout.margins.left),
          paddingRight: px(layout.margins.right),
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
                  border: `0.5px solid ${BORDER}`,
                  lineHeight: 1.15,
                }}
              >
                {suguanSheetTitle(suguan)}
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
  )
}

interface SuguanSheetPagesProps {
  suguan: Suguan
  members: SheetMembers[]
  docFormat?: SuguanDocFormat | null
  mmToPx: number
  onReady?: (pageEls: HTMLDivElement[]) => void
}

export function SuguanSheetPages({
  suguan,
  members,
  docFormat,
  mmToPx,
  onReady,
}: SuguanSheetPagesProps) {
  const readout = useSuguanSheetReadout(suguan, members, docFormat)
  const { layout } = readout
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map())

  useLayoutEffect(() => {
    if (!onReady) return
    const els = layout.pages.map((_, i) => pageEls.current.get(i) ?? null)
    if (els.some((el) => el === null)) return
    const raf = requestAnimationFrame(() => {
      onReady(els as HTMLDivElement[])
    })
    return () => cancelAnimationFrame(raf)
  }, [layout, onReady])

  return (
    <>
      {layout.pages.map((blocks, pageIdx) => (
        <SuguanSheetPage
          key={pageIdx}
          suguan={suguan}
          readout={readout}
          mmToPx={mmToPx}
          blocks={blocks}
          pageRef={(el) => {
            if (el) pageEls.current.set(pageIdx, el)
            else pageEls.current.delete(pageIdx)
          }}
        />
      ))}
    </>
  )
}