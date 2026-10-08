/**
 * Pure logic tests for the Members History feature.
 *
 * The lifecycle status, period count, and duplicate matching below are what
 * the whole feature builds on, so they get pinned here rather than leaving the
 * behaviour implicit in the React layers.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  belongsInMasterList,
  belongsInMemberHistory,
  findPossibleDuplicateMembers,
  lastLifecycleEvent,
  memberHistoryYears,
  memberIsReturned,
  memberLastActiveDateKey,
  memberLifecycleStatus,
  memberMembershipPeriods,
  memberMembershipSummary,
  transferReasonLabel,
} from './memberHistory.ts'
import type { Member, MemberHistoryEvent } from '@/core/types/member.ts'

const event = (
  type: MemberHistoryEvent['type'],
  date: string,
  overrides: Partial<MemberHistoryEvent> = {},
): MemberHistoryEvent => ({
  id: `${type}-${date}`,
  type,
  date,
  createdAt: `${date}T00:00:00+08:00`,
  ...overrides,
})

const member = (
  overrides: Partial<Member> = {},
): Member => ({
  id: 'm1',
  firstName: 'Maria',
  middleName: 'Santos',
  lastName: 'Dela Cruz',
  gender: 'female',
  voicePosition: 'soprano-1',
  membershipType: 'regular',
  isActive: true,
  dateAdded: '2024-01-05',
  positions: [],
  ...overrides,
})

test('a member with no events is active when isActive, inactive otherwise', () => {
  assert.equal(memberLifecycleStatus(member()), 'active')
  assert.equal(memberLifecycleStatus(member({ isActive: false })), 'inactive')
})

test('the newest event decides the lifecycle status', () => {
  const joinedThenLeft = member({
    isActive: false,
    history: [
      event('joined', '2024-01-05'),
      event('transferred-out', '2025-03-10'),
    ],
  })
  assert.equal(memberLifecycleStatus(joinedThenLeft), 'transferred-out')

  const backAgain = member({
    isActive: true,
    history: [
      event('joined', '2024-01-05'),
      event('transferred-out', '2025-03-10'),
      event('returned', '2026-01-20'),
    ],
  })
  assert.equal(memberLifecycleStatus(backAgain), 'returned')
})

test('joined-only members count as active even when events exist', () => {
  const joinedOnly = member({
    history: [
      event('joined', '2024-01-05', {
        voicePosition: 'soprano-2',
      }),
    ],
  })
  assert.equal(memberLifecycleStatus(joinedOnly), 'active')
})

test('a plain deactivation never reads as active or returned', () => {
  // The deactivate toggle flips isActive without appending an event, so the
  // joined/returned event left as "newest" must not override the flag.
  const deactivatedJoined = member({
    isActive: false,
    history: [event('joined', '2024-01-05')],
  })
  assert.equal(memberLifecycleStatus(deactivatedJoined), 'inactive')

  const deactivatedReturned = member({
    isActive: false,
    history: [
      event('joined', '2024-01-05'),
      event('transferred-out', '2025-03-10'),
      event('returned', '2026-01-20'),
    ],
  })
  assert.equal(memberLifecycleStatus(deactivatedReturned), 'inactive')
})

test('only a current transfer removes a member from the Master List', () => {
  const transferred = member({
    isActive: false,
    history: [
      event('joined', '2024-01-05'),
      event('transferred-out', '2025-03-10'),
    ],
  })
  const plainInactive = member({
    isActive: false,
    history: [event('joined', '2024-01-05')],
  })
  const returned = member({
    isActive: true,
    history: [
      event('joined', '2024-01-05'),
      event('transferred-out', '2025-03-10'),
      event('returned', '2026-01-20'),
    ],
  })

  assert.equal(belongsInMasterList(transferred), false)
  assert.equal(belongsInMasterList(plainInactive), true)
  assert.equal(belongsInMasterList(returned), true)
  assert.equal(belongsInMasterList(member()), true)
})

test('membership periods count joined plus returned, not transfers', () => {
  const threeStints = member({
    history: [
      event('joined', '2018-01-05'),
      event('transferred-out', '2019-03-10'),
      event('returned', '2020-01-20'),
      event('transferred-out', '2022-06-01'),
      event('returned', '2024-01-20'),
    ],
  })
  assert.equal(memberMembershipPeriods(threeStints), 3)
  assert.equal(memberMembershipPeriods(member()), 0)
})

test('last active date is the newest event date, falling back to dateAdded', () => {
  const moved = member({
    isActive: true,
    history: [
      event('joined', '2024-01-05'),
      event('transferred-out', '2025-03-10'),
      event('returned', '2026-01-20'),
    ],
  })
  assert.equal(memberLastActiveDateKey(moved), '2026-01-20')
  assert.equal(memberLastActiveDateKey(member()), '2024-01-05')
  assert.equal(
    memberLastActiveDateKey(member({ dateAdded: '' })),
    '',
  )
})

test('returned detection and history membership', () => {
  const returned = member({
    history: [
      event('joined', '2024-01-05'),
      event('transferred-out', '2025-03-10'),
      event('returned', '2026-01-20'),
    ],
  })
  const active = member()
  const legacyInactive = member({ isActive: false })

  assert.equal(memberIsReturned(returned), true)
  assert.equal(memberIsReturned(active), false)
  assert.equal(belongsInMemberHistory(returned), true)
  assert.equal(belongsInMemberHistory(active), false)
  // A legacy deactivated record predates events, so it still belongs.
  assert.equal(belongsInMemberHistory(legacyInactive), true)
})

test('history years are distinct and newest first', () => {
  const years = memberHistoryYears([
    member({
      history: [event('joined', '2024-01-05')],
    }),
    member({
      history: [
        event('joined', '2019-01-05'),
        event('returned', '2026-01-20'),
      ],
    }),
  ])
  assert.deepEqual(years, [2026, 2024, 2019])
})

test('duplicate matching ignores case, diacritics, and name order', () => {
  const members = [
    member({ id: 'a', firstName: 'Jose', lastName: 'Nunez' }),
    member({
      id: 'b',
      firstName: 'Maria',
      lastName: 'Dela Cruz',
      isActive: false,
    }),
  ]
  const found = findPossibleDuplicateMembers(members, {
    firstName: 'josé',
    lastName: 'núñez',
  })
  assert.deepEqual(found.map((m) => m.id), ['a'])
  assert.deepEqual(
    findPossibleDuplicateMembers(members, {
      firstName: 'Maria',
      lastName: 'Dela Cruz',
    }).map((m) => m.id),
    ['b'],
  )
})

test('duplicate matching returns nothing for a different name', () => {
  assert.deepEqual(
    findPossibleDuplicateMembers([member()], {
      firstName: 'Ana',
      lastName: 'Reyes',
    }),
    [],
  )
})

test('last lifecycle event returns null when there are no events', () => {
  assert.equal(lastLifecycleEvent(member()), null)
})

test('transfer reason labels map to friendly copy', () => {
  assert.equal(transferReasonLabel('transferred-locale'), 'Transferred Locale')
  assert.equal(transferReasonLabel(undefined), 'Other')
})

test('membership summary names the stint span', () => {
  assert.equal(memberMembershipSummary(member()), 'Legacy record')
  assert.equal(
    memberMembershipSummary(
      member({ history: [event('joined', '2024-01-05')] }),
    ),
    'Since 2024',
  )
  assert.equal(
    memberMembershipSummary(
      member({
        history: [
          event('joined', '2018-01-05'),
          event('transferred-out', '2019-03-10'),
          event('returned', '2022-01-20'),
        ],
      }),
    ),
    '2 terms · 2018–2022',
  )
})