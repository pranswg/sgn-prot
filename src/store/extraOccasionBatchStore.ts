import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { deleteAllRows, deleteRow, upsertRow } from '@/api/db'
import { persist as persistWrite } from '@/lib/writeThrough'

/**
 * A Multiple Extra Occasion planning session. The batch owns only its identity
 * and name; membership is derived from `Suguan.extraOccasionBatchId`, so there
 * is one source of truth. Persisted to localStorage and to the shared
 * `extra_occasion_batches` table.
 */
export interface ExtraOccasionBatch {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ExtraOccasionBatchInput {
  /** Supplied by the planner so occasions can carry the id before the first
   *  save; a fresh nanoid is used when omitted. */
  id?: string
  name: string
}

interface ExtraOccasionBatchState {
  batches: ExtraOccasionBatch[]
  createBatch: (input: ExtraOccasionBatchInput) => ExtraOccasionBatch
  renameBatch: (id: string, name: string) => void
  deleteBatch: (id: string) => void
  /** Server hydration on load: applies a snapshot locally, never writes back. */
  importData: (batches: ExtraOccasionBatch[]) => void
  /**
   * Backup restore. Unlike `importData` (local-only), this reconciles the
   * server: upserts every restored row and deletes the rows present before but
   * absent from the backup.
   */
  restoreData: (batches: ExtraOccasionBatch[]) => void
  clear: () => void
}

type BatchSetter = (partial: Partial<Pick<ExtraOccasionBatchState, 'batches'>>) => void

function writeBatch(
  set: BatchSetter,
  previous: ExtraOccasionBatch[],
  batch: ExtraOccasionBatch,
  failure: string,
) {
  persistWrite({
    write: upsertRow('extra_occasion_batches', batch.id, batch),
    rollback: () => set({ batches: previous }),
    failure,
  })
}

export const useExtraOccasionBatchStore = create<ExtraOccasionBatchState>()(
  persist(
    (set, get) => ({
      batches: [],

      createBatch: (input) => {
        const previous = get().batches
        const now = new Date().toISOString()
        const batch: ExtraOccasionBatch = {
          id: input.id ?? nanoid(),
          name: input.name,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ batches: [...state.batches, batch] }))
        writeBatch(
          set,
          previous,
          batch,
          'Could not save the planning session. It was not added.',
        )
        return batch
      },

      renameBatch: (id, name) => {
        const previous = get().batches
        const existing = previous.find((batch) => batch.id === id)
        if (!existing) return
        const next: ExtraOccasionBatch = {
          ...existing,
          name,
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({
          batches: state.batches.map((batch) => (batch.id === id ? next : batch)),
        }))
        writeBatch(
          set,
          previous,
          next,
          'Could not rename the planning session. Your change was reverted.',
        )
      },

      deleteBatch: (id) => {
        const previous = get().batches
        if (!previous.some((batch) => batch.id === id)) return
        set((state) => ({
          batches: state.batches.filter((batch) => batch.id !== id),
        }))
        persistWrite({
          write: deleteRow('extra_occasion_batches', id),
          rollback: () => set({ batches: previous }),
          failure: 'Could not delete the planning session. It was restored.',
        })
      },

      importData: (batches) => set({ batches }),

      restoreData: (batches) => {
        const previous = get().batches
        set({ batches })
        const nextIds = new Set(batches.map((batch) => batch.id))
        const removedIds = previous
          .filter((batch) => !nextIds.has(batch.id))
          .map((batch) => batch.id)
        persistWrite({
          write: [
            ...batches.map((batch) =>
              upsertRow('extra_occasion_batches', batch.id, batch),
            ),
            ...removedIds.map((id) => deleteRow('extra_occasion_batches', id)),
          ],
          rollback: () => set({ batches: previous }),
          failure:
            'Could not restore planning sessions on the server. Your previous data was kept.',
        })
      },

      clear: () => {
        const previous = get().batches
        set({ batches: [] })
        persistWrite({
          write: deleteAllRows('extra_occasion_batches'),
          rollback: () => set({ batches: previous }),
          failure:
            'Could not clear planning sessions on the server. Your data was restored.',
        })
      },
    }),
    { name: 'choir-extra-occasion-batches' },
  ),
)
