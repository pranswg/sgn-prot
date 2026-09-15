import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { SuguanAssignment, SuguanDutyRole } from '@/core/types/suguan'

export interface AssignmentPreset {
  id: string
  name: string
  assignments: SuguanAssignment[]
  dutyRoles: SuguanDutyRole[]
  createdAt: string
}

interface AssignmentPresetState {
  presets: AssignmentPreset[]
  savePreset: (name: string, assignments: SuguanAssignment[], dutyRoles: SuguanDutyRole[]) => AssignmentPreset
  deletePreset: (id: string) => void
  clear: () => void
}

export const useAssignmentPresetStore = create<AssignmentPresetState>()(
  persist(
    (set) => ({
      presets: [],

      savePreset: (name, assignments, dutyRoles) => {
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
        return preset
      },

      deletePreset: (id) => {
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }))
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