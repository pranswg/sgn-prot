/**
 * Moves one entry of an ordered list to another position.
 *
 * Array index *is* the order for every list Settings manages — there is no
 * `order` field anywhere — so a reorder is just a new array.
 *
 * `toIndex` is read against the list as the user sees it, before the move. That
 * one choice makes dragging behave: dropping a row onto the row above it
 * inserts above it, dropping onto the row below inserts below it, and the
 * dragged item never jumps across the row it was dropped on. The same index
 * arithmetic therefore drives drag-and-drop and the arrow-key moves.
 *
 * Returns the original array untouched for an unknown id, a no-op move, or an
 * index outside the list, so callers can treat identity as "nothing changed".
 */
export function reorderList<T extends { id: string }>(
  items: T[],
  id: string,
  toIndex: number,
): T[] {
  const from = items.findIndex((item) => item.id === id)
  if (from === -1 || from === toIndex) return items
  if (toIndex < 0 || toIndex >= items.length) return items

  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(toIndex, 0, moved)
  return next
}
