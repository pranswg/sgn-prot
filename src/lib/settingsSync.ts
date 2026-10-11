import { upsertSettingsRow } from '@/api/db'
import { persist } from '@/lib/writeThrough'
import { buildSettingsRow } from '@/lib/settingsRow'
import type { ServerSettingsData } from '@/lib/serverData'
import { useSettingsStore } from '@/store/settingsStore'
import { useWorshipScheduleStore } from '@/store/worshipScheduleStore'

/**
 * Write-through glue for the shared `settings` row. Both `settingsStore` and
 * `worshipScheduleStore` edit halves of the same document, so a change in
 * either persists the whole row. The two stores import these functions at call
 * time (inside their actions), which is why the store ↔ sync cycle is safe.
 */

/** The current settings document assembled from both stores. */
export function snapshotSettingsRow(): ServerSettingsData {
  const settings = useSettingsStore.getState()
  const worship = useWorshipScheduleStore.getState()
  return buildSettingsRow({
    serviceTypes: settings.serviceTypes,
    dutyRoles: settings.dutyRoles,
    voices: settings.voices,
    localeName: settings.localeName,
    defaultServiceTypeId: settings.defaultServiceTypeId,
    midweek: worship.midweek,
    weekend: worship.weekend,
  })
}

/** Applies a settings document to both stores (hydration and rollback). */
export function applySettingsRow(doc: ServerSettingsData) {
  useSettingsStore
    .getState()
    .importData(doc.serviceTypes, doc.dutyRoles, doc.voices)
  // `importData` drops items flagged `custom: false`, so a default service type
  // must be checked against the list that actually survived the import.
  const configuredServiceTypes = doc.serviceTypes.filter(
    (item) => item.custom !== false,
  )
  const defaultServiceTypeId =
    doc.defaultServiceTypeId &&
    configuredServiceTypes.some((item) => item.id === doc.defaultServiceTypeId)
      ? doc.defaultServiceTypeId
      : null
  useSettingsStore.setState({
    localeName: doc.localeName,
    defaultServiceTypeId,
  })
  useWorshipScheduleStore.getState().importData(doc.midweek, doc.weekend)
}

/**
 * Persists the current row and rolls both stores back to `previous` if the
 * write fails.
 */
export function persistSettingsRow(previous: ServerSettingsData) {
  persist({
    write: upsertSettingsRow(snapshotSettingsRow()),
    rollback: () => applySettingsRow(previous),
    failure: 'Could not save settings. Your change was reverted.',
  })
}
