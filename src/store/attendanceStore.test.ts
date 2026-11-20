import assert from 'node:assert/strict'
import test from 'node:test'
import { useAttendanceStore } from './attendanceStore.ts'
import { DEFAULT_DOC_FORMAT } from '@/lib/suguanUtils.ts'

const baseInput = {
  choir: 'aws' as const,
  title: 'Sunday Service Attendance',
  dates: ['2026-11-09', '2026-11-16'],
  groupByVoice: true,
  selectedVoiceIds: ['soprano', 'alto'],
  includeNagsasanayMen: false,
  includeNagsasanayWomen: false,
  separateChoirs: false,
  lastNameFirst: false,
  docFormat: DEFAULT_DOC_FORMAT,
  pangulongName: 'Dela Cruz, Juan',
}

test('Attendance createSheet validates and sorts dates newest-first logic', () => {
  useAttendanceStore.getState().clear()

  const created = useAttendanceStore.getState().createSheet(baseInput)
  assert.ok(created, 'createSheet should return a sheet')
  assert.equal(useAttendanceStore.getState().sheets.length, 1)
  assert.equal(created.dates[0], '2026-11-09')
  assert.equal(created.dates[1], '2026-11-16')
  assert.equal(Object.keys(created.present).length, 0)
  assert.equal(created.lastExportedAt, undefined)

  const blank = useAttendanceStore.getState().createSheet({
    ...baseInput,
    title: '',
  })
  assert.equal(blank, null)
  assert.equal(useAttendanceStore.getState().sheets.length, 1)

  const noDates = useAttendanceStore.getState().createSheet({
    ...baseInput,
    dates: [],
  })
  assert.equal(noDates, null)
  assert.equal(useAttendanceStore.getState().sheets.length, 1)

  useAttendanceStore.getState().clear()
  assert.equal(useAttendanceStore.getState().sheets.length, 0)
})

test('setPresent toggles a member on a date', () => {
  useAttendanceStore.getState().clear()
  const sheet = useAttendanceStore.getState().createSheet(baseInput)
  assert.ok(sheet)

  const store = useAttendanceStore.getState()
  store.setPresent(sheet.id, 'member:m-1', '2026-11-09', true)
  store.setPresent(sheet.id, 'member:m-1', '2026-11-16', true)
  store.setPresent(sheet.id, 'member:m-2', '2026-11-09', true)

  const updated = store.getSheet(sheet.id)
  assert.deepEqual(updated?.present['member:m-1'], ['2026-11-09', '2026-11-16'])
  assert.deepEqual(updated?.present['member:m-2'], ['2026-11-09'])

  store.setPresent(sheet.id, 'member:m-1', '2026-11-09', false)
  const again = store.getSheet(sheet.id)
  assert.deepEqual(again?.present['member:m-1'], ['2026-11-16'])

  useAttendanceStore.getState().clear()
})

test('updatePresent replaces the whole present map', () => {
  useAttendanceStore.getState().clear()
  const sheet = useAttendanceStore.getState().createSheet(baseInput)
  assert.ok(sheet)

  useAttendanceStore.getState().updatePresent(sheet.id, {
    'member:m-1': ['2026-11-09'],
  })
  const replaced = useAttendanceStore.getState().getSheet(sheet.id)
  assert.deepEqual(replaced?.present, { 'member:m-1': ['2026-11-09'] })

  useAttendanceStore.getState().clear()
})

test('markExported stamps the sheet', () => {
  useAttendanceStore.getState().clear()
  const sheet = useAttendanceStore.getState().createSheet(baseInput)
  assert.ok(sheet)
  assert.equal(sheet.lastExportedAt, undefined)

  useAttendanceStore.getState().markExported(sheet.id)
  const exported = useAttendanceStore.getState().getSheet(sheet.id)
  assert.ok(exported?.lastExportedAt)

  useAttendanceStore.getState().clear()
})

test('deleteSheet removes the sheet', () => {
  useAttendanceStore.getState().clear()
  const sheet = useAttendanceStore.getState().createSheet(baseInput)
  assert.ok(sheet)

  useAttendanceStore.getState().deleteSheet(sheet.id)
  assert.equal(useAttendanceStore.getState().getSheet(sheet.id), undefined)
  assert.equal(useAttendanceStore.getState().sheets.length, 0)

  useAttendanceStore.getState().clear()
})

test('importData, restoreData and clear replace the list', () => {
  useAttendanceStore.getState().clear()
  const sheet = useAttendanceStore.getState().createSheet(baseInput)
  assert.ok(sheet)

  useAttendanceStore.getState().importData([])
  assert.equal(useAttendanceStore.getState().sheets.length, 0)

  useAttendanceStore.getState().restoreData([sheet])
  assert.equal(useAttendanceStore.getState().sheets.length, 1)

  useAttendanceStore.getState().clear()
  assert.equal(useAttendanceStore.getState().sheets.length, 0)
})
