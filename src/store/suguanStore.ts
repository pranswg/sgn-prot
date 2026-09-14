import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Suguan, SuguanStatus } from '@/core/types/suguan'
import { defaultCapacities } from '@/core/constants/serviceTypes'
import { useSettingsStore } from '@/store/settingsStore'
import { seedSuguan } from '@/lib/seedData'

export interface SuguanConfigInput {
  date: string
  time: string
  serviceTypeId: string
  location?: string
  notes?: string
}

interface SuguanState {
  suguan: Suguan[]
  createSuguan: (config: SuguanConfigInput) => Suguan
  updateSuguan: (id: string, patch: Partial<Suguan>) => void
  setStatus: (id: string, status: SuguanStatus) => void
  addAssignment: (suguanId: string, assignment: { memberId: string; memberName: string; voicePosition: string }) => void
  removeAssignment: (suguanId: string, memberId: string, voicePosition: string) => void
  setDutyRole: (suguanId: string, dutyRoleId: string, memberId: string, memberName: string) => void
  removeDutyRole: (suguanId: string, dutyRoleId: string) => void
  publishSuguan: (id: string) => void
  deleteSuguan: (id: string) => void
  resetDemoData: () => void
  importData: (suguan: Suguan[]) => void
  clear: () => void
}

export const useSuguanStore = create<SuguanState>()(
  persist(
    (set) => ({
      suguan: seedSuguan(),

      createSuguan: (config) => {
        const now = new Date().toISOString()
        const suguan: Suguan = {
          id: nanoid(),
          ...config,
          status: 'draft',
          voiceCapacities: defaultCapacities(useSettingsStore.getState().allVoices()),
          assignments: [],
          dutyRoles: [],
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ suguan: [...s.suguan, suguan] }))
        return suguan
      },

      updateSuguan: (id, patch) => {
        set((s) => ({
          suguan: s.suguan.map((su) =>
            su.id === id
              ? { ...su, ...patch, updatedAt: new Date().toISOString() }
              : su,
          ),
        }))
      },

      setStatus: (id, status) => {
        set((s) => ({
          suguan: s.suguan.map((su) =>
            su.id === id
              ? {
                  ...su,
                  status,
                  updatedAt: new Date().toISOString(),
                  publishedAt:
                    status === 'published' && !su.publishedAt
                      ? new Date().toISOString()
                      : su.publishedAt,
                }
              : su,
          ),
        }))
      },

      addAssignment: (suguanId, assignment) => {
        set((s) => ({
          suguan: s.suguan.map((su) =>
            su.id === suguanId
              ? {
                  ...su,
                  assignments: [
                    ...su.assignments,
                    { ...assignment, assignedAt: new Date().toISOString() },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : su,
          ),
        }))
      },

      removeAssignment: (suguanId, memberId, voicePosition) => {
        set((s) => ({
          suguan: s.suguan.map((su) =>
            su.id === suguanId
              ? {
                  ...su,
                  assignments: su.assignments.filter(
                    (a) =>
                      !(a.memberId === memberId && a.voicePosition === voicePosition),
                  ),
                  updatedAt: new Date().toISOString(),
                }
              : su,
          ),
        }))
      },

      setDutyRole: (suguanId, dutyRoleId, memberId, memberName) => {
        set((s) => ({
          suguan: s.suguan.map((su) =>
            su.id === suguanId
              ? {
                  ...su,
                  dutyRoles: [
                    ...su.dutyRoles.filter((d) => d.dutyRoleId !== dutyRoleId),
                    { dutyRoleId, memberId, memberName },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : su,
          ),
        }))
      },

      removeDutyRole: (suguanId, dutyRoleId) => {
        set((s) => ({
          suguan: s.suguan.map((su) =>
            su.id === suguanId
              ? {
                  ...su,
                  dutyRoles: su.dutyRoles.filter((d) => d.dutyRoleId !== dutyRoleId),
                  updatedAt: new Date().toISOString(),
                }
              : su,
          ),
        }))
      },

      publishSuguan: (id) => {
        set((s) => ({
          suguan: s.suguan.map((su) =>
            su.id === id
              ? {
                  ...su,
                  status: 'published',
                  publishedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : su,
          ),
        }))
      },

      deleteSuguan: (id) => {
        set((s) => ({ suguan: s.suguan.filter((su) => su.id !== id) }))
      },

      resetDemoData: () => {
        set({ suguan: seedSuguan() })
      },

      importData: (suguan) => {
        set({ suguan })
      },

      clear: () => {
        set({ suguan: [] })
      },
    }),
    {
      name: 'choir-suguan',
      version: 1,
    },
  ),
)