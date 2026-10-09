import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { ServiceType, VoicePosition, DutyRole } from '@/core/types/suguan'
import { reorderList } from '@/lib/reorderList'

export type StoredDutyRole = DutyRole & { custom: boolean }
export type StoredServiceType = ServiceType & { custom: boolean }
export type StoredVoice = VoicePosition & { custom: boolean }

interface SettingsState {
  serviceTypes: StoredServiceType[]
  dutyRoles: StoredDutyRole[]
  voices: StoredVoice[]
  localeName: string
  /**
   * Which service type a new Suguan starts with. There is at most one default;
   * setting a new one replaces whatever was set before, and deleting the
   * default clears it. `null` means "no default configured".
   */
  defaultServiceTypeId: string | null
  setLocaleName: (name: string) => void
  setDefaultServiceType: (id: string | null) => void
  addServiceType: (name: string) => void
  updateServiceType: (id: string, patch: { name: string }) => void
  removeServiceType: (id: string) => void
  moveServiceType: (id: string, toIndex: number) => void
  addDutyRole: (name: string, abbreviation: string) => void
  updateDutyRole: (id: string, patch: { name: string; abbreviation: string }) => void
  removeDutyRole: (id: string) => void
  moveDutyRole: (id: string, toIndex: number) => void
  addVoice: (name: string, gender: 'male' | 'female') => void
  updateVoice: (id: string, patch: { name: string; gender: 'male' | 'female' }) => void
  removeVoice: (id: string) => void
  /**
   * Array index is the order of every list here, and the order is not cosmetic:
   * the voice list decides how the Master List sorts members, and the service
   * type list decides the order of the picker when a Suguan is built.
   */
  moveVoice: (id: string, toIndex: number) => void
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
      serviceTypes: [],
      dutyRoles: [],
      voices: [],
      localeName: 'Sta. Monica',
      defaultServiceTypeId: null,

      setLocaleName: (localeName) => set({ localeName: localeName.trim() }),

      setDefaultServiceType: (id) =>
        // Setting the current default again clears it, so "remove default" is
        // the same gesture as "set default". Any other id simply replaces the
        // previous default; only one default is ever active.
        set((s) => ({
          defaultServiceTypeId: s.defaultServiceTypeId === id ? null : id,
        })),

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
          // A deleted default must not dangle behind an id that no longer
          // exists in the list.
          defaultServiceTypeId:
            s.defaultServiceTypeId === id ? null : s.defaultServiceTypeId,
        }))
      },

      moveServiceType: (id, toIndex) => {
        set((s) => ({
          serviceTypes: reorderList(s.serviceTypes, id, toIndex),
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

      moveDutyRole: (id, toIndex) => {
        set((s) => ({
          dutyRoles: reorderList(s.dutyRoles, id, toIndex),
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

      moveVoice: (id, toIndex) => {
        set((s) => ({ voices: reorderList(s.voices, id, toIndex) }))
      },

      allServiceTypes: () => get().serviceTypes,
      allDutyRoles: () => get().dutyRoles,
      allVoices: () => get().voices,

      importData: (serviceTypes, dutyRoles, voices) => {
        const configuredServiceTypes = serviceTypes.filter((item) => item.custom !== false)
        const configuredDutyRoles = dutyRoles.filter((item) => item.custom !== false)
        const configuredVoices = voices.filter((item) => item.custom !== false)
        set((s) => ({
          serviceTypes: configuredServiceTypes,
          dutyRoles: configuredDutyRoles,
          voices: configuredVoices,
          // A restored backup may not contain the current default service type;
          // keep the default only when it survives the import.
          defaultServiceTypeId:
            s.defaultServiceTypeId != null &&
            configuredServiceTypes.some((t) => t.id === s.defaultServiceTypeId)
              ? s.defaultServiceTypeId
              : null,
        }))
      },

      clear: () => {
        set({
          serviceTypes: [],
          dutyRoles: [],
          voices: [],
          localeName: '',
          defaultServiceTypeId: null,
        })
      },
    }),
    {
      name: 'choir-settings',
      version: 6,
      migrate: (persisted) => {
        const p = persisted as Partial<SettingsState> | undefined
        const serviceTypes = (p?.serviceTypes ?? []).filter(
          (item) => item.custom !== false,
        )
        const dutyRoles = (p?.dutyRoles ?? []).filter(
          (item) => item.custom !== false,
        )
        const voices = (p?.voices ?? []).filter(
          (item) => item.custom !== false,
        )
        return {
          ...(p as Partial<SettingsState>),
          localeName: p?.localeName ?? 'Sta. Monica',
          serviceTypes,
          dutyRoles,
          voices,
          defaultServiceTypeId:
            p?.defaultServiceTypeId &&
            serviceTypes.some((item) => item.id === p.defaultServiceTypeId)
              ? p.defaultServiceTypeId
              : null,
        }
      },
    },
  ),
)