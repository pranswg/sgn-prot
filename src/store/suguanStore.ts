import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Suguan, SuguanEvent, SuguanGroup, SuguanDocFormat, SuguanCoverage, SuguanScheduleSection } from '@/core/types/suguan'
import { defaultCapacities } from '@/core/constants/serviceTypes'
import { deleteRow, upsertRow } from '@/api/db'
import { persist as persistWrite } from '@/lib/writeThrough'
import { useSettingsStore } from '@/store/settingsStore'
import { defaultEventsFor, normalizeSuguanList } from '@/lib/suguanUtils'

export interface SuguanConfigInput {
  date: string
  time: string
  serviceTypeId: string
  group?: SuguanGroup
  docFormat?: SuguanDocFormat
  coverage?: SuguanCoverage
  events?: SuguanEvent[]
  pagsasanayDate?: string
  pagtupadDate?: string
  schedules?: SuguanScheduleSection[]
  destinadoName?: string
  copiedFromId?: string
}

interface SuguanState {
  suguan: Suguan[]
  createSuguan: (config: SuguanConfigInput) => Suguan
  updateSuguan: (id: string, patch: Partial<Suguan>) => void
  addAssignment: (suguanId: string, assignment: { memberId: string; memberName: string; voicePosition: string }) => void
  removeAssignment: (suguanId: string, memberId: string, voicePosition: string) => void
  setDutyRole: (suguanId: string, dutyRoleId: string, memberId: string, memberName: string) => void
  removeDutyRole: (suguanId: string, dutyRoleId: string) => void
  deleteSuguan: (id: string) => void
  deleteMany: (ids: string[]) => void
  importData: (suguan: Suguan[]) => void
  clear: () => void
}

/**
 * Phase 4c write-through. A saved Suguan is one server row in `suguans`, so
 * each action upserts or deletes that row and restores the previous list if the
 * write fails. Backup `importData` and reset `clear` stay local (Phase 7 is the
 * bulk bridge).
 */
type SuguanStateSetter = (partial: Partial<Pick<SuguanState, 'suguan'>>) => void

function writeSuguan(
  set: SuguanStateSetter,
  previous: Suguan[],
  suguan: Suguan,
  failure: string,
) {
  persistWrite({
    write: upsertRow('suguans', suguan.id, suguan),
    rollback: () => set({ suguan: previous }),
    failure,
  })
}

function deleteSuguanRows(
  set: SuguanStateSetter,
  previous: Suguan[],
  ids: string[],
  failure: string,
) {
  persistWrite({
    write: ids.map((id) => deleteRow('suguans', id)),
    rollback: () => set({ suguan: previous }),
    failure,
  })
}

export const useSuguanStore = create<SuguanState>()(
  persist(
    (set, get) => ({
      suguan: [],

      createSuguan: (config) => {
        const previous = get().suguan
        const now = new Date().toISOString()
        const voices = useSettingsStore.getState().allVoices()
        const events = config.events ?? defaultEventsFor(config.date)
        const suguan: Suguan = normalizeSuguanList(
          [
            {
              id: nanoid(),
              ...config,
              group: config.group ?? 'babae',
              coverage: config.coverage ?? null,
              events,
              schedules: config.schedules ?? [],
              voiceCapacities: defaultCapacities(voices),
              assignments: [],
              dutyRoles: [],
              createdAt: now,
              updatedAt: now,
            },
          ],
          voices,
        )[0]
        set((s) => ({ suguan: [...s.suguan, suguan] }))
        writeSuguan(set, previous, suguan, 'Could not save the new Suguan. It was not added.')
        return suguan
      },

      updateSuguan: (id, patch) => {
        const previous = get().suguan
        const existing = previous.find((su) => su.id === id)
        if (!existing) return
        const next: Suguan = {
          ...existing,
          ...patch,
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ suguan: s.suguan.map((su) => (su.id === id ? next : su)) }))
        writeSuguan(set, previous, next, 'Could not save the Suguan. Your change was reverted.')
      },

      addAssignment: (suguanId, assignment) => {
        const previous = get().suguan
        const existing = previous.find((su) => su.id === suguanId)
        if (!existing) return
        const next: Suguan = {
          ...existing,
          assignments: [
            ...existing.assignments,
            { ...assignment, assignedAt: new Date().toISOString() },
          ],
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ suguan: s.suguan.map((su) => (su.id === suguanId ? next : su)) }))
        writeSuguan(set, previous, next, 'Could not save the assignment. Your change was reverted.')
      },

      removeAssignment: (suguanId, memberId, voicePosition) => {
        const previous = get().suguan
        const existing = previous.find((su) => su.id === suguanId)
        if (!existing) return
        const next: Suguan = {
          ...existing,
          assignments: existing.assignments.filter(
            (a) =>
              !(a.memberId === memberId && a.voicePosition === voicePosition),
          ),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ suguan: s.suguan.map((su) => (su.id === suguanId ? next : su)) }))
        writeSuguan(set, previous, next, 'Could not remove the assignment. Your change was reverted.')
      },

      setDutyRole: (suguanId, dutyRoleId, memberId, memberName) => {
        const previous = get().suguan
        const existing = previous.find((su) => su.id === suguanId)
        if (!existing) return
        const next: Suguan = {
          ...existing,
          dutyRoles: [
            ...existing.dutyRoles.filter((d) => d.dutyRoleId !== dutyRoleId),
            { dutyRoleId, memberId, memberName },
          ],
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ suguan: s.suguan.map((su) => (su.id === suguanId ? next : su)) }))
        writeSuguan(set, previous, next, 'Could not save the duty role. Your change was reverted.')
      },

      removeDutyRole: (suguanId, dutyRoleId) => {
        const previous = get().suguan
        const existing = previous.find((su) => su.id === suguanId)
        if (!existing) return
        const next: Suguan = {
          ...existing,
          dutyRoles: existing.dutyRoles.filter((d) => d.dutyRoleId !== dutyRoleId),
          updatedAt: new Date().toISOString(),
        }
        set((s) => ({ suguan: s.suguan.map((su) => (su.id === suguanId ? next : su)) }))
        writeSuguan(set, previous, next, 'Could not remove the duty role. Your change was reverted.')
      },

      deleteSuguan: (id) => {
        const previous = get().suguan
        if (!previous.some((su) => su.id === id)) return
        set((s) => ({ suguan: s.suguan.filter((su) => su.id !== id) }))
        deleteSuguanRows(set, previous, [id], 'Could not delete the Suguan. It was restored.')
      },

      deleteMany: (ids) => {
        const previous = get().suguan
        const toDelete = new Set(ids)
        const deletedIds = previous
          .filter((su) => toDelete.has(su.id))
          .map((su) => su.id)
        if (deletedIds.length === 0) return
        set((s) => ({ suguan: s.suguan.filter((su) => !toDelete.has(su.id)) }))
        deleteSuguanRows(
          set,
          previous,
          deletedIds,
          'Could not delete the selected Suguans. They were restored.',
        )
      },

      importData: (suguan) => {
        const voices = useSettingsStore.getState().allVoices()
        set({ suguan: normalizeSuguanList(suguan, voices) })
      },

      clear: () => {
        set({ suguan: [] })
      },
    }),
    {
      name: 'choir-suguan',
      version: 7,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Pick<SuguanState, 'suguan'>
        const list = Array.isArray(state.suguan) ? state.suguan : []
        const voices = useSettingsStore.getState().allVoices()
        return { ...state, suguan: normalizeSuguanList(list, voices) }
      },
    },
  ),
)
