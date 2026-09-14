import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { ServiceType, VoicePosition } from '@/core/types/suguan'
import { DEFAULT_SERVICE_TYPES } from '@/core/constants/serviceTypes'
import { DEFAULT_DUTY_ROLES } from '@/core/constants/dutyRoles'
import { DEFAULT_VOICE_POSITIONS } from '@/core/constants/voicePositions'
import type { DutyRole } from '@/core/types/suguan'

type CustomDutyRole = DutyRole & { custom: boolean }
type CustomServiceType = ServiceType & { custom: boolean }
type CustomVoice = VoicePosition & { custom: boolean }

interface SettingsState {
  customServiceTypes: CustomServiceType[]
  customDutyRoles: CustomDutyRole[]
  customVoices: CustomVoice[]
  addServiceType: (name: string) => void
  removeServiceType: (id: string) => void
  addDutyRole: (name: string, abbreviation: string) => void
  removeDutyRole: (id: string) => void
  addVoice: (name: string, gender: 'male' | 'female') => void
  removeVoice: (id: string) => void
  allServiceTypes: () => CustomServiceType[]
  allDutyRoles: () => CustomDutyRole[]
  allVoices: () => CustomVoice[]
  resetDemoData: () => void
  importData: (serviceTypes: CustomServiceType[], dutyRoles: CustomDutyRole[], voices: CustomVoice[]) => void
  clear: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      customServiceTypes: [],
      customDutyRoles: [],
      customVoices: [],

      addServiceType: (name) => {
        set((s) => ({
          customServiceTypes: [
            ...s.customServiceTypes,
            { id: nanoid(), name, custom: true },
          ],
        }))
      },

      removeServiceType: (id) => {
        set((s) => ({
          customServiceTypes: s.customServiceTypes.filter((t) => t.id !== id),
        }))
      },

      addDutyRole: (name, abbreviation) => {
        set((s) => ({
          customDutyRoles: [
            ...s.customDutyRoles,
            { id: nanoid(), name, abbreviation, custom: true },
          ],
        }))
      },

      removeDutyRole: (id) => {
        set((s) => ({
          customDutyRoles: s.customDutyRoles.filter((r) => r.id !== id),
        }))
      },

      addVoice: (name, gender) => {
        set((s) => ({
          customVoices: [
            ...s.customVoices,
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

      removeVoice: (id) => {
        set((s) => ({
          customVoices: s.customVoices.filter((v) => v.id !== id),
        }))
      },

      allServiceTypes: () => [
        ...DEFAULT_SERVICE_TYPES.map((t) => ({ ...t, custom: false })),
        ...get().customServiceTypes,
      ],

      allDutyRoles: () => [
        ...DEFAULT_DUTY_ROLES.map((r) => ({ ...r, custom: false })),
        ...get().customDutyRoles,
      ],

      allVoices: () => [
        ...DEFAULT_VOICE_POSITIONS.map((v) => ({ ...v, custom: false })),
        ...get().customVoices,
      ],

      resetDemoData: () => {
        set({ customServiceTypes: [], customDutyRoles: [], customVoices: [] })
      },

      importData: (serviceTypes, dutyRoles, voices) => {
        set({
          customServiceTypes: serviceTypes,
          customDutyRoles: dutyRoles,
          customVoices: voices,
        })
      },

      clear: () => {
        set({ customServiceTypes: [], customDutyRoles: [], customVoices: [] })
      },
    }),
    {
      name: 'choir-settings',
      version: 2,
    },
  ),
)