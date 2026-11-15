/**
 * The Settings editor commits each worship-schedule change through these
 * actions instead of holding a draft, so the test pins the two things that
 * matter: the change lands in the shared settings row (the document the server
 * stores), and the action reports the write outcome the editor waits on.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { snapshotSettingsRow } from '@/lib/settingsSync.ts'
import { useWorshipScheduleStore, type StoredWorshipSchedule } from './worshipScheduleStore.ts'

const schedule = (overrides: Partial<StoredWorshipSchedule> = {}): StoredWorshipSchedule => ({
  id: 'probe-1',
  weekday: 3,
  scheduleDay: 'MIYERKULES',
  scheduleTime: '7:00 PM',
  label: 'Probe',
  presetHint: '',
  custom: true,
  ...overrides,
})

function reset(midweek: StoredWorshipSchedule[] = [], weekend: StoredWorshipSchedule[] = []) {
  useWorshipScheduleStore.setState({ midweek, weekend })
}

test('adding a schedule puts it in the shared settings row', async () => {
  reset()
  const saved = await useWorshipScheduleStore.getState().addSchedule('midweek', {
    weekday: 3,
    scheduleTime: '7:00 PM',
    label: 'Miyerkules 7:00 PM',
  })

  // Supabase is unconfigured under node:test, so a write reports success.
  assert.equal(saved, true)
  const row = snapshotSettingsRow()
  assert.equal(row.midweek.length, 1)
  assert.equal(row.midweek[0].label, 'Miyerkules 7:00 PM')
  assert.equal(row.midweek[0].scheduleDay, 'MIYERKULES')
  assert.equal(row.weekend.length, 0)
})

test('editing a schedule updates the row without touching the other one', async () => {
  reset([schedule()], [schedule({ id: 'probe-2', weekday: 6, scheduleDay: 'SABADO' })])

  const saved = await useWorshipScheduleStore
    .getState()
    .updateSchedule('midweek', 'probe-1', { weekday: 4, scheduleTime: '8:00 PM', label: 'Moved' })

  assert.equal(saved, true)
  const row = snapshotSettingsRow()
  assert.equal(row.midweek[0].label, 'Moved')
  assert.equal(row.midweek[0].scheduleDay, 'HUWEBES')
  assert.equal(row.midweek[0].scheduleTime, '8:00 PM')
  assert.equal(row.weekend[0].id, 'probe-2')
})

test('toggling and removing a schedule keep the row in step', async () => {
  reset([schedule()])

  assert.equal(await useWorshipScheduleStore.getState().toggleSchedule('midweek', 'probe-1'), true)
  assert.equal(snapshotSettingsRow().midweek[0].disabled, true)

  assert.equal(await useWorshipScheduleStore.getState().removeSchedule('midweek', 'probe-1'), true)
  assert.deepEqual(snapshotSettingsRow().midweek, [])
})
