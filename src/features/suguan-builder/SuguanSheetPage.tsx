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
  type SheetMembers,
  type SheetPageBlock,
  type SuguanSheetLayout,
} from '@/lib/suguanExport'

const BORDER = '#8b8b8b'
const SCHEDULE_FILL = '#C6EFCE'
const PT_TO_PX = 96 / 72

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

  const titlePx = fs.titleFontSize * layout.scale * PT_TO_PX
  const headerPx = fs.headerFontSize * layout.scale * PT_TO_PX
  const bodyPx = layout.nameFontSize * layout.scale * PT_TO_PX
  const smallPx = fs.smallFontSize * layout.scale * PT_TO_PX

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
                  {sig.pmName}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <span
                  className="border-b border-black px-4 pb-0.5 font-semibold"
                  style={{ fontSize: bodyPx }}
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
      ref={pageRef}
      className="relative overflow-hidden bg-white"
      style={{ width: px(layout.paperWidthMm), height: px(layout.paperHeightMm) }}
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