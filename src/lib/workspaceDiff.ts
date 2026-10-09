/**
 * Pure diffing for the workspace sync layer.
 *
 * Stores keep their synchronous, localStorage-backed APIs; this module turns
 * "the collection before" and "the collection now" into the minimum set of
 * server writes. It has no Supabase import so `node:test` can exercise it.
 */

export interface CollectionDiff<T> {
  /** Records that are new or whose content changed, in current order. */
  upserts: T[]
  /** Ids that were present before and are gone now. */
  deletes: string[]
}

/** A cheap snapshot: id -> serialized record, used to detect changes. */
export type CollectionSnapshot = Map<string, string>

export function snapshotCollection<T extends { id: string }>(
  records: T[],
): CollectionSnapshot {
  return new Map(records.map((record) => [record.id, JSON.stringify(record)]))
}

/**
 * Compare the previous snapshot with the current records. A record is an upsert
 * when it is new or its serialized form differs; anything in the snapshot that
 * is no longer present is a delete. Returns the next snapshot so the caller can
 * feed it straight back on the next change.
 */
export function diffCollection<T extends { id: string }>(
  previous: CollectionSnapshot,
  records: T[],
): { diff: CollectionDiff<T>; snapshot: CollectionSnapshot } {
  const snapshot = snapshotCollection(records)
  const upserts: T[] = []
  for (const record of records) {
    if (previous.get(record.id) !== snapshot.get(record.id)) {
      upserts.push(record)
    }
  }
  const deletes: string[] = []
  for (const id of previous.keys()) {
    if (!snapshot.has(id)) deletes.push(id)
  }
  return { diff: { upserts, deletes }, snapshot }
}

/** True when two snapshots describe the same ids and values. */
export function snapshotsEqual(
  a: CollectionSnapshot | undefined,
  b: CollectionSnapshot,
): boolean {
  if (!a || a.size !== b.size) return false
  for (const [id, json] of a) {
    if (b.get(id) !== json) return false
  }
  return true
}

/**
 * Resolve a queued batch: a delete always wins over an upsert of the same id,
 * so a record created and removed between flushes is only a delete.
 */
export function resolveBatch<T extends { id: string }>(
  upserts: Map<string, T>,
  deletes: Set<string>,
): CollectionDiff<T> {
  return {
    upserts: [...upserts.values()].filter((record) => !deletes.has(record.id)),
    deletes: [...deletes],
  }
}
