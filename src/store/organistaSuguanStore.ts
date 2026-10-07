import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  OrganistaSuguanRecord,
  OrganistaSuguanService,
} from '@/core/types/organistaSuguan'

export type OrganistaSuguanRecordInput = Omit<
  OrganistaSuguanRecord,
  'id' | 'createdAt' | 'updatedAt'
>

interface OrganistaSuguanState {
  records: OrganistaSuguanRecord[]
  createRecord: (input: OrganistaSuguanRecordInput) => OrganistaSuguanRecord
  deleteRecord: (id: string) => void
  deleteMany: (ids: string[]) => void
  clear: () => void
}

export const useOrganistaSuguanStore = create<OrganistaSuguanState>()(
  persist(
    (set) => ({
      records: [],
      createRecord: (input) => {
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
        return record
      },
      deleteRecord: (id) =>
        set((state) => ({
          records: state.records.filter((record) => record.id !== id),
        })),
      deleteMany: (ids) => {
        const deleted = new Set(ids)
        set((state) => ({
          records: state.records.filter((record) => !deleted.has(record.id)),
        }))
      },
      clear: () => set({ records: [] }),
    }),
    { name: 'choir-organista-suguan-history' },
  ),
)
