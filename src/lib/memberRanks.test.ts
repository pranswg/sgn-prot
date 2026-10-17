/**
 * Rank resolution tests.
 *
 * Ranks are the Duty Roles the administrator configured in Settings, so these
 * pin the three ways a member's ranks are resolved (the stored
 * `assignedDutyRoleIds`, a legacy stored `position` matched by name, and the
 * organist-family memberships) and the counting that the Master List uses. The
 * role ids below are the shape the store actually holds (nanoid), never the old
 * fixed `ChoirPosition` ids, so a regression that reintroduces an id lookup
 * fails here.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import type { Member } from '@/core/types/member'
import type { DutyRole } from '@/core/types/suguan'
import {
  LEGACY_POSITION_RANK_NAMES,
  countMembersByRank,
  memberHasRank,
  memberRankIds,
  memberRankNames,
} from './memberRanks.ts'

const ROLES: DutyRole[] = [
  { id: 'zTudCx73-YMHh0PCdbjs2', name: 'Organista', abbreviation: 'ORG' },
  {
    id: 'Ccuo8FLgJo4lgfK19ildr',
    name: 'Pangulong Mang-aawit',
    abbreviation: 'PM',
  },
  { id: 'bq_-8eIaeSPgHHPm98v3c', name: 'Mang-aawit', abbreviation: 'MA' },
  { id: 'BpZw-dh3fmxGgmoGP-C9p', name: 'OIC', abbreviation: 'OIC' },
]

function member(options: Partial<Member> = {}): Member {
  return {
    id: 'm',
    firstName: 'Test',
    lastName: 'Member',
    gender: 'female',
    voicePosition: 'alto',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
    ...options,
  }
}

test('assignedDutyRoleIds is the source of truth, whatever the configured id', () => {
  const m = member({ assignedDutyRoleIds: ['bq_-8eIaeSPgHHPm98v3c'] })
  assert.deepEqual(memberRankIds(m, ROLES), ['bq_-8eIaeSPgHHPm98v3c'])
  assert.equal(memberHasRank(m, 'bq_-8eIaeSPgHHPm98v3c', ROLES), true)
  assert.equal(memberHasRank(m, 'BpZw-dh3fmxGgmoGP-C9p', ROLES), false)
})

test('a legacy stored position counts when a configured role carries its name', () => {
  const m = member({ positions: ['pangulong-mang-aawit'] })
  assert.deepEqual(memberRankNames(m, ROLES), ['Pangulong Mang-aawit'])
})

test('a legacy stored position with no matching configured role is dropped', () => {
  // `kalihim-ng-mang-aawit` has no role named "Kalihim ng Mang-aawit" here.
  const m = member({ positions: ['kalihim-ng-mang-aawit'] })
  assert.deepEqual(memberRankIds(m, ROLES), [])
})

test('an organist-family membership counts as the configured Organista role', () => {
  assert.deepEqual(memberRankNames(member({ membershipType: 'organista' }), ROLES), [
    'Organista',
  ])
  assert.deepEqual(
    memberRankNames(member({ membershipType: 'assistant-tagapagturo' }), ROLES),
    ['Organista'],
  )
  assert.deepEqual(memberRankNames(member(), ROLES), [])
})

test('every rank name the legacy map writes is resolvable by name', () => {
  for (const name of Object.values(LEGACY_POSITION_RANK_NAMES)) {
    assert.equal(typeof name, 'string')
    assert.ok(name.length > 0)
  }
})

test('memberRankNames follows the configured role order, not the stored order', () => {
  const m = member({
    assignedDutyRoleIds: ['BpZw-dh3fmxGgmoGP-C9p', 'bq_-8eIaeSPgHHPm98v3c'],
  })
  assert.deepEqual(memberRankNames(m, ROLES), ['Mang-aawit', 'OIC'])
})

test('countMembersByRank includes every configured role at zero', () => {
  const members = [
    member({ id: 'a', assignedDutyRoleIds: ['bq_-8eIaeSPgHHPm98v3c'] }),
    member({ id: 'b', positions: ['pangulong-mang-aawit'] }),
    member({ id: 'c', membershipType: 'organista' }),
    member({ id: 'd', positions: ['oic'] }),
  ]
  const counts = countMembersByRank(members, ROLES)
  assert.equal(counts.get('bq_-8eIaeSPgHHPm98v3c'), 1)
  assert.equal(counts.get('Ccuo8FLgJo4lgfK19ildr'), 1)
  assert.equal(counts.get('zTudCx73-YMHh0PCdbjs2'), 1)
  assert.equal(counts.get('BpZw-dh3fmxGgmoGP-C9p'), 1)
})

test('a role with no members still reports a zero count', () => {
  const counts = countMembersByRank([member()], ROLES)
  for (const role of ROLES) assert.equal(counts.get(role.id), 0)
})
