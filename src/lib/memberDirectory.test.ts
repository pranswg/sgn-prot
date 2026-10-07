/**
 * Member directory filter, sort, and stats tests.
 *
 * These cover the pure logic behind the Master List directory: the quick
 * filters, the multi-select lists, the combined text query, the sort orders,
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
  filtersForStartView,
  formatMemberName,
  groupMembersByGender,
hasActiveDirectoryFilters,
  isMemberPageSize,
  memberInitials,
  DEFAULT_MEMBER_PAGE_SIZE,
  MEMBER_PAGE_SIZES,
  normalizeMemberPageSize,
  paginate,
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

test('filtersForStartView maps every dashboard KPI view to its filters', () => {
  assert.deepEqual(filtersForStartView('all'), EMPTY_DIRECTORY_FILTERS)
  assert.equal(filtersForStartView('active').status, 'active')
  assert.equal(filtersForStartView('active').gender, 'all')
  assert.equal(filtersForStartView('female').gender, 'female')
  assert.equal(filtersForStartView('male').gender, 'male')
  assert.equal(filtersForStartView('female').status, 'all')
})

test('filtersForStartView views match the cohort the KPI counts', () => {
  const female = MEMBERS.filter((m) => m.gender === 'female').map((m) => m.id)
  const male = MEMBERS.filter((m) => m.gender === 'male').map((m) => m.id)
  const active = MEMBERS.filter((m) => m.isActive).map((m) => m.id)
  assert.deepEqual(run(filtersForStartView('female')).sort(), female.sort())
  assert.deepEqual(run(filtersForStartView('male')).sort(), male.sort())
  assert.deepEqual(run(filtersForStartView('active')).sort(), active.sort())
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

test('voice-position sort follows the configured voice order, not alphabetical', () => {
  // S1, Alto, Bass: alphabetical would read Alto, Bass, Soprano-1.
  const sorted = filterMembers(
    MEMBERS,
    filters(),
    VOICES,
    buildMemberReferences(MEMBERS),
    'voice-position',
  ).map((m) => m.id)
  assert.deepEqual(sorted, ['1', '3', '2'])
})

test('a voice missing from settings sorts after every configured voice', () => {
  const roster: Member[] = [
    { ...MEMBERS[1], id: 'gone', voicePosition: 'retired-voice' },
    { ...MEMBERS[0], id: 'here' },
  ]
  const sorted = filterMembers(
    roster,
    filters(),
    VOICES,
    buildMemberReferences(roster),
    'voice-position',
  ).map((m) => m.id)
  assert.deepEqual(sorted, ['here', 'gone'])
})

test('recently-added orders newest first and breaks date ties by surname', () => {
  const roster: Member[] = [
    { ...MEMBERS[0], id: 'early', lastName: 'Aldrete', dateAdded: '2026-03-01' },
    { ...MEMBERS[1], id: 'late', lastName: 'Zuniga', dateAdded: '2026-03-01' },
    { ...MEMBERS[2], id: 'old', lastName: 'Bard', dateAdded: '2025-12-31' },
  ]
  const sorted = filterMembers(
    roster,
    filters(),
    VOICES,
    buildMemberReferences(roster),
    'recently-added',
  ).map((m) => m.id)
  // A surname sort would have put "Bard" second, so this pins the date order.
  assert.deepEqual(sorted, ['early', 'late', 'old'])
})

test('field sorts still write names in surname order', () => {
  const member = { firstName: 'Ana', lastName: 'Reyes' }
  assert.equal(formatMemberName(member, 'voice-position'), 'Reyes, Ana')
  assert.equal(formatMemberName(member, 'recently-added'), 'Reyes, Ana')
  assert.equal(memberInitials(member, 'voice-position'), 'RA')
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

test('paginate offers exactly 5/10/15/20/25 and defaults to 10', () => {
  assert.deepEqual([...MEMBER_PAGE_SIZES], [5, 10, 15, 20, 25])
  assert.equal(DEFAULT_MEMBER_PAGE_SIZE, 10)
  // The default is one of the offered options, not a separate sentinel.
  assert.ok(isMemberPageSize(DEFAULT_MEMBER_PAGE_SIZE))
})

test('normalizeMemberPageSize falls back to the default for junk', () => {
  assert.equal(normalizeMemberPageSize(25), 25)
  assert.equal(normalizeMemberPageSize(7), DEFAULT_MEMBER_PAGE_SIZE)
  assert.equal(normalizeMemberPageSize(0), DEFAULT_MEMBER_PAGE_SIZE)
  assert.equal(normalizeMemberPageSize(NaN), DEFAULT_MEMBER_PAGE_SIZE)
})

test('paginate slices a page and reports its position', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1)
  const first = paginate(items, 1, 10)
  assert.deepEqual(first.items, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(first.pageCount, 3)
  assert.equal(first.firstItem, 1)
  assert.equal(first.lastItem, 10)
  assert.equal(first.hasPrevious, false)
  assert.equal(first.hasNext, true)

  const last = paginate(items, 3, 10)
  // A partial final page must not claim five rows it does not have.
  assert.deepEqual(last.items, [21, 22, 23, 24, 25])
  assert.equal(last.firstItem, 21)
  assert.equal(last.lastItem, 25)
  assert.equal(last.hasNext, false)
})

test('paginate covers every item exactly once across pages', () => {
  const items = Array.from({ length: 47 }, (_, i) => `m${i}`)
  for (const size of MEMBER_PAGE_SIZES) {
    const seen: string[] = []
    let page = 1
    let guard = 0
    for (;;) {
      const result = paginate(items, page, size)
      seen.push(...result.items)
      if (!result.hasNext) break
      page = result.page + 1
      if ((guard += 1) > 50) throw new Error('pagination did not terminate')
    }
    assert.deepEqual(seen, items, `size ${size} lost or repeated a member`)
  }
})

test('paginate clamps a page beyond the end instead of blanking', () => {
  // This is the filter-narrowing case: the user was on page 4 of a large
  // result set, then filtered down to a single page.
  const items = [1, 2, 3]
  const stale = paginate(items, 4, 10)
  assert.equal(stale.page, 1)
  assert.deepEqual(stale.items, [1, 2, 3])
  assert.equal(stale.hasNext, false)
  assert.equal(stale.hasPrevious, false)
})

test('paginate treats junk pages and sizes as page 1', () => {
  const items = [1, 2, 3]
  for (const page of [0, -5, NaN]) {
    assert.equal(paginate(items, page, 10).page, 1)
    assert.deepEqual(paginate(items, page, 10).items, items)
  }
  // A zero or negative page size collapses to one row per page rather than
  // slicing to nothing, which would otherwise loop forever paging.
  for (const size of [0, -5, NaN]) {
    const result = paginate(items, 1, size)
    assert.equal(result.pageSize, 1)
    assert.deepEqual(result.items, [1])
  }
})

test('paginate keeps an empty list on a single empty page', () => {
  const empty = paginate([], 3, 10)
  assert.deepEqual(empty.items, [])
  assert.equal(empty.total, 0)
  assert.equal(empty.pageCount, 1)
  assert.equal(empty.page, 1)
  assert.equal(empty.firstItem, 0)
  assert.equal(empty.lastItem, 0)
  assert.equal(empty.hasPrevious, false)
  assert.equal(empty.hasNext, false)
})

test('each choir section pages independently', () => {
  // The directory splits by gender, then pages each half on its own cursor,
  // so a large womens roster must not push the mens table onto later pages.
  const women = Array.from({ length: 12 }, (_, i) => ({ id: `w${i}` }))
  const men = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}` }))
  const womensPage2 = paginate(women, 2, 10)
  const mensPage1 = paginate(men, 1, 10)
  assert.equal(womensPage2.items.length, 2)
  assert.deepEqual(mensPage1.items, men)
  assert.equal(mensPage1.pageCount, 1)
  assert.equal(mensPage1.hasNext, false)
})
