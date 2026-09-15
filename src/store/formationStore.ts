import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { SuguanFormation } from '@/core/types/suguan'

export interface SuguanFormationTemplate {
  id: string
  name: string
  rows: number
  cols: number
  cells: (FormationTemplateCell | null)[]
  createdAt: string
}

interface FormationTemplateCell {
  memberId: string
  memberName: string
  voicePosition: string
  voiceName: string
}

interface FormationState {
  templates: SuguanFormationTemplate[]
  saveTemplate: (name: string, formation: SuguanFormation) => SuguanFormationTemplate
  updateTemplate: (id: string, patch: Partial<SuguanFormationTemplate>) => void
  deleteTemplate: (id: string) => void
  clear: () => void
}

function toTemplateCell(
  cell: SuguanFormation['cells'][number],
): FormationTemplateCell | null {
  if (!cell) return null
  return {
    memberId: cell.memberId,
    memberName: cell.memberName,
    voicePosition: cell.voicePosition,
    voiceName: cell.voiceName,
  }
}

export const useFormationStore = create<FormationState>()(
  persist(
    (set) => ({
      templates: [],

      saveTemplate: (name, formation) => {
        const template: SuguanFormationTemplate = {
          id: nanoid(),
          name,
          rows: formation.rows,
          cols: formation.cols,
          cells: formation.cells.map(toTemplateCell),
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ templates: [template, ...s.templates] }))
        return template
      },

      updateTemplate: (id, patch) => {
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, ...patch } : t,
          ),
        }))
      },

      deleteTemplate: (id) => {
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
        }))
      },

      clear: () => {
        set({ templates: [] })
      },
    }),
    {
      name: 'choir-formations',
      version: 1,
    },
  ),
)