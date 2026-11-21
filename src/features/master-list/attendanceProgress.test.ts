import test from 'node:test'
import assert from 'node:assert/strict'
import type { Member } from '@/core/types/member'
import type { AttendanceSheet } from '@/store/attendanceStore'
import {
  attendancePersonKey,
  computeSheetProgress,
  countAttendanceChanges,
  defaultFocusDate,
  percentOf,
  sheetRoster,
} from './attendanceProgress.ts'

function member(id: string, voicePosition: string = 'soprano'): Member {
  return {
    id,
    firstName: 'Test',
    lastName: id,
    gender: 'female',
    voicePosition,
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01T00:00:00+08:00',
    positions: [],
  }
}

function sheet(overrides: Partial<AttendanceSheet> = {}): AttendanceSheet {
  return {
    id: 'sheet-1',
    choir: 'aws',
    title: 'Sunday Service',
    dates: ['2026-11-09', '2026-11-16'],
    groupByVoice: false,
    voiceIds: [],
    includeNagsasanayMen: false,
    includeNagsasanayWomen: false,
    separateChoirs: false,
    lastNameFirst: true,
    docFormat: {} as AttendanceSheet['docFormat'],
    pangulongName: '',
    present: {},
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    createdBy: 'Admin',
    ...overrides,
  }
}

const roster = [member('a'), member('b', 'alto')]

test('an untouched sheet is not started', () => {
  const progress = computeSheetProgress(sheet(), roster)
  assert.equal(progress.marked, 0)
  assert.equal(progress.total, 4)
  assert.equal(progress.percent, 0)
  assert.equal(progress.state, 'not-started')
})

test('a partly marked sheet needs marking and reports its real ratio', () => {
  const progress = computeSheetProgress(
    sheet({
      present: {
        [attendancePersonKey('a')]: ['2026-11-09', '2026-11-16'],
        [attendancePersonKey('b')]: ['2026-11-09'],
      },
    }),
    roster,
  )
  assert.equal(progress.marked, 3)
  assert.equal(progress.percent, 75)
  assert.equal(progress.state, 'in-progress')
  assert.deepEqual(progress.dateCounts, {
    '2026-11-09': 2,
    '2026-11-16': 1,
  })
})

test('a fully marked sheet is complete even when never exported', () => {
  const progress = computeSheetProgress(
    sheet({
      present: {
        [attendancePersonKey('a')]: ['2026-11-09', '2026-11-16'],
        [attendancePersonKey('b')]: ['2026-11-09', '2026-11-16'],
      },
    }),
    roster,
  )
  assert.equal(progress.percent, 100)
  assert.equal(progress.state, 'complete')
})

test('voice grouping narrows the roster a sheet asks about', () => {
  const grouped = sheet({ groupByVoice: true, voiceIds: ['soprano'] })
  assert.deepEqual(
    sheetRoster(grouped, roster).map((entry) => entry.id),
    ['a'],
  )
  const progress = computeSheetProgress(
    {
      ...grouped,
      present: { [attendancePersonKey('a')]: ['2026-11-09'] },
    },
    roster,
  )
  assert.equal(progress.total, 2)
  assert.equal(progress.state, 'in-progress')
})

test('the focus date is the latest date with marks, else the last date', () => {
  const marked = sheet({
    present: { [attendancePersonKey('a')]: ['2026-11-09'] },
  })
  assert.equal(defaultFocusDate(marked, roster), '2026-11-09')
  assert.equal(defaultFocusDate(sheet(), roster), '2026-11-16')
})

test('change counting sees added and removed marks per member', () => {
  const before = { 'member:a': ['2026-11-09'] }
  const after = { 'member:a': ['2026-11-16'], 'member:b': ['2026-11-16'] }
  assert.equal(countAttendanceChanges(after, before), 3)
  assert.equal(countAttendanceChanges(before, before), 0)
  assert.equal(countAttendanceChanges({}, before), 1)
})

test('percentOf avoids dividing by an empty roster', () => {
  assert.equal(percentOf(0, 0), 0)
  assert.equal(percentOf(1, 3), 33)
})
