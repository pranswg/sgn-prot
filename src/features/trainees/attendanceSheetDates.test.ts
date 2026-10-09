import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAttendanceDatePanels,
  generatePracticeDates,
} from './attendanceSheetDates'

test('generates selected practice weekdays inclusively across the date range', () => {
  assert.deepEqual(
    generatePracticeDates('2026-10-10', '2026-11-14', [6]),
    [
      '2026-10-10',
      '2026-10-17',
      '2026-10-24',
      '2026-10-31',
      '2026-11-07',
      '2026-11-14',
    ],
  )
})

test('supports multiple days and a single-day range', () => {
  assert.deepEqual(
    generatePracticeDates('2026-10-10', '2026-10-12', [6, 0, 1]),
    ['2026-10-10', '2026-10-11', '2026-10-12'],
  )
  assert.deepEqual(generatePracticeDates('2026-10-10', '2026-10-10', [6]), [
    '2026-10-10',
  ])
})

test('returns no dates for invalid ranges or an empty weekday selection', () => {
  assert.deepEqual(generatePracticeDates('2026-11-14', '2026-10-10', [6]), [])
  assert.deepEqual(generatePracticeDates('2026-10-10', '2026-11-14', []), [])
  assert.deepEqual(generatePracticeDates('2026-02-30', '2026-11-14', [6]), [])
})

test('attendance date columns use only selected dates, up to eight per panel', () => {
  const dates = [
    '2026-10-10',
    '2026-10-17',
    '2026-10-24',
  ]
  assert.deepEqual(createAttendanceDatePanels(dates), [dates])

  const nineDates = Array.from({ length: 9 }, (_, index) => `date-${index + 1}`)
  assert.deepEqual(createAttendanceDatePanels(nineDates), [
    nineDates.slice(0, 8),
    nineDates.slice(8),
  ])
  assert.deepEqual(createAttendanceDatePanels([]), [])
})
