import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSettingsRow } from './settingsRow.ts'
import type { SettingsRowInput } from './settingsRow.ts'

const input: SettingsRowInput = {
  serviceTypes: [{ id: 'svc-1', name: 'Pagsamba', custom: true }],
  dutyRoles: [
    { id: 'role-1', name: 'Pangulo', abbreviation: 'PNG', custom: true },
  ],
  voices: [
    {
      id: 'voice-1',
      name: 'Soprano',
      shortName: 'SO',
      gender: 'female',
      custom: true,
    },
  ],
  localeName: 'Sta. Monica',
  defaultServiceTypeId: 'svc-1',
  midweek: [
    {
      id: 'mid-1',
      weekday: 3,
      scheduleDay: 'WEDNESDAY',
      scheduleTime: '19:00',
      label: 'Midweek',
      presetHint: '',
      custom: true,
    },
  ],
  weekend: [
    {
      id: 'end-1',
      weekday: 6,
      scheduleDay: 'SATURDAY',
      scheduleTime: '07:00',
      label: 'Weekend',
      presetHint: '',
      custom: true,
    },
  ],
}

test('buildSettingsRow maps every store field into the row document', () => {
  const row = buildSettingsRow(input)
  assert.deepEqual(row, {
    serviceTypes: input.serviceTypes,
    dutyRoles: input.dutyRoles,
    voices: input.voices,
    localeName: 'Sta. Monica',
    defaultServiceTypeId: 'svc-1',
    midweek: input.midweek,
    weekend: input.weekend,
  })
})

test('buildSettingsRow keeps a null default service type', () => {
  const row = buildSettingsRow({ ...input, defaultServiceTypeId: null })
  assert.equal(row.defaultServiceTypeId, null)
})

test('buildSettingsRow does not mutate its input', () => {
  const snapshot = structuredClone(input)
  buildSettingsRow(input)
  assert.deepEqual(input, snapshot)
})
