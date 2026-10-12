import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearSettingsRow,
  restoreSettingsRow,
  snapshotSettingsRow,
} from './settingsSync.ts'
import { useSettingsStore } from '@/store/settingsStore.ts'
import { useWorshipScheduleStore } from '@/store/worshipScheduleStore.ts'

test('restoreSettingsRow applies a restored document to both stores', () => {
  const previous = snapshotSettingsRow()
  restoreSettingsRow({ ...previous, localeName: 'Restored Locale' }, previous)
  assert.equal(useSettingsStore.getState().localeName, 'Restored Locale')

  restoreSettingsRow(previous, snapshotSettingsRow())
  assert.equal(useSettingsStore.getState().localeName, previous.localeName)
})

test('clearSettingsRow keeps the locally-cleared state', () => {
  const previous = snapshotSettingsRow()
  useSettingsStore.getState().clear()
  useWorshipScheduleStore.getState().clear()
  clearSettingsRow(previous)
  assert.deepEqual(useSettingsStore.getState().allServiceTypes(), [])
})
