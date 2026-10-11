import type { ServerSettingsData } from '@/lib/serverData'
import type {
  StoredDutyRole,
  StoredServiceType,
  StoredVoice,
} from '@/store/settingsStore'
import type { StoredWorshipSchedule } from '@/store/worshipScheduleStore'

/**
 * The shape and single builder for the shared `settings` row (`id = 1`). The
 * row folds both `settingsStore` and `worshipScheduleStore` into one JSONB
 * document — the same shape `settingsRowToStoreData` reads back in Phase 3 — so
 * write-through and hydration stay in lockstep.
 */
export interface SettingsRowInput {
  serviceTypes: StoredServiceType[]
  dutyRoles: StoredDutyRole[]
  voices: StoredVoice[]
  localeName: string
  defaultServiceTypeId: string | null
  midweek: StoredWorshipSchedule[]
  weekend: StoredWorshipSchedule[]
}

export function buildSettingsRow(input: SettingsRowInput): ServerSettingsData {
  return {
    serviceTypes: input.serviceTypes,
    dutyRoles: input.dutyRoles,
    voices: input.voices,
    localeName: input.localeName,
    defaultServiceTypeId: input.defaultServiceTypeId,
    midweek: input.midweek,
    weekend: input.weekend,
  }
}
