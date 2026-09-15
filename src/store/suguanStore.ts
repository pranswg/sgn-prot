import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Suguan, SuguanEvent, SuguanGroup, SuguanType, SuguanDocFormat, SuguanCoverage, SuguanScheduleSection } from '@/core/types/suguan'
import { defaultCapacities } from '@/core/constants/serviceTypes'
import { useSettingsStore } from '@/store/settingsStore'
import { defaultEventsFor, normalizeSuguanList } from '@/lib/suguanUtils'

export interface SuguanConfigInput {
  date: string
  time: string
  serviceTypeId: string
  location?: string
  notes?: string
  type?: SuguanType
  eventTitle?: string
  group?: SuguanGroup
  docFormat?: SuguanDocFormat
  coverage?: SuguanCoverage
  events?: SuguanEvent[]
  schedules?: SuguanScheduleSection[]
  destinadoName?: string
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
  importData: (suguan: Suguan[]) => void
  clear: () => void
}

export const useSuguanStore = create<SuguanState>()(
  persist(
    (set) => ({
      suguan: [],

      createSuguan: (config) => {
        const now = new Date().toISOString()
        const voices = useSettingsStore.getState().allVoices()
        const events = config.events ?? defaultEventsFor(config.date)
        const suguan: Suguan = normalizeSuguanList(
          [
            {
              id: nanoid(),
              ...config,
              type: config.type ?? 'regular',
              eventTitle: config.eventTitle,
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

      deleteSuguan: (id) => {
        set((s) => ({ suguan: s.suguan.filter((su) => su.id !== id) }))
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
      version: 6,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Pick<SuguanState, 'suguan'>
        const list = Array.isArray(state.suguan) ? state.suguan : []
        const voices = useSettingsStore.getState().allVoices()
        return { ...state, suguan: normalizeSuguanList(list, voices) }
      },
    },
  ),
)