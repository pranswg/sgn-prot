import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { ServiceType, VoicePosition, DutyRole } from '@/core/types/suguan'
import { DEFAULT_SERVICE_TYPES } from '@/core/constants/serviceTypes'
import { DEFAULT_DUTY_ROLES } from '@/core/constants/dutyRoles'
import { DEFAULT_VOICE_POSITIONS } from '@/core/constants/voicePositions'

export type StoredDutyRole = DutyRole & { custom: boolean }
export type StoredServiceType = ServiceType & { custom: boolean }
export type StoredVoice = VoicePosition & { custom: boolean }

const seedServiceTypes = (): StoredServiceType[] =>
  DEFAULT_SERVICE_TYPES.map((t) => ({ ...t, custom: false }))

const seedDutyRoles = (): StoredDutyRole[] =>
  DEFAULT_DUTY_ROLES.map((r) => ({ ...r, custom: false }))

const seedVoices = (): StoredVoice[] =>
  DEFAULT_VOICE_POSITIONS.map((v) => ({ ...v, custom: false }))

interface SettingsState {
  serviceTypes: StoredServiceType[]
  dutyRoles: StoredDutyRole[]
  voices: StoredVoice[]
  addServiceType: (name: string) => void
  updateServiceType: (id: string, patch: { name: string }) => void
  removeServiceType: (id: string) => void
  addDutyRole: (name: string, abbreviation: string) => void
  updateDutyRole: (id: string, patch: { name: string; abbreviation: string }) => void
  removeDutyRole: (id: string) => void
  addVoice: (name: string, gender: 'male' | 'female') => void
  updateVoice: (id: string, patch: { name: string; gender: 'male' | 'female' }) => void
  removeVoice: (id: string) => void
  allServiceTypes: () => StoredServiceType[]
  allDutyRoles: () => StoredDutyRole[]
  allVoices: () => StoredVoice[]
  importData: (
    serviceTypes: StoredServiceType[],
    dutyRoles: StoredDutyRole[],
    voices: StoredVoice[],
  ) => void
  clear: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      serviceTypes: seedServiceTypes(),
      dutyRoles: seedDutyRoles(),
      voices: seedVoices(),

      addServiceType: (name) => {
        set((s) => ({
          serviceTypes: [
            ...s.serviceTypes,
            { id: nanoid(), name, custom: true },
          ],
        }))
      },

      updateServiceType: (id, patch) => {
        set((s) => ({
          serviceTypes: s.serviceTypes.map((t) =>
            t.id === id ? { ...t, ...patch } : t,
          ),
        }))
      },

      removeServiceType: (id) => {
        set((s) => ({
          serviceTypes: s.serviceTypes.filter((t) => t.id !== id),
        }))
      },

      addDutyRole: (name, abbreviation) => {
        set((s) => ({
          dutyRoles: [
            ...s.dutyRoles,
            { id: nanoid(), name, abbreviation, custom: true },
          ],
        }))
      },

      updateDutyRole: (id, patch) => {
        set((s) => ({
          dutyRoles: s.dutyRoles.map((r) =>
            r.id === id ? { ...r, ...patch } : r,
          ),
        }))
      },

      removeDutyRole: (id) => {
        set((s) => ({
          dutyRoles: s.dutyRoles.filter((r) => r.id !== id),
        }))
      },

      addVoice: (name, gender) => {
        set((s) => ({
          voices: [
            ...s.voices,
            {
              id: nanoid(),
              name,
              shortName: name.trim().slice(0, 2).toUpperCase(),
              gender,
              custom: true,
            },
          ],
        }))
      },

      updateVoice: (id, patch) => {
        set((s) => ({
          voices: s.voices.map((v) =>
            v.id === id
              ? {
                  ...v,
                  ...patch,
                  shortName: patch.name.trim().slice(0, 2).toUpperCase(),
                }
              : v,
          ),
        }))
      },

      removeVoice: (id) => {
        set((s) => ({
          voices: s.voices.filter((v) => v.id !== id),
        }))
      },

      allServiceTypes: () => get().serviceTypes,
      allDutyRoles: () => get().dutyRoles,
      allVoices: () => get().voices,

      importData: (serviceTypes, dutyRoles, voices) => {
        set({ serviceTypes, dutyRoles, voices })
      },

      clear: () => {
        set({ serviceTypes: [], dutyRoles: [], voices: [] })
      },
    }),
    {
      name: 'choir-settings',
      version: 3,
    },
  ),
)