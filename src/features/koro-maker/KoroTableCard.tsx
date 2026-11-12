import { useRef, useState } from 'react'
import { Copy, Minus, Plus, GripVertical, Rows3, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsMobile } from '@/hooks/use-mobile'
import { koroVoiceColor } from '@/lib/koro'
import type { KoroRosterEntry } from '@/lib/koro'
import { koroIsSeated, koroSeatKey, koroTableCounts } from '@/lib/koroLayout'
import { KoroSeatPicker } from './KoroSeatPicker'
import type { KoroRow, KoroTable } from '@/core/types/koro'
import type { VoicePosition } from '@/core/types/suguan'

interface KoroTableCardProps {
  table: KoroTable
  tableIndex: number
  canRemoveTable: boolean
  members: KoroRosterEntry[]
  voices: VoicePosition[]
  /**
   * Every seat each member holds, so a seat can name the tables a duplicated
   * occupant appears in.
   */
  seatLocations: Map<string, string[]>
  /** Member ids seated more than once anywhere in the document. */
  duplicatedIds: Set<string>
  dropTarget: string | null
  /** Swap mode is a page-level mode: tap one seat, then another. */
  swapMode: boolean
  swapSource: { rowIndex: number; columnIndex: number } | null
  onTitleChange: (title: string) => void
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onAddSeat: (rowId: string) => void
  onRemoveSeat: (rowId: string) => void
  onRemoveTable: () => void
  /** Copy this table — formation and seated members — into a new one below it. */
  onDuplicateTable: () => void
  onFillByVoice: () => void
  onSeatSelect: (
    rowIndex: number,
    columnIndex: number,
    member: KoroRosterEntry | null,
  ) => void
  onSwapSeat: (rowIndex: number, columnIndex: number) => void
  onDropSeat: (rowIndex: number, columnIndex: number, memberId: string) => void
  /** Drag one occupied seat onto another to exchange their occupants, even
   * across tables — the source is named by its table id. */
  onSwapSeats: (
    fromTableId: string,
    fromRowIndex: number,
    fromColumnIndex: number,
    toRowIndex: number,
    toColumnIndex: number,
  ) => void
  onDragSeatChange: (seatKey: string | null) => void
  /** This table is the one currently being dragged to a new position. */
  dragging: boolean
  /** More than one table exists, so the grip handle is meaningful. */
  canReorder: boolean
  onTableDragStart: () => void
  onTableDragEnd: () => void
}

const KEY_DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
}

/** A seated member being dragged carries this instead of a bare member id. */
const SEAT_DRAG_PREFIX = 'koro-seat:'

// The payload names the source table so a seat can be dragged into a different
// table, not only swapped within its own. nanoid ids contain no ':', so the
// table id is everything before the last two segments.
function seatDragPayload(
  tableId: string,
  rowIndex: number,
  columnIndex: number,
): string {
  return `${SEAT_DRAG_PREFIX}${tableId}:${rowIndex}:${columnIndex}`
}

function parseSeatDragPayload(
  value: string,
): { tableId: string; rowIndex: number; columnIndex: number } | null {
  if (!value.startsWith(SEAT_DRAG_PREFIX)) return null
  const parts = value.slice(SEAT_DRAG_PREFIX.length).split(':')
  const columnIndex = Number(parts.pop())
  const rowIndex = Number(parts.pop())
  const tableId = parts.join(':')
  if (!tableId || Number.isNaN(rowIndex) || Number.isNaN(columnIndex)) {
    return null
  }
  return { tableId, rowIndex, columnIndex }
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
  seatLocations,
  duplicatedIds,
  dropTarget,
  swapMode,
  swapSource,
  onTitleChange,
  onDateChange,
  onTimeChange,
  onAddRow,
  onRemoveRow,
  onAddSeat,
  onRemoveSeat,
  onRemoveTable,
  onDuplicateTable,
  onFillByVoice,
  onSeatSelect,
  onSwapSeat,
  onDropSeat,
  onSwapSeats,
  onDragSeatChange,
  dragging,
  canReorder,
  onTableDragStart,
  onTableDragEnd,
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
            const occupied = koroIsSeated(cell)
            // An occupied seat can be picked up and dropped on another seat to
            // exchange them, except in tap-swap mode where the tap owns the
            // gesture.
            const draggableSeat = occupied && !swapMode
            return (
              <div
                key={`${row.id}:${columnIndex}`}
                data-seat={`${rowIndex}:${columnIndex}`}
                className={`min-w-[4.75rem] flex-1${
                  draggableSeat ? ' cursor-grab active:cursor-grabbing' : ''
                }`}
                draggable={draggableSeat}
                onKeyDown={(event) =>
                  handleSeatKeyDown(event, rowIndex, columnIndex)
                }
                onDragStart={(event) => {
                  if (!draggableSeat) return
                  event.dataTransfer.setData(
                    'text/plain',
                    seatDragPayload(table.id, rowIndex, columnIndex),
                  )
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  // Only a member/seat drag (text/plain) can target a seat; a
                  // table-reorder drag passes through to the card wrapper.
                  if (!event.dataTransfer.types.includes('text/plain')) return
                  event.preventDefault()
                  onDragSeatChange(seatKey)
                }}
                onDragLeave={() =>
                  onDragSeatChange(dropTarget === seatKey ? null : dropTarget)
                }
                onDrop={(event) => {
                  event.preventDefault()
                  onDragSeatChange(null)
                  const payload = event.dataTransfer.getData('text/plain')
                  const source = parseSeatDragPayload(payload)
                  if (source) {
                    onSwapSeats(
                      source.tableId,
                      source.rowIndex,
                      source.columnIndex,
                      rowIndex,
                      columnIndex,
                    )
                    return
                  }
                  onDropSeat(rowIndex, columnIndex, payload)
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
                  seatNumber={columnIndex + 1}
                  members={members}
                  seatLocations={seatLocations}
                  duplicatedIds={duplicatedIds}
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
    <section
      className={`rounded-xl border border-border/70 bg-card p-4 transition-opacity${
        dragging ? ' opacity-50' : ''
      }`}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-48 flex-1 items-end gap-1">
          {canReorder && (
            <button
              type="button"
              draggable
              aria-label={`Drag table ${tableIndex + 1} to reorder`}
              title="Drag to reorder tables"
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  'application/x-koro-table',
                  table.id,
                )
                event.dataTransfer.effectAllowed = 'move'
                onTableDragStart()
              }}
              onDragEnd={onTableDragEnd}
              className="grid size-9 shrink-0 cursor-grab place-items-center self-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </button>
          )}
          <div className="grid flex-1 gap-2">
            <Label htmlFor={`koro-table-title-${table.id}`}>
              Table {tableIndex + 1} title
            </Label>
            <Input
              id={`koro-table-title-${table.id}`}
              value={table.title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </div>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDuplicateTable}
            title="Copy this table, with its seated members, below it"
          >
            <Copy className="size-4" />
            Duplicate
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

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label
            htmlFor={`koro-table-date-${table.id}`}
            className="text-xs text-muted-foreground"
          >
            Date
          </Label>
          <Input
            id={`koro-table-date-${table.id}`}
            type="date"
            value={table.date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label
            htmlFor={`koro-table-time-${table.id}`}
            className="text-xs text-muted-foreground"
          >
            Time
          </Label>
          <Input
            id={`koro-table-time-${table.id}`}
            type="time"
            value={table.time}
            onChange={(event) => onTimeChange(event.target.value)}
          />
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
