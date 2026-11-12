import type { KoroCell, KoroDocument, KoroTable } from '@/core/types/koro'

/**
 * Derived layout facts for the Koro maker: seat keys, tier labels, and the
 * counts the page prints above the grid. Kept pure and React-free so the
 * counting rules are testable without a DOM.
 */

/** Stable seat identity, shared by the grid, drag targets and accessibility labels. */
export function koroSeatKey(
  tableId: string,
  rowIndex: number,
  columnIndex: number,
): string {
  return `${tableId}:${rowIndex}:${columnIndex}`
}

/**
 * Rows are numbered from the bottom of the chart up: the bottom row is Row 1,
 * because that is the front of the formation where the choir stands.
 */
export function koroTierLabel(rowIndex: number, rowCount: number): string {
  return `Row ${rowCount - rowIndex}`
}

/** A seat is filled only when it names someone; a cleared cell keeps its voice. */
export function koroIsSeated(cell: KoroCell): boolean {
  return Boolean(cell.memberId && cell.firstName.trim())
}

export function koroCellFirstName(cell: KoroCell): string {
  return cell.firstName.trim()
}

export interface KoroTierCounts {
  label: string
  filled: number
  capacity: number
}

export interface KoroTableCounts {
  seats: number
  filled: number
  tiers: KoroTierCounts[]
}

export function koroTableCounts(table: KoroTable): KoroTableCounts {
  const tiers = table.rows.map((row, index) => ({
    label: koroTierLabel(index, table.rows.length),
    filled: row.cells.filter(koroIsSeated).length,
    capacity: row.cells.length,
  }))
  return {
    seats: tiers.reduce((total, tier) => total + tier.capacity, 0),
    filled: tiers.reduce((total, tier) => total + tier.filled, 0),
    tiers,
  }
}

export interface KoroDocumentCounts {
  seats: number
  filled: number
  empty: number
  /** Filled seats per voice id, resolving the seat's voice through the cell. */
  byVoice: Record<string, number>
  /** Members seated more than once across the whole document. */
  duplicatedMemberIds: string[]
}

export function koroDocumentCounts(document: KoroDocument): KoroDocumentCounts {
  const byVoice: Record<string, number> = {}
  const seatCounts = new Map<string, number>()
  let seats = 0
  let filled = 0

  for (const table of document.tables) {
    for (const row of table.rows) {
      for (const cell of row.cells) {
        seats += 1
        if (!koroIsSeated(cell) || !cell.memberId) continue
        filled += 1
        if (cell.voicePosition) {
          byVoice[cell.voicePosition] = (byVoice[cell.voicePosition] ?? 0) + 1
        }
        seatCounts.set(cell.memberId, (seatCounts.get(cell.memberId) ?? 0) + 1)
      }
    }
  }

  return {
    seats,
    filled,
    empty: seats - filled,
    byVoice,
    duplicatedMemberIds: [...seatCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([memberId]) => memberId),
  }
}

/** Every member id currently seated somewhere in the document. */
export function koroPlacedMemberIds(document: KoroDocument): Set<string> {
  const ids = new Set<string>()
  for (const table of document.tables) {
    for (const row of table.rows) {
      for (const cell of row.cells) {
        if (cell.memberId && koroIsSeated(cell)) ids.add(cell.memberId)
      }
    }
  }
  return ids
}

/**
 * Where each seated member sits, e.g. `Table 2 · Row 1 seat 3`. The seat picker
 * uses this to warn before seating the same person a second time instead of
 * quietly hiding them from the list.
 */
export function koroPlacedSeatLabels(
  document: KoroDocument,
): Map<string, string> {
  const labels = new Map<string, string>()
  document.tables.forEach((table, tableIndex) => {
    table.rows.forEach((row, rowIndex) => {
      row.cells.forEach((cell, columnIndex) => {
        if (!cell.memberId || !koroIsSeated(cell)) return
        if (labels.has(cell.memberId)) return
        labels.set(
          cell.memberId,
          `Table ${tableIndex + 1} · ${koroTierLabel(rowIndex, table.rows.length)} seat ${columnIndex + 1}`,
        )
      })
    })
  })
  return labels
}

/**
 * Every seat a member holds, keyed by member id, e.g.
 * `["Table 1 · Row 2 seat 3", "Table 3 · Row 1 seat 5"]`. A member listed in
 * more than one place is a duplicate across tables. Unlike
 * {@link koroPlacedSeatLabels}, this keeps every location, so the grid can both
 * confirm a cross-table repeat before placing it and name every table a seated
 * member appears in once placed.
 */
export function koroSeatLocationsByMember(
  document: KoroDocument,
): Map<string, string[]> {
  const locations = new Map<string, string[]>()
  document.tables.forEach((table, tableIndex) => {
    table.rows.forEach((row, rowIndex) => {
      row.cells.forEach((cell, columnIndex) => {
        if (!cell.memberId || !koroIsSeated(cell)) return
        const label = `Table ${tableIndex + 1} · ${koroTierLabel(rowIndex, table.rows.length)} seat ${columnIndex + 1}`
        const list = locations.get(cell.memberId)
        if (list) list.push(label)
        else locations.set(cell.memberId, [label])
      })
    })
  })
  return locations
}

/** Two tables share a service when their date and time are identical. */
function koroServiceKey(table: KoroTable): string {
  return `${table.date.trim()}|${table.time.trim()}`
}

/** A member's seats split by whether each table shares the target table's service. */
export interface KoroServiceSeatLabels {
  /** Seats in tables at the *same* date and time as the target (the target itself included). */
  sameService: string[]
  /** Seats in tables at a *different* date and time. */
  otherService: string[]
}

/**
 * Where a member already sits, separated by whether each seat is in a table
 * sharing the target table's date and time. Seating a singer twice within one
 * service — the same table or a sibling table at that date and time — is a
 * mistake, so those seats block the add; a seat in a different service is only
 * worth a confirmation.
 */
export function koroSeatLabelsByService(
  document: KoroDocument,
  targetTableId: string,
  memberId: string,
): KoroServiceSeatLabels {
  const target = document.tables.find((table) => table.id === targetTableId)
  const result: KoroServiceSeatLabels = { sameService: [], otherService: [] }
  if (!target) return result
  const targetKey = koroServiceKey(target)
  document.tables.forEach((table, tableIndex) => {
    table.rows.forEach((row, rowIndex) => {
      row.cells.forEach((cell, columnIndex) => {
        if (!cell.memberId || cell.memberId !== memberId) return
        if (!koroIsSeated(cell)) return
        const label = `Table ${tableIndex + 1} · ${koroTierLabel(rowIndex, table.rows.length)} seat ${columnIndex + 1}`
        if (koroServiceKey(table) === targetKey) result.sameService.push(label)
        else result.otherService.push(label)
      })
    })
  })
  return result
}

/** How many active members each configured voice position can supply. */
export function koroRosterByVoice(
  members: readonly { voicePosition: string }[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const member of members) {
    if (!member.voicePosition) continue
    counts[member.voicePosition] = (counts[member.voicePosition] ?? 0) + 1
  }
  return counts
}
