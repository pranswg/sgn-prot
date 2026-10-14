import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  detectMemberConflicts,
  isTimeConflict,
  timeToMinutes,
  TIME_CONFLICT_THRESHOLD_MIN,
  comparisonRefs,
  occasionRefFromState,
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
  const savedOther = {
    id: 'saved-other',
    assignments: [],
    schedules: [],
    time: '19:00',
    extraOccasion: {
      name: 'Other',
      pagsasanay: { enabled: true, date: '2026-01-04' },
      pagtupad: { enabled: false, date: '' },
      organistaAssignments: {},
    },
  } as unknown as Suguan
  const refs = comparisonRefs(target, [target, sibling], [savedOther])
  const keys = refs.map((r) => r.key)
  assert.ok(keys.includes(sibling.localId))
  assert.ok(keys.includes('saved-other'))
  assert.ok(!keys.includes('saved-target'))
})
