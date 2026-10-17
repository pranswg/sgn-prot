import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  appendStraightDecisions,
  comparisonRefs,
  conflictingMemberIds,
  detectMemberConflicts,
  isOccasionDone,
  isTimeConflict,
  occasionRefFromInput,
  occasionRefFromState,
  pendingConflictsForAdded,
  timeToMinutes,
  TIME_CONFLICT_THRESHOLD_MIN,
  type MemberConflict,
  type OccasionRef,
} from './extraOccasionConflicts'
import { createPlannerOccasion, type PlannerOccasion } from './extraOccasionSession'
import { emptyOccasionState } from './extraOccasionDraft'
import type { ExtraOccasionOccasionState } from './extraOccasionDraft'
import type { Suguan } from '@/core/types/suguan'

function ref(overrides: Partial<OccasionRef> = {}): OccasionRef {
  return {
    key: 'a',
    savedId: null,
    name: 'A',
    dates: ['2026-01-04'],
    time: '19:00',
    memberIds: [],
    ...overrides,
  }
}

/** A saved Extra Occasion record with one enabled Pagsasanay column. */
function savedOccasion(id: string, date: string, time = '19:00'): Suguan {
  return {
    id,
    date,
    time,
    assignments: [],
    schedules: [],
    extraOccasion: {
      name: id,
      pagsasanay: { enabled: true, label: 'Pagsasanay', date },
      pagtupad: { enabled: false, label: 'Pagtupad', date: '' },
      organistaAssignments: {},
    },
  } as unknown as Suguan
}

test('timeToMinutes parses HH:mm and rejects junk', () => {
  assert.equal(timeToMinutes('09:30'), 570)
  assert.equal(timeToMinutes('19:00'), 1140)
  assert.equal(timeToMinutes(''), null)
  assert.equal(timeToMinutes('not-a-time'), null)
  assert.equal(timeToMinutes('25:00'), null)
})

test('isTimeConflict is inclusive of the threshold and false for unparseable', () => {
  assert.equal(isTimeConflict('19:00', '20:30'), true)
  assert.equal(isTimeConflict('19:00', '20:31'), false)
  assert.equal(isTimeConflict('19:00', '19:00'), true)
  assert.equal(isTimeConflict('', '19:00'), false)
  assert.equal(TIME_CONFLICT_THRESHOLD_MIN, 90)
})

test('shared date + close times is a time-overlap', () => {
  const target = ref({ key: 't', memberIds: ['m1'], time: '19:00' })
  const other = ref({ key: 'o', memberIds: ['m1'], time: '20:00', dates: ['2026-01-04'] })
  const conflicts = detectMemberConflicts(target, [other])
  assert.equal(conflicts.get('m1')?.[0]?.kind, 'time-overlap')
  assert.deepEqual(conflicts.get('m1')?.[0]?.dates, ['2026-01-04'])
})

test('shared date + far times is only same-day', () => {
  const target = ref({ key: 't', memberIds: ['m1'], time: '07:00' })
  const other = ref({ key: 'o', memberIds: ['m1'], time: '19:00' })
  const conflicts = detectMemberConflicts(target, [other])
  assert.equal(conflicts.get('m1')?.[0]?.kind, 'same-day')
})

test('different authoritative dates produce no conflict', () => {
  const target = ref({ key: 't', memberIds: ['m1'], dates: ['2026-01-04'] })
  const other = ref({ key: 'o', memberIds: ['m1'], dates: ['2026-01-11'], time: '19:00' })
  assert.equal(detectMemberConflicts(target, [other]).size, 0)
})

test('two draft occasions with no dates yet conflict as unknown-date', () => {
  const target = ref({ key: 't', memberIds: ['m1'], dates: [], time: '' })
  const other = ref({ key: 'o', memberIds: ['m1'], dates: [], time: '' })
  const conflicts = detectMemberConflicts(target, [other])
  assert.equal(conflicts.get('m1')?.[0]?.kind, 'unknown-date')
  assert.deepEqual(conflicts.get('m1')?.[0]?.dates, [])
})

test('a dated occasion and an undated one conflict as unknown-date', () => {
  const target = ref({ key: 't', memberIds: ['m1'], dates: ['2026-01-04'] })
  const other = ref({ key: 'o', memberIds: ['m1'], dates: [], time: '19:00' })
  assert.equal(
    detectMemberConflicts(target, [other]).get('m1')?.[0]?.kind,
    'unknown-date',
  )
})

test('undated occasions that share no member still report nothing', () => {
  const target = ref({ key: 't', memberIds: ['m1'], dates: [] })
  const other = ref({ key: 'o', memberIds: ['m2'], dates: [] })
  assert.equal(detectMemberConflicts(target, [other]).size, 0)
})

test('only shared members are reported', () => {
  const target = ref({ key: 't', memberIds: ['m1'] })
  const other = ref({ key: 'o', memberIds: ['m2'] })
  assert.equal(detectMemberConflicts(target, [other]).size, 0)
})

test('the target never conflicts with itself', () => {
  const target = ref({ key: 't', memberIds: ['m1'] })
  assert.equal(detectMemberConflicts(target, [{ ...target }]).size, 0)
})

test('a member conflicting with two occasions reports both', () => {
  const target = ref({ key: 't', memberIds: ['m1'] })
  const a = ref({ key: 'o1', memberIds: ['m1'], time: '19:30' })
  const b = ref({ key: 'o2', memberIds: ['m1'], time: '19:45' })
  const conflicts = detectMemberConflicts(target, [a, b])
  assert.equal(conflicts.get('m1')?.length, 2)
})

function stateWithMember(memberId: string, time: string, date: string): ExtraOccasionOccasionState {
  const state = emptyOccasionState([], [], '')
  state.draft.time = time
  state.pagsasanay = { enabled: true, label: 'Pagsasanay', date }
  state.draft.schedules = [
    {
      id: 'sec',
      scheduleLabel: 'Pagsamba',
      scheduleDay: '',
      scheduleTime: '',
      assignments: [
        {
          memberId,
          memberName: 'Test Member',
          voicePosition: 'soprano',
          assignedAt: '',
        },
      ],
    },
  ]
  return state
}

test('occasionRefFromState collects enabled column dates and members', () => {
  const occasion = createPlannerOccasion(stateWithMember('m1', '19:00', '2026-01-04'))
  const built = occasionRefFromState(occasion, 'Occasion')
  assert.deepEqual(built.dates, ['2026-01-04'])
  assert.deepEqual(built.memberIds, ['m1'])
  assert.equal(built.key, occasion.localId)
})

test('comparisonRefs excludes the target and its own saved record', () => {
  const targetState = stateWithMember('m1', '19:00', '2026-01-04')
  const target: PlannerOccasion = {
    ...createPlannerOccasion(targetState, 'saved-target'),
  }
  const sibling = createPlannerOccasion(stateWithMember('m2', '19:00', '2026-01-04'))
  const savedOther = savedOccasion('saved-other', '2026-01-04')
  const refs = comparisonRefs(
    occasionRefFromState(target, 'Target'),
    [target, sibling],
    [savedOther],
    // Pin the clock: a fixed 2026 date is in the past for the real clock, and
    // a finished occasion is deliberately dropped.
    new Date('2026-01-01T09:00:00+08:00'),
  )
  const keys = refs.map((r) => r.key)
  assert.ok(keys.includes(sibling.localId))
  assert.ok(keys.includes('saved-other'))
  assert.ok(!keys.includes('saved-target'))
})

test('comparisonRefs drops an occasion that has already been fulfilled', () => {
  const target = occasionRefFromState(
    createPlannerOccasion(stateWithMember('m1', '19:00', '2026-10-30')),
    'Target',
  )
  const past = savedOccasion('past', '2026-10-29')
  const future = savedOccasion('future', '2026-10-30')
  const refs = comparisonRefs(target, [], [past, future], new Date('2026-10-30T09:00:00+08:00'))
  assert.deepEqual(
    refs.map((r) => r.key),
    ['future'],
  )
})

test('isOccasionDone uses the last column date and the time of day', () => {
  const evening = new Date('2026-10-30T15:30:00+08:00')
  assert.equal(
    isOccasionDone(ref({ dates: ['2026-10-30'], time: '15:00' }), evening),
    true,
  )
  assert.equal(
    isOccasionDone(
      ref({ dates: ['2026-10-30'], time: '15:00' }),
      new Date('2026-10-30T14:59:00+08:00'),
    ),
    false,
  )
  assert.equal(
    isOccasionDone(ref({ dates: ['2026-10-29'], time: '15:00' }), evening),
    true,
  )
  assert.equal(
    isOccasionDone(ref({ dates: ['2026-10-31'], time: '15:00' }), evening),
    false,
  )
  // No time: the occasion lasts the whole day.
  assert.equal(
    isOccasionDone(
      ref({ dates: ['2026-10-30'], time: '' }),
      new Date('2026-10-30T23:00:00+08:00'),
    ),
    false,
  )
  // No usable date: it cannot be ruled out, so it is never "done".
  assert.equal(isOccasionDone(ref({ dates: [], time: '15:00' }), evening), false)
})

test('isOccasionDone waits for the LATER of the two column dates', () => {
  const once = new Date('2026-10-30T16:30:00+08:00')
  assert.equal(
    isOccasionDone(ref({ dates: ['2026-10-30', '2026-10-31'], time: '15:00' }), once),
    false,
  )
  assert.equal(
    isOccasionDone(ref({ dates: ['2026-10-29', '2026-10-30'], time: '15:00' }), once),
    true,
  )
})

test('conflictingMemberIds covers members not added to the target yet', () => {
  const target = ref({ key: 't', memberIds: [], dates: ['2026-10-30'] })
  const other = ref({ key: 'o', memberIds: ['m1'], dates: ['2026-10-30'] })
  assert.deepEqual([...conflictingMemberIds(target, [other])], ['m1'])
})

test('conflictingMemberIds ignores a different date and the target itself', () => {
  const target = ref({ key: 't', dates: ['2026-10-30'], memberIds: ['m1'] })
  const otherDay = ref({ key: 'o', dates: ['2026-11-05'], memberIds: ['m2'] })
  const self = { ...target }
  assert.equal(conflictingMemberIds(target, [otherDay, self]).size, 0)
})

test('conflictingMemberIds warns on two undated occasions', () => {
  const target = ref({ key: 't', dates: [], memberIds: [] })
  const other = ref({ key: 'o', dates: [], memberIds: ['m1'] })
  assert.deepEqual([...conflictingMemberIds(target, [other])], ['m1'])
})

test('pendingConflictsForAdded queues each added member and skips decided pairs', () => {
  const target = ref({ key: 't', memberIds: [], dates: ['2026-10-30'], time: '19:00' })
  const other = ref({
    key: 'o',
    savedId: 'other-id',
    memberIds: ['m1', 'm2'],
    dates: ['2026-10-30'],
    time: '19:30',
  })
  const queued = pendingConflictsForAdded({
    targetKey: 'local',
    addedIds: ['m1', 'm2'],
    targetRef: target,
    others: [other],
    decisions: [],
  })
  assert.deepEqual(
    queued.map((item) => item.memberId),
    ['m1', 'm2'],
  )
  assert.equal(queued[0].targetKey, 'local')
  assert.equal(queued[0].conflicts[0].kind, 'time-overlap')

  const decided = pendingConflictsForAdded({
    targetKey: 'local',
    addedIds: ['m1', 'm2'],
    targetRef: target,
    others: [other],
    decisions: [
      { memberId: 'm1', otherSuguanId: 'other-id', otherLabel: 'O', at: '' },
    ],
  })
  assert.deepEqual(
    decided.map((item) => item.memberId),
    ['m2'],
  )
})

test('appendStraightDecisions stores one decision per other occasion', () => {
  const other = ref({ key: 'o', savedId: 'other-id', name: 'Other' })
  const conflicts: MemberConflict[] = [
    { memberId: 'm1', other, kind: 'same-day', dates: ['2026-10-30'] },
  ]
  const at = '2026-10-30T09:00:00+08:00'
  const first = appendStraightDecisions([], 'm1', conflicts, at)
  assert.deepEqual(first, [
    { memberId: 'm1', otherSuguanId: 'other-id', otherLabel: 'Other', at },
  ])
  assert.equal(appendStraightDecisions(first, 'm1', conflicts, 'later').length, 1)
})

test('occasionRefFromInput builds a ref from a live single occasion', () => {
  const built = occasionRefFromInput(stateWithMember('m1', '19:00', '2026-10-30'), {
    key: 'key',
    savedId: 'saved',
    label: 'Kasal',
  })
  assert.equal(built.key, 'key')
  assert.equal(built.savedId, 'saved')
  assert.equal(built.name, 'Kasal')
  assert.deepEqual(built.dates, ['2026-10-30'])
  assert.deepEqual(built.memberIds, ['m1'])
})
