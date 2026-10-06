import assert from 'node:assert/strict'
import test from 'node:test'

import type {
  Suguan,
  SuguanAssignment,
  VoicePosition,
} from '@/core/types/suguan'
import { createCopyDraft } from './builderState.ts'

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

test('copy snapshots the source, so editing a copy never mutates the saved Suguan', () => {
  const copy = createCopyDraft(source, voices)

  copy.schedules[0].assignments[0].memberName = 'Changed'
  copy.dutyRoles[0].memberId = 'changed'
  copy.coverage!.template = 'one-week'

  assert.equal(source.schedules[0].assignments[0].memberName, 'Test Member')
  assert.equal(source.dutyRoles[0].memberId, 'm1')
  assert.equal(source.coverage?.template, 'midweek-2w')
})