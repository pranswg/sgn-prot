import { useRef, useState } from 'react'
import { Minus, Plus, Rows3, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/use-mobile'
import { koroVoiceColor } from '@/lib/koro'
import { koroSeatKey, koroTableCounts } from '@/lib/koroLayout'
import { KoroSeatPicker } from './KoroSeatPicker'
import type { KoroRow, KoroTable } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'

interface KoroTableCardProps {
  table: KoroTable
  tableIndex: number
  canRemoveTable: boolean
  members: Member[]
  voices: VoicePosition[]
  /** Where each seated member sits, so a repeat can be confirmed first. */
  placedSeats: Map<string, string>
  dropTarget: string | null
  /** Swap mode is a page-level mode: tap one seat, then another. */
  swapMode: boolean
  swapSource: { rowIndex: number; columnIndex: number } | null
  onTitleChange: (title: string) => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onAddSeat: (rowId: string) => void
  onRemoveSeat: (rowId: string) => void
  onRemoveTable: () => void
  onFillByVoice: () => void
  onSeatSelect: (rowIndex: number, columnIndex: number, member: Member | null) => void
  onSwapSeat: (rowIndex: number, columnIndex: number) => void
  onDropSeat: (rowIndex: number, columnIndex: number, memberId: string) => void
  onDragSeatChange: (seatKey: string | null) => void
}

const KEY_DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
}

/**
 * One Koro table. Every tier is a labelled strip of seats (Row 1 at the top),
 * so the chart reads the same on a phone as on a desktop; a phone shows one
 * tier at a time behind row chips, because fourteen readable seats cannot fit
 * in 300px, instead of squeezing the whole formation into unreadable squares.
 *
 * Seats can be picked, dragged onto (desktop), swapped in swap mode, and walked
 * with the arrow keys; the tier counts and the per-table total update live.
 */
export function KoroTableCard({
  table,
  tableIndex,
  canRemoveTable,
  members,
  voices,
  placedSeats,
  dropTarget,
  swapMode,
  swapSource,
  onTitleChange,
  onAddRow,
  onRemoveRow,
  onAddSeat,
  onRemoveSeat,
  onRemoveTable,
  onFillByVoice,
  onSeatSelect,
  onSwapSeat,
  onDropSeat,
  onDragSeatChange,
}: KoroTableCardProps) {
  const isMobile = useIsMobile()
  const counts = koroTableCounts(table)
  const [activeRow, setActiveRow] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)
  const currentRow = Math.min(activeRow, table.rows.length - 1)

  const handleSeatKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    rowIndex: number,
    columnIndex: number,
  ) => {
    const delta = KEY_DELTAS[event.key]
    if (!delta) return
    event.preventDefault()
    const nextRow = Math.min(
      table.rows.length - 1,
      Math.max(0, rowIndex + delta[0]),
    )
    const nextColumn = Math.min(
      table.rows[nextRow].cells.length - 1,
      Math.max(0, columnIndex + delta[1]),
    )
    const target = gridRef.current?.querySelector<HTMLElement>(
      `[data-seat="${nextRow}:${nextColumn}"]`,
    )
    target?.focus()
  }

  const renderRow = (row: KoroRow, rowIndex: number) => {
    const tier = counts.tiers[rowIndex]
    return (
      <div key={row.id} className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {tier.label}
          </span>
          <span className="text-[0.68rem] text-muted-foreground tabular-nums">
            {tier.filled}/{tier.capacity}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground"
              aria-label={`Add a seat to ${tier.label}`}
              title="Add seat"
              onClick={() => onAddSeat(row.id)}
            >
              <Plus className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground"
              aria-label={`Remove the last seat from ${tier.label}`}
              title="Remove seat"
              disabled={row.cells.length <= 1}
              onClick={() => onRemoveSeat(row.id)}
            >
              <Minus className="size-4" />
            </Button>
            {table.rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${tier.label}`}
                title="Remove row"
                onClick={() => onRemoveRow(row.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto rounded-lg bg-muted/40 p-1.5">
          {row.cells.map((cell, columnIndex) => {
            const seatKey = koroSeatKey(table.id, rowIndex, columnIndex)
            const active = dropTarget === seatKey
            const isSwapSource =
              swapSource?.rowIndex === rowIndex &&
              swapSource?.columnIndex === columnIndex
            return (
              <div
                key={`${row.id}:${columnIndex}`}
                data-seat={`${rowIndex}:${columnIndex}`}
                className="min-w-[4.75rem] flex-1"
                onKeyDown={(event) =>
                  handleSeatKeyDown(event, rowIndex, columnIndex)
                }
                onDragOver={(event) => {
                  event.preventDefault()
                  onDragSeatChange(seatKey)
                }}
                onDragLeave={() =>
                  onDragSeatChange(dropTarget === seatKey ? null : dropTarget)
                }
                onDrop={(event) => {
                  event.preventDefault()
                  onDragSeatChange(null)
                  onDropSeat(
                    rowIndex,
                    columnIndex,
                    event.dataTransfer.getData('text/plain'),
                  )
                }}
                style={
                  active
                    ? { outline: '2px solid var(--ring)', outlineOffset: 1 }
                    : isSwapSource
                      ? { outline: '2px solid var(--primary)', outlineOffset: 1 }
                      : undefined
                }
              >
                <KoroSeatPicker
                  cell={cell}
                  seatLabel={`${tier.label} seat ${columnIndex + 1}`}
                  members={members}
                  placedSeats={placedSeats}
                  voices={voices}
                  onSelect={(member) =>
                    onSeatSelect(rowIndex, columnIndex, member)
                  }
                  onActivate={
                    swapMode ? () => onSwapSeat(rowIndex, columnIndex) : undefined
                  }
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="grid min-w-48 flex-1 gap-2">
          <Label htmlFor={`koro-table-title-${table.id}`}>
            Table {tableIndex + 1} title
          </Label>
          <Input
            id={`koro-table-title-${table.id}`}
            value={table.title}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {counts.filled} of {counts.seats} seats filled
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFillByVoice}
            disabled={counts.filled >= counts.seats}
            title="Seat the remaining members in voice order"
          >
            <Wand2 className="size-4" />
            Fill by voice
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
            <Rows3 className="size-4" />
            Add row
          </Button>
          {canRemoveTable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove table ${tableIndex + 1}`}
              title="Remove table"
              onClick={onRemoveTable}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      {swapMode && (
        <p className="mb-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground">
          {swapSource
            ? `Now tap the seat to swap with ${counts.tiers[swapSource.rowIndex]?.label ?? ''} seat ${swapSource.columnIndex + 1}. Tap it again to cancel.`
            : 'Tap a seat to start a swap, then tap the seat to exchange it with.'}
        </p>
      )}

      {isMobile ? (
        <div className="grid gap-2">
          <div className="flex gap-1 overflow-x-auto">
            {table.rows.map((row, rowIndex) => {
              const tier = counts.tiers[rowIndex]
              const selected = rowIndex === currentRow
              return (
                <button
                  key={`${row.id}:chip`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveRow(rowIndex)}
                  className={
                    selected
                      ? 'shrink-0 rounded-md border border-primary bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-foreground'
                      : 'shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground'
                  }
                >
                  {tier.label}
                  <span className="ml-1.5 tabular-nums">
                    {tier.filled}/{tier.capacity}
                  </span>
                </button>
              )
            })}
          </div>
          <div ref={gridRef} className="grid gap-3">
            {renderRow(table.rows[currentRow], currentRow)}
          </div>
        </div>
      ) : (
        <div ref={gridRef} className="grid gap-3">
          {table.rows.map((row, rowIndex) => renderRow(row, rowIndex))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/60 pt-3">
        {voices.map((voice) => (
          <span
            key={voice.id}
            className="inline-flex items-center gap-1.5 text-xs"
          >
            <span
              aria-hidden
              className="size-3 rounded-sm border border-black/20"
              style={{ backgroundColor: koroVoiceColor(voice.id, voices) }}
            />
            {voice.shortName} — {voice.name}
          </span>
        ))}
      </div>
    </section>
  )
}
