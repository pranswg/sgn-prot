import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Suguan } from '@/core/types/suguan'
import { membersBookedAtSameInstant } from './doubleBooking'

function record(overrides: Partial<Suguan> = {}): Suguan {
  return {
    id: 'id',
    date: '2026-10-30',
    time: '19:00',
    serviceTypeId: 'service',
    group: 'mixed',
    events: [],
    schedules: [],
    voiceCapacities: {},
    assignments: [
      {
        memberId: 'm1',
        memberName: 'Ana Bautista',
        voicePosition: 'soprano',
        assignedAt: '',
      },
    ],
    dutyRoles: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

/** An Extra Occasion record, cast because the config's other fields are unused here. */
function occasion(overrides: Partial<Suguan> = {}): Suguan {
  return {
    ...record({ id: 'occasion' }),
    extraOccasion: {
      name: 'Kasal',
      pagsasanay: { enabled: true, label: 'Pagsasanay', date: '2026-10-30' },
      pagtupad: { enabled: false, label: 'Pagtupad', date: '' },
    },
    ...overrides,
  } as unknown as Suguan
}

test('membersBookedAtSameInstant collects the members of that instant', () => {
  const ids = membersBookedAtSameInstant([record()], {
    date: '2026-10-30',
    time: '19:00',
  })
  assert.deepEqual([...ids], ['m1'])
})

test('a different instant books nobody', () => {
  assert.equal(
    membersBookedAtSameInstant([record()], {
      date: '2026-10-30',
      time: '20:00',
    }).size,
    0,
  )
})

test('the record being edited is not a clash with itself', () => {
  assert.equal(
    membersBookedAtSameInstant([record()], {
      date: '2026-10-30',
      time: '19:00',
      editingId: 'id',
    }).size,
    0,
  )
})

test('an Extra Occasion never blocks a Choir Suguan', () => {
  assert.equal(
    membersBookedAtSameInstant([occasion()], {
      date: '2026-10-30',
      time: '19:00',
    }).size,
    0,
  )
})

test('a blank date matches nothing rather than every other blank date', () => {
  assert.equal(
    membersBookedAtSameInstant([record({ date: '' })], { date: '', time: '' })
      .size,
    0,
  )
})
