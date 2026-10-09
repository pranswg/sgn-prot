import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useMemo } from 'react'
import { nanoid } from 'nanoid'
import type {
  WorshipSchedule,
  WorshipScheduleCategories,
} from '@/core/constants/worshipSchedules'
import {
  DEFAULT_SCHEDULE_CATEGORIES,
  worshipDayName,
} from '@/core/constants/worshipSchedules'

export type WorshipScheduleCategory = 'midweek' | 'weekend'

/** A worship schedule as configured by the admin, standard or custom. */
export type StoredWorshipSchedule = WorshipSchedule & {
  custom: boolean
  disabled?: boolean
}

export interface WorshipScheduleInput {
  weekday: number
  scheduleTime: string
  label: string
}

interface WorshipScheduleState {
  midweek: StoredWorshipSchedule[]
  weekend: StoredWorshipSchedule[]
  addSchedule: (
    category: WorshipScheduleCategory,
    input: WorshipScheduleInput,
  ) => void
  updateSchedule: (
    category: WorshipScheduleCategory,
    id: string,
    patch: Partial<Pick<StoredWorshipSchedule, 'weekday' | 'scheduleTime' | 'label' | 'disabled'>>,
  ) => void
  removeSchedule: (category: WorshipScheduleCategory, id: string) => void
  toggleSchedule: (category: WorshipScheduleCategory, id: string) => void
  /** Batch-commit the whole config, used by the Settings editor's Save. */
  setSchedules: (midweek: StoredWorshipSchedule[], weekend: StoredWorshipSchedule[]) => void
  importData: (
    midweek?: StoredWorshipSchedule[],
    weekend?: StoredWorshipSchedule[],
  ) => void
  clear: () => void
  /** Empty every category. Used by the factory reset, unlike `clear` which reseeds. */
  resetToEmpty: () => void
}

const seed = (): Pick<WorshipScheduleState, 'midweek' | 'weekend'> => ({
  midweek: DEFAULT_SCHEDULE_CATEGORIES.midweek.map((s) => ({
    ...s,
    custom: false,
  })),
  weekend: DEFAULT_SCHEDULE_CATEGORIES.weekend.map((s) => ({
    ...s,
    custom: false,
  })),
})

export const useWorshipScheduleStore = create<WorshipScheduleState>()(
  persist(
    (set) => ({
      ...seed(),

      addSchedule: (category, input) => {
        const record: StoredWorshipSchedule = {
          id: nanoid(),
          weekday: input.weekday,
          scheduleDay: worshipDayName(input.weekday).toUpperCase(),
          scheduleTime: input.scheduleTime,
          label: input.label,
          presetHint: '',
          custom: true,
        }
        set((s) =>
          category === 'midweek'
            ? { midweek: [...s.midweek, record] }
            : { weekend: [...s.weekend, record] },
        )
      },

      updateSchedule: (category, id, patch) =>
        set((s) => {
          const list = category === 'midweek' ? s.midweek : s.weekend
          const next = list.map((item) =>
            item.id !== id
              ? item
              : {
                  ...item,
                  ...patch,
                  scheduleDay:
                    patch.weekday != null
                      ? worshipDayName(patch.weekday).toUpperCase()
                      : item.scheduleDay,
                },
          )
          return category === 'midweek' ? { midweek: next } : { weekend: next }
        }),

      toggleSchedule: (category, id) =>
        set((s) => {
          const list = category === 'midweek' ? s.midweek : s.weekend
          const next = list.map((item) =>
            item.id === id ? { ...item, disabled: !item.disabled } : item,
          )
          return category === 'midweek' ? { midweek: next } : { weekend: next }
        }),

      removeSchedule: (category, id) =>
        set((s) => {
          const list = category === 'midweek' ? s.midweek : s.weekend
          const next = list.filter((item) => item.id !== id)
          return category === 'midweek' ? { midweek: next } : { weekend: next }
        }),

      setSchedules: (midweek, weekend) => set({ midweek, weekend }),

      importData: (midweek, weekend) =>
        set((s) => ({
          midweek: midweek ?? s.midweek,
          weekend: weekend ?? s.weekend,
        })),

      clear: () => set(seed()),

      resetToEmpty: () => set({ midweek: [], weekend: [] }),
    }),
    {
      name: 'choir-worship-schedules',
      version: 1,
      migrate: (persisted) => {
        const p = persisted as Partial<WorshipScheduleState> | undefined
        const fallback = seed()
        return {
          ...(p as Partial<WorshipScheduleState>),
          midweek: p?.midweek ?? fallback.midweek,
          weekend: p?.weekend ?? fallback.weekend,
        }
      },
    },
  ),
)

/**
 * The active (not disabled) midweek and weekend schedule lists. Components
 * subscribe to the two arrays directly so a change to one category does not
 * re-render every watcher of the other.
 */
export function useWorshipScheduleCategories(): WorshipScheduleCategories {
  const midweek = useWorshipScheduleStore((s) => s.midweek)
  const weekend = useWorshipScheduleStore((s) => s.weekend)
  return useMemo(
    () => ({
      midweek: midweek.filter((s) => !s.disabled),
      weekend: weekend.filter((s) => !s.disabled),
    }),
    [midweek, weekend],
  )
}