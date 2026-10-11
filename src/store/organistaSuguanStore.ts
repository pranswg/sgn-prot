import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  OrganistaSuguanRecord,
  OrganistaSuguanService,
} from '@/core/types/organistaSuguan'
import { deleteRow, upsertRow } from '@/api/db'
import { persist as persistWrite } from '@/lib/writeThrough'

export type OrganistaSuguanRecordInput = Omit<
  OrganistaSuguanRecord,
  'id' | 'createdAt' | 'updatedAt'
>

interface OrganistaSuguanState {
  records: OrganistaSuguanRecord[]
  createRecord: (input: OrganistaSuguanRecordInput) => OrganistaSuguanRecord
  deleteRecord: (id: string) => void
  deleteMany: (ids: string[]) => void
  importData: (records: OrganistaSuguanRecord[]) => void
  clear: () => void
}

type OrganistaSetter = (
  partial: Partial<Pick<OrganistaSuguanState, 'records'>>,
) => void

function deleteRows(
  set: OrganistaSetter,
  previous: OrganistaSuguanRecord[],
  ids: string[],
  failure: string,
) {
  persistWrite({
    write: ids.map((id) => deleteRow('organista_suguans', id)),
    rollback: () => set({ records: previous }),
    failure,
  })
}

export const useOrganistaSuguanStore = create<OrganistaSuguanState>()(
  persist(
    (set, get) => ({
      records: [],
      createRecord: (input) => {
        const previous = get().records
        const now = new Date().toISOString()
        const record: OrganistaSuguanRecord = {
          ...input,
          id: nanoid(),
          services: input.services.map((service: OrganistaSuguanService) => ({
            ...service,
          })),
          docFormat: { ...input.docFormat },
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({ records: [...state.records, record] }))
        persistWrite({
          write: upsertRow('organista_suguans', record.id, record),
          rollback: () => set({ records: previous }),
          failure: 'Could not save the record. It was not added.',
        })
        return record
      },
      deleteRecord: (id) => {
        const previous = get().records
        if (!previous.some((record) => record.id === id)) return
        set((state) => ({
          records: state.records.filter((record) => record.id !== id),
        }))
        deleteRows(set, previous, [id], 'Could not delete the record. It was restored.')
      },
      deleteMany: (ids) => {
        const previous = get().records
        const deleted = new Set(ids)
        const deletedIds = previous
          .filter((record) => deleted.has(record.id))
          .map((record) => record.id)
        if (deletedIds.length === 0) return
        set((state) => ({
          records: state.records.filter((record) => !deleted.has(record.id)),
        }))
        deleteRows(
          set,
          previous,
          deletedIds,
          'Could not delete the selected records. They were restored.',
        )
      },
      importData: (records) => set({ records }),
      clear: () => set({ records: [] }),
    }),
    { name: 'choir-organista-suguan-history' },
  ),
)
