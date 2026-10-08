import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  Suguan,
  SuguanAssignment,
  VoicePosition,
} from '@/core/types/suguan'
import {
  DEFAULT_SCHEDULE_CATEGORIES,
  type WorshipScheduleCategories,
} from '@/core/constants/worshipSchedules'
import { createCopyDraft, weekScheduleSections } from './builderState.ts'

const customCategories: WorshipScheduleCategories = {
  midweek: [
    ...DEFAULT_SCHEDULE_CATEGORIES.midweek,
    {
      id: 'miyerkules-8pm',
      scheduleDay: 'MIYERKULES',
      weekday: 3,
      scheduleTime: '8:00 PM',
      label: 'Miyerkules, 8:00 PM',
      presetHint: '',
      custom: true,
    },
  ],
  weekend: DEFAULT_SCHEDULE_CATEGORIES.weekend,
}

const voices: VoicePosition[] = [
  { id: 'soprano', name: 'Soprano', shortName: 'S', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
]

function assignment(memberId: string, voicePosition: string): SuguanAssignment {
  return {
    memberId,
    memberName: 'Test Member',
    voicePosition,
    assignedAt: '2026-01-01T00:00:00.000Z',
  }
}

const source: Suguan = {
  id: 'sg-1',
  date: '2026-01-07',
  time: '19:00',
  serviceTypeId: 'pagsamba',
  group: 'mixed',
  docFormat: {
    paperSize: 'letter',
    orientation: 'landscape',
    margins: 'narrow',
    scaling: 'fit-width',
    fontSize: 'large',
  },
  coverage: {
    template: 'midweek-2w',
    startDate: '2026-01-07',
    pagtupadStartOverride: '2026-01-08',
    pagtupadEndOverride: '2026-01-11',
  },
  events: [{ id: 'e1', type: 'pagsasanay', date: '2026-01-07' }],
  pagsasanayDate: '2026-01-07',
  pagtupadDate: '2026-01-08',
  schedules: [
    {
      id: 's1',
      scheduleKey: 'miyerkules-7pm',
      scheduleLabel: 'Miyerkules 7PM',
      scheduleDay: 'MIYERKULES',
      scheduleTime: '7:00 PM',
      assignments: [assignment('m1', 'soprano')],
    },
    {
      id: 's2',
      scheduleKey: 'huwebes-7pm',
      scheduleLabel: 'Huwebes 7PM',
      scheduleDay: 'HUWEBES',
      scheduleTime: '7:00 PM',
      assignments: [assignment('m2', 'alto')],
    },
  ],
  voiceCapacities: { soprano: 4, alto: 3, tenor: 2 },
  assignments: [assignment('m1', 'soprano'), assignment('m2', 'alto')],
  dutyRoles: [
    { memberId: 'm1', memberName: 'Test Member', dutyRoleId: 'pangulong' },
  ],
  destinadoName: 'Km. Dennis',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
}

test('copy carries options, document format, schedules, and voice assignments', () => {
  const copy = createCopyDraft(source, voices)

  assert.equal(copy.serviceTypeId, source.serviceTypeId)
  assert.equal(copy.time, source.time)
  assert.equal(copy.group, source.group)
  assert.equal(copy.destinadoName, source.destinadoName)
  assert.deepEqual(copy.docFormat, { ...source.docFormat })

  assert.deepEqual(copy.voiceCapacities, { soprano: 4, alto: 3, tenor: 2 })
  assert.deepEqual(copy.dutyRoles, source.dutyRoles)

  assert.equal(copy.schedules.length, 2)
  assert.deepEqual(
    copy.schedules.map((s) => ({
      scheduleKey: s.scheduleKey,
      scheduleLabel: s.scheduleLabel,
      scheduleDay: s.scheduleDay,
      scheduleTime: s.scheduleTime,
      assignments: s.assignments,
    })),
    source.schedules.map((s) => ({
      scheduleKey: s.scheduleKey,
      scheduleLabel: s.scheduleLabel,
      scheduleDay: s.scheduleDay,
      scheduleTime: s.scheduleTime,
      assignments: s.assignments,
    })),
  )

  assert.deepEqual(copy.assignments, source.assignments)
})

test('copy keeps the coverage template but clears every calendar date', () => {
  const copy = createCopyDraft(source, voices)

  assert.equal(copy.coverage?.template, 'midweek-2w')
  assert.equal(copy.coverage?.startDate, '')
  assert.equal(copy.coverage?.pagtupadStartOverride, undefined)
  assert.equal(copy.coverage?.pagtupadEndOverride, undefined)
  assert.equal(copy.date, '')
  assert.equal(copy.pagsasanayDate, '')
  assert.equal(copy.pagtupadDate, '')
  assert.deepEqual(copy.events, [])
})

test('copy records the source so its picker entry can be hidden once used', () => {
  const copy = createCopyDraft(source, voices)
  assert.equal(copy.copiedFromId, source.id)
})

test('copy snapshots the source, so editing a copy never mutates the saved Suguan', () => {
  const copy = createCopyDraft(source, voices)

  copy.schedules[0].assignments[0].memberName = 'Changed'
  copy.dutyRoles[0].memberId = 'changed'
  copy.coverage!.template = 'one-week'

  assert.equal(source.schedules[0].assignments[0].memberName, 'Test Member')
  assert.equal(source.dutyRoles[0].memberId, 'm1')
  assert.equal(source.coverage?.template, 'midweek-2w')
})

test('weekScheduleSections builds the whole detected week and keeps assignments by key', () => {
  const sections = weekScheduleSections(
    {
      template: 'one-week',
      startDate: '2026-09-26',
      oneWeekPagsasanayDate: '2026-09-26',
    },
    [
      {
        id: 'old-miyerkules',
        scheduleKey: 'miyerkules-7pm',
        scheduleLabel: 'Miyerkules',
        scheduleDay: 'MIYERKULES',
        scheduleTime: '7:00 PM',
        assignments: [assignment('m1', 'soprano')],
      },
    ],
  )

  assert.equal(sections.length, 6)
  const wed = sections.find((s) => s.scheduleKey === 'miyerkules-7pm')
  const sunAm = sections.find(
    (s) => s.scheduleKey === 'linggo-6am' && s.scheduleDate === '2026-09-27',
  )
  assert.equal(wed?.scheduleDate, '2026-09-23')
  // The midweek slot survived the date change, carrying its roster and id.
  assert.equal(wed?.id, 'old-miyerkules')
  assert.deepEqual(wed?.assignments, [assignment('m1', 'soprano')])
  // Slots the previous sections did not have start fresh and dated.
  assert.notEqual(sunAm?.id, 'old-miyerkules')
  assert.deepEqual(sunAm?.assignments, [])
})

test('weekScheduleSections honours a custom worship time added in Settings', () => {
  const sections = weekScheduleSections(
    {
      template: 'one-week',
      startDate: '2026-09-26',
      oneWeekPagsasanayDate: '2026-09-26',
    },
    [],
    customCategories,
  )
  assert.equal(sections.length, 7)
  const custom = sections.find((s) => s.scheduleKey === 'miyerkules-8pm')
  assert.equal(custom?.scheduleDate, '2026-09-23')
  assert.equal(custom?.scheduleTime, '8:00 PM')
})

test('weekScheduleSections returns nothing until a training date exists', () => {
  assert.deepEqual(
    weekScheduleSections({ template: 'one-week', startDate: '' }, []),
    [],
  )
  assert.deepEqual(
    weekScheduleSections(
      { template: 'one-week', startDate: '', oneWeekDate: 'garbage' },
      [],
    ),
    [],
  )
})

test('weekScheduleSections ignores non-one-week coverage', () => {
  assert.deepEqual(
    weekScheduleSections(
      { template: 'midweek-2w', startDate: '2026-09-26' },
      [],
    ),
    [],
  )
})