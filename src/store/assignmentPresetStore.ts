import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { SuguanAssignment, SuguanDutyRole } from '@/core/types/suguan'
import { deleteRow, upsertOwnedRow } from '@/api/db'
import { persist as persistWrite } from '@/lib/writeThrough'
import { useAuthStore } from '@/store/authStore'

export interface AssignmentPreset {
  id: string
  name: string
  assignments: SuguanAssignment[]
  dutyRoles: SuguanDutyRole[]
  createdAt: string
}

interface AssignmentPresetState {
  presets: AssignmentPreset[]
  importData: (presets: AssignmentPreset[]) => void
  savePreset: (name: string, assignments: SuguanAssignment[], dutyRoles: SuguanDutyRole[]) => AssignmentPreset
  deletePreset: (id: string) => void
  clear: () => void
}

export const useAssignmentPresetStore = create<AssignmentPresetState>()(
  persist(
    (set, get) => ({
      presets: [],

      importData: (presets) => set({ presets }),

      savePreset: (name, assignments, dutyRoles) => {
        const previous = get().presets
        const preset: AssignmentPreset = {
          id: nanoid(),
          name: name.trim(),
          assignments: assignments.map((a) => ({
            memberId: a.memberId,
            memberName: a.memberName,
            voicePosition: a.voicePosition,
            assignedAt: '',
          })),
          dutyRoles: dutyRoles.map((d) => ({ ...d })),
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ presets: [preset, ...s.presets] }))
        const ownerId = useAuthStore.getState().currentAccountId
        // Presets are per-user; only persist once we know who the owner is.
        if (ownerId) {
          persistWrite({
            write: upsertOwnedRow('assignment_presets', preset.id, preset, ownerId),
            rollback: () => set({ presets: previous }),
            failure: 'Could not save the preset. It was not added.',
          })
        }
        return preset
      },

      deletePreset: (id) => {
        const previous = get().presets
        if (!previous.some((preset) => preset.id === id)) return
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }))
        persistWrite({
          write: deleteRow('assignment_presets', id),
          rollback: () => set({ presets: previous }),
          failure: 'Could not delete the preset. It was restored.',
        })
      },

      clear: () => {
        set({ presets: [] })
      },
    }),
    {
      name: 'choir-assignment-presets',
      version: 1,
    },
  ),
)
