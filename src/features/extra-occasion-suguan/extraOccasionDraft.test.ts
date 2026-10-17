import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  emptyOccasionState,
  occasionDate,
  occasionSuguanInput,
  removeMemberFromOccasion,
  validateOccasion,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'

function occasion(): ExtraOccasionOccasionState {
  return emptyOccasionState([], [], 'Locale')
}

test('a new occasion defaults to Mixed Choir', () => {
  assert.equal(occasion().draft.group, 'mixed')
})

test('occasionDate prefers the Pagsasanay date, then Pagtupad, then blank', () => {
  const state = occasion()
  state.pagsasanay = { enabled: true, label: 'Pagsasanay', date: '2026-01-04' }
  state.pagtupad = { enabled: true, label: 'Pagtupad', date: '2026-01-04' }
  assert.equal(occasionDate(state), '2026-01-04')

  state.pagsasanay = { ...state.pagsasanay, enabled: false }
  assert.equal(occasionDate(state), '2026-01-04')

  state.pagtupad = { ...state.pagtupad, enabled: false }
  assert.equal(occasionDate(state), '')
})

test('occasionSuguanInput carries the enabled column dates only', () => {
  const state = occasion()
  state.draft.serviceTypeId = 'svc-1'
  state.pagsasanay = { enabled: true, label: 'Pagsasanay', date: '2026-02-01' }
  state.pagtupad = { enabled: false, label: 'Pagtupad', date: '2026-02-08' }
  const input = occasionSuguanInput(state)
  assert.equal(input.pagsasanayDate, '2026-02-01')
  assert.equal(input.pagtupadDate, '')
  assert.equal(input.date, '2026-02-01')
})

test('removeMemberFromOccasion strips the member from every roster', () => {
  const state = occasion()
  state.draft.schedules = [
    {
      id: 's1',
      scheduleLabel: 'Pagsamba',
      scheduleDay: '',
      scheduleTime: '',
      assignments: [
        { memberId: 'm1', memberName: 'A', voicePosition: 'soprano', assignedAt: '' },
        { memberId: 'm2', memberName: 'B', voicePosition: 'alto', assignedAt: '' },
      ],
    },
  ]
  state.draft.assignments = [...state.draft.schedules[0].assignments]
  state.organistaAssignments = {
    s1: [{ memberId: 'm1', role: 'organista' }],
  }
  const next = removeMemberFromOccasion(state, 'm1')
  assert.deepEqual(
    next.draft.schedules[0].assignments.map((a) => a.memberId),
    ['m2'],
  )
  assert.deepEqual(next.draft.assignments.map((a) => a.memberId), ['m2'])
  assert.deepEqual(next.organistaAssignments.s1, [])
})

test('validateOccasion requires a service type and valid enabled dates', () => {
  const state = occasion()
  assert.match(validateOccasion(state) ?? '', /service type/i)

  state.draft.serviceTypeId = 'svc-1'
  state.pagsasanay = { enabled: true, label: 'Pagsasanay', date: '' }
  assert.match(validateOccasion(state) ?? '', /Pagsasanay/i)

  state.pagsasanay = { enabled: true, label: 'Pagsasanay', date: '2026-01-04' }
  state.pagtupad = { enabled: false, label: 'Pagtupad', date: '' }
  assert.match(validateOccasion(state) ?? '', /Destinado/i)

  state.draft.destinadoName = 'Juan Dela Cruz'
  assert.equal(validateOccasion(state), null)
})
