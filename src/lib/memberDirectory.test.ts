/**
 * Member directory filter, sort, and stats tests.
 *
 * These cover the pure logic behind the Master List directory: the quick
 * filters, the multi-select lists, the combined text query, the two sort orders,
 * and the summary counts. All are pure functions of members plus voices, so no
 * DOM or store is involved.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  buildMemberReferences,
  computeDirectoryStats,
  countActiveDirectoryFilters,
  EMPTY_DIRECTORY_FILTERS,
  filterMembers,
  formatMemberName,
  groupMembersByGender,
  hasActiveDirectoryFilters,
  memberInitials,
  toggleInList,
  type MemberDirectoryFilters,
} from './memberDirectory.ts'

const VOICES: VoicePosition[] = [
  { id: 'soprano-1', name: 'Soprano I', shortName: 'S1', gender: 'female' },
  { id: 'soprano-2', name: 'Soprano II', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

const MEMBERS: Member[] = [
  {
    id: '1',
    firstName: 'Ana',
    lastName: 'Reyes',
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-05',
    positions: ['pangulong-mang-aawit'],
  },
  {
    id: '2',
    firstName: 'Bruno',
    lastName: 'Cruz',
    gender: 'male',
    voicePosition: 'bass',
    membershipType: 'provisional',
    isActive: true,
    dateAdded: '2026-02-10',
    positions: [],
  },
  {
    id: '3',
    firstName: 'Celine',
    lastName: 'Santos',
    gender: 'female',
    voicePosition: 'alto',
    membershipType: 'regular',
    isActive: false,
    dateAdded: '2025-11-02',
    positions: ['oic'],
  },
]

function filters(over: Partial<MemberDirectoryFilters> = {}): MemberDirectoryFilters {
  return { ...EMPTY_DIRECTORY_FILTERS, ...over }
}

function run(f: MemberDirectoryFilters) {
  return filterMembers(MEMBERS, f, VOICES, buildMemberReferences(MEMBERS)).map(
    (m) => m.id,
  )
}

test('an empty filter set returns everyone', () => {
  assert.equal(run(filters()).length, 3)
  assert.equal(hasActiveDirectoryFilters(filters()), false)
  assert.equal(countActiveDirectoryFilters(filters()), 0)
})

test('quick filters split by status, membership type, and gender', () => {
  assert.deepEqual(run(filters({ quick: 'active' })), ['2', '1'])
  assert.deepEqual(run(filters({ quick: 'inactive' })), ['3'])
  assert.deepEqual(run(filters({ quick: 'regular' })), ['1', '3'])
  assert.deepEqual(run(filters({ quick: 'provisional' })), ['2'])
  assert.deepEqual(run(filters({ gender: 'male' })), ['2'])
})

test('the status field and the quick filter both apply', () => {
  assert.deepEqual(run(filters({ status: 'inactive' })), ['3'])
  assert.deepEqual(run(filters({ quick: 'active', status: 'inactive' })), [])
})

test('voice multi-select matches any selected voice', () => {
  assert.deepEqual(run(filters({ voices: ['soprano-1', 'bass'] })), ['2', '1'])
})

test('a position filter matches members holding any selected position', () => {
  assert.deepEqual(run(filters({ positions: ['pangulong-mang-aawit'] })), ['1'])
  assert.deepEqual(run(filters({ positions: ['oic', 'pangulong-mang-aawit'] })), ['1', '3'])
})

test('filters compose as AND across every dimension', () => {
  assert.deepEqual(
    run(filters({ quick: 'active', gender: 'female', positions: ['pangulong-mang-aawit'] })),
    ['1'],
  )
})

test('the text query matches first name, last name, voice, position label, and reference', () => {
  assert.deepEqual(run(filters({ query: 'bruno' })), ['2'])
  assert.deepEqual(run(filters({ query: 'reyes' })), ['1'])
  assert.deepEqual(run(filters({ query: 'bass' })), ['2'])
  assert.deepEqual(run(filters({ query: 'Pangulong' })), ['1'])
  assert.deepEqual(run(filters({ query: 'M-002' })), ['2'])
})

test('the text query is case-insensitive and ignores surrounding whitespace', () => {
  assert.deepEqual(run(filters({ query: '  BRUNO  ' })), ['2'])
})

test('last-name sort is the default', () => {
  assert.deepEqual(run(filters()), ['2', '1', '3'])
})

test('ties on the primary key fall through to the secondary key', () => {
  const tied: Member[] = [
    { ...MEMBERS[0], id: 'b', firstName: 'Zara', lastName: 'Santos' },
    { ...MEMBERS[2], id: 'a', firstName: 'Ana', lastName: 'Santos' },
  ]
  const sorted = filterMembers(
    tied,
    filters(),
    VOICES,
    buildMemberReferences(tied),
  ).map((m) => m.id)
  // Same surname, so given name decides: Ana before Zara.
  assert.deepEqual(sorted, ['a', 'b'])
})

test('first-name sort orders by given name then surname', () => {
  const sorted = filterMembers(
    MEMBERS,
    filters(),
    VOICES,
    buildMemberReferences(MEMBERS),
    'first-name',
  ).map((m) => m.firstName)
  assert.deepEqual(sorted, ['Ana', 'Bruno', 'Celine'])
})

test('hasActiveDirectoryFilters ignores a whitespace-only query', () => {
  assert.equal(hasActiveDirectoryFilters(filters({ query: '   ' })), false)
})

test('countActiveDirectoryFilters counts each list by its length', () => {
  assert.equal(countActiveDirectoryFilters(filters({ query: 'ana' })), 1)
  assert.equal(countActiveDirectoryFilters(filters({ voices: ['alto', 'bass'] })), 2)
  assert.equal(
    countActiveDirectoryFilters(filters({ query: 'ana', gender: 'female', status: 'active' })),
    3,
  )
})

test('toggleInList adds once and removes, preserving order', () => {
  assert.deepEqual(toggleInList([], 'alto'), ['alto'])
  assert.deepEqual(toggleInList(['alto'], 'bass'), ['alto', 'bass'])
  assert.deepEqual(toggleInList(['alto', 'bass'], 'alto'), ['bass'])
})

test('references are display-only codes assigned from roster position', () => {
  const refs = buildMemberReferences(MEMBERS)
  assert.equal(refs.get('1'), 'M-001')
  assert.equal(refs.get('3'), 'M-003')
  assert.equal(MEMBERS[0].id, '1')
})

test('formatMemberName matches the active sort order', () => {
  const member = { firstName: 'Ana', lastName: 'Reyes' }
  assert.equal(formatMemberName(member), 'Reyes, Ana')
  assert.equal(formatMemberName(member, 'first-name'), 'Ana Reyes')
})

test('memberInitials follows the sort order', () => {
  const member = { firstName: 'Ana', lastName: 'Reyes' }
  assert.equal(memberInitials(member), 'RA')
  assert.equal(memberInitials(member, 'first-name'), 'AR')
})

test('groupMembersByGender splits without reordering', () => {
  const groups = groupMembersByGender(MEMBERS)
  assert.deepEqual(groups.women.map((m) => m.id), ['1', '3'])
  assert.deepEqual(groups.men.map((m) => m.id), ['2'])
})

test('computeDirectoryStats counts active, membership types, and privileges', () => {
  const stats = computeDirectoryStats(MEMBERS, [{ status: 'active' }, { status: 'inactive' }], VOICES)
  assert.equal(stats.total, 3)
  assert.equal(stats.active, 2)
  assert.equal(stats.inactive, 1)
  assert.equal(stats.regular, 2)
  assert.equal(stats.provisional, 1)
  assert.equal(stats.withPrivileges, 2)
  assert.equal(stats.trainees, 1)
})

test('voiceCounts follow configured voice order, not size', () => {
  const stats = computeDirectoryStats(MEMBERS, [], VOICES)
  assert.deepEqual(
    stats.voiceCounts.map((v) => v.id),
    ['soprano-1', 'soprano-2', 'alto', 'tenor', 'bass'],
  )
  assert.deepEqual(
    stats.voiceCounts.map((v) => v.count),
    [1, 0, 1, 0, 1],
  )
})

test('positionCounts includes every configured position, even at zero', () => {
  const stats = computeDirectoryStats(MEMBERS, [], VOICES)
  assert.equal(stats.positionCounts.get('pangulong-mang-aawit'), 1)
  assert.equal(stats.positionCounts.get('oic'), 1)
  assert.equal(stats.positionCounts.get('organista'), 0)
})