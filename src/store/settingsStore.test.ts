import assert from 'node:assert/strict'
import test from 'node:test'
import { getVoiceName, getVoicePosition } from '@/core/constants/voicePositions'
import { useSettingsStore } from './settingsStore.ts'

test('settings reference lists start empty and can be configured by the user', () => {
  const store = useSettingsStore.getState()
  store.clear()
  assert.deepEqual(store.allServiceTypes(), [])
  assert.deepEqual(store.allDutyRoles(), [])
  assert.deepEqual(store.allVoices(), [])

  useSettingsStore.getState().addServiceType('Vespers')
  useSettingsStore.getState().addDutyRole('Choir Coordinator', 'CC')
  useSettingsStore.getState().addVoice('Soprano', 'female')
  assert.deepEqual(useSettingsStore.getState().allServiceTypes().map((item) => item.name), [
    'Vespers',
  ])
  assert.deepEqual(useSettingsStore.getState().allDutyRoles().map((item) => item.name), [
    'Choir Coordinator',
  ])
  assert.deepEqual(useSettingsStore.getState().allVoices().map((item) => item.name), [
    'Soprano',
  ])
  useSettingsStore.getState().clear()
})

test('restored backups do not reintroduce hard-coded standard reference entries', () => {
  useSettingsStore.getState().importData(
    [
      { id: 'legacy-default', name: 'Pagsamba', custom: false },
      { id: 'custom-service', name: 'Vespers', custom: true },
    ],
    [
      { id: 'legacy-role', name: 'OIC', abbreviation: 'OIC', custom: false },
      { id: 'custom-role', name: 'Coordinator', abbreviation: 'CO', custom: true },
    ],
    [
      { id: 'legacy-voice', name: 'Soprano 1', shortName: 'S1', gender: 'female', custom: false },
      { id: 'custom-voice', name: 'Contralto', shortName: 'CO', gender: 'female', custom: true },
    ],
  )
  assert.deepEqual(useSettingsStore.getState().allServiceTypes().map((item) => item.id), [
    'custom-service',
  ])
  assert.deepEqual(useSettingsStore.getState().allDutyRoles().map((item) => item.id), [
    'custom-role',
  ])
  assert.deepEqual(useSettingsStore.getState().allVoices().map((item) => item.id), [
    'custom-voice',
  ])
  useSettingsStore.getState().clear()
})

test('voice helpers do not silently substitute built-in voice positions', () => {
  assert.equal(getVoiceName('soprano-1'), 'soprano-1')
  assert.equal(getVoicePosition('soprano-1'), undefined)
})
