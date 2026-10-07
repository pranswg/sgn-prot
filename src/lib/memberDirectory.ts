import type { Member, MembershipType } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  CHOIR_POSITIONS,
  POSITION_LABELS,
} from '@/core/constants/choirPositions'
import {
  MEMBERSHIP_LABELS,
  memberEffectivePositions,
} from '@/core/constants/memberMembership'
import { getVoiceName } from '@/core/constants/voicePositions'

export type DirectoryQuickFilter =
  'all' | MembershipType | 'active' | 'inactive'

/**
 * Directory ordering, which also decides how a name is written out. The two
 * name modes are orders; the other two order by a field and fall back to the
 * surname when that field ties, so `formatMemberName` only needs to know
 * whether given-name-first was asked for.
 */
export type MemberSort =
  | 'last-name'
  | 'first-name'
  | 'voice-position'
  | 'recently-added'

export const MEMBER_SORT_LABEL: Record<MemberSort, string> = {
  'last-name': 'Last Name (A-Z)',
  'first-name': 'First Name (A-Z)',
  'voice-position': 'Voice Position',
  'recently-added': 'Recently Added',
}

/** Page sizes offered by the directory paginator. */
export const MEMBER_PAGE_SIZES = [5, 10, 15, 20, 25] as const

export type MemberPageSize = (typeof MEMBER_PAGE_SIZES)[number]

export const DEFAULT_MEMBER_PAGE_SIZE: MemberPageSize = 10

export interface MemberPage<T> {
  items: T[]
  /** 1-based. Always at least 1, even when empty. */
  page: number
  pageCount: number
  pageSize: number
  /** Total items before slicing, i.e. the whole choir section. */
  total: number
  /** 1-based index of the first item on this page; 0 when empty. */
  firstItem: number
  /** 1-based index of the last item on this page; 0 when empty. */
  lastItem: number
  hasPrevious: boolean
  hasNext: boolean
}

export function isMemberPageSize(value: number): value is MemberPageSize {
  return (MEMBER_PAGE_SIZES as readonly number[]).includes(value)
}

/** Clamp a requested page size to the offered options, defaulting to 10. */
export function normalizeMemberPageSize(value: number): MemberPageSize {
  return isMemberPageSize(value) ? value : DEFAULT_MEMBER_PAGE_SIZE
}

/**
 * Slice one page out of a list.
 *
 * `page` is clamped rather than trusted: filters shrink the choir sections
 * under the user's feet, so a remembered page 4 can outlive its own contents.
 * Clamping in one place keeps every section showing rows instead of a blank
 * table with an out-of-range pager.
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): MemberPage<T> {
  const size = Math.max(1, Math.trunc(pageSize) || 1)
  const total = items.length
  // An empty list still has one (empty) page, which keeps "Page 1 of 1" honest.
  const pageCount = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)
  const start = (current - 1) * size
  const visible = items.slice(start, start + size)

  return {
    items: visible,
    page: current,
    pageCount,
    pageSize: size,
    total,
    firstItem: visible.length > 0 ? start + 1 : 0,
    lastItem: visible.length > 0 ? start + visible.length : 0,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  }
}

export interface MemberGenderGroups {
  women: Member[]
  men: Member[]
}

export interface MemberDirectoryFilters {
  query: string
  gender: 'all' | 'male' | 'female'
  /** Multi-select. Empty means "all voice positions". */
  voices: string[]
  status: 'all' | 'active' | 'inactive'
  quick: DirectoryQuickFilter
  positions: string[]
}

export const EMPTY_DIRECTORY_FILTERS: MemberDirectoryFilters = {
  query: '',
  gender: 'all',
  voices: [],
  status: 'all',
  quick: 'all',
  positions: [],
}

/**
 * Directory views the dashboard KPI cards can pre-load. `navigateToDirectory`
 * carries one of these into the store; MasterListPage maps it to filters on
 * mount. Kept alongside the filter type so the dashboard and the directory
 * share one vocabulary rather than two overlapping unions.
 */
export type DirectoryStartView = 'all' | 'active' | 'female' | 'male'

/** Resolve a dashboard KPI view into the directory filters it implies. */
export function filtersForStartView(view: DirectoryStartView): MemberDirectoryFilters {
  if (view === 'active') {
    return { ...EMPTY_DIRECTORY_FILTERS, status: 'active' }
  }
  if (view === 'female' || view === 'male') {
    return { ...EMPTY_DIRECTORY_FILTERS, gender: view }
  }
  return EMPTY_DIRECTORY_FILTERS
}

export function hasActiveDirectoryFilters(
  filters: MemberDirectoryFilters,
): boolean {
  return (
    filters.query.trim() !== '' ||
    filters.gender !== 'all' ||
    filters.voices.length > 0 ||
    filters.status !== 'all' ||
    filters.quick !== 'all' ||
    filters.positions.length > 0
  )
}

export function countActiveDirectoryFilters(
  filters: MemberDirectoryFilters,
): number {
  let n = 0
  if (filters.query.trim() !== '') n += 1
  if (filters.gender !== 'all') n += 1
  if (filters.voices.length > 0) n += filters.voices.length
  if (filters.status !== 'all') n += 1
  if (filters.quick !== 'all') n += 1
  n += filters.positions.length
  return n
}

/** Adds or removes a value, keeping the array order stable and unique. */
export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

/**
 * Renders a member's name in the same order the directory is sorted by:
 * "Daco, Sandreah Rose" when sorted by last name, "Sandreah Rose Daco" otherwise.
 */
export function formatMemberName(
  member: Pick<Member, 'firstName' | 'lastName'>,
  sort: MemberSort = 'last-name',
): string {
  const first = member.firstName.trim()
  const last = member.lastName.trim()
  return sort === 'first-name'
    ? `${first} ${last}`.trim()
    : `${last}, ${first}`.trim()
}

export function memberInitials(
  member: Pick<Member, 'firstName' | 'lastName'>,
  sort: MemberSort = 'last-name',
): string {
  const first = member.firstName.trim().charAt(0)
  const last = member.lastName.trim().charAt(0)
  const initials = sort === 'first-name' ? `${first}${last}` : `${last}${first}`
  return initials.toUpperCase() || '—'
}

/**
 * Display-only reference code (M-001, M-002, ...) assigned from the member's
 * position in the persisted roster. The stored `id` is left untouched.
 */
export function buildMemberReferences(members: Member[]): Map<string, string> {
  const map = new Map<string, string>()
  members.forEach((member, index) => {
    map.set(member.id, `M-${String(index + 1).padStart(3, '0')}`)
  })
  return map
}

function matchesQuickFilter(
  member: Member,
  quick: DirectoryQuickFilter,
): boolean {
  switch (quick) {
    case 'all':
      return true
    case 'active':
      return member.isActive
    case 'inactive':
      return !member.isActive
    default:
      return member.membershipType === quick
  }
}

export function filterMembers(
  members: Member[],
  filters: MemberDirectoryFilters,
  voices: VoicePosition[],
  references: Map<string, string>,
  sort: MemberSort = 'last-name',
): Member[] {
  const q = filters.query.trim().toLowerCase()

  return members
    .filter((member) => {
      if (!matchesQuickFilter(member, filters.quick)) return false
      if (filters.gender !== 'all' && member.gender !== filters.gender)
        return false
      if (
        filters.voices.length > 0 &&
        !filters.voices.includes(member.voicePosition)
      )
        return false
      if (filters.status === 'active' && !member.isActive) return false
      if (filters.status === 'inactive' && member.isActive) return false
      if (
        filters.positions.length > 0 &&
        !filters.positions.some((p) =>
          memberEffectivePositions(member).includes(p as Member['positions'][number]),
        )
      )
        return false

      if (q) {
        const haystack = [
          member.firstName,
          member.lastName,
          `${member.firstName} ${member.lastName}`,
          references.get(member.id) ?? '',
          getVoiceName(member.voicePosition, voices),
          MEMBERSHIP_LABELS[member.membershipType],
          ...memberEffectivePositions(member).map((p) => POSITION_LABELS[p]),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sort === 'recently-added') {
        // `dateAdded` is a `YYYY-MM-DD` string, so a plain comparison is a
        // calendar comparison and needs no `Date` round trip.
        const byDate = b.dateAdded.localeCompare(a.dateAdded)
        if (byDate !== 0) return byDate
      } else if (sort === 'voice-position') {
        const byVoice =
          voiceRank(a.voicePosition, voices) - voiceRank(b.voicePosition, voices)
        if (byVoice !== 0) return byVoice
      }
      const primary =
        sort === 'first-name'
          ? a.firstName.localeCompare(b.firstName)
          : a.lastName.localeCompare(b.lastName)
      if (primary !== 0) return primary
      const secondary =
        sort === 'first-name'
          ? a.lastName.localeCompare(b.lastName)
          : a.firstName.localeCompare(b.firstName)
      if (secondary !== 0) return secondary
      return a.id.localeCompare(b.id)
    })
}

/**
 * A voice's index in the configured order, so sorting follows the settings
 * list (Soprano 1, Soprano 2, Alto, ...) rather than alphabetical order. A
 * voice that has since been removed sorts after every configured one instead
 * of falling back to the name and landing mid-list.
 */
function voiceRank(voiceId: string, voices: VoicePosition[]): number {
  const index = voices.findIndex((voice) => voice.id === voiceId)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

export function groupMembersByGender(members: Member[]): MemberGenderGroups {
  return {
    women: members.filter((m) => m.gender === 'female'),
    men: members.filter((m) => m.gender === 'male'),
  }
}

export interface DirectoryStats {
  total: number
  active: number
  inactive: number
  regular: number
  organistCategory: number
  trainees: number
  withPrivileges: number
  membershipCounts: Map<MembershipType, number>
  voiceCounts: { id: string; name: string; shortName: string; count: number }[]
  positionCounts: Map<string, number>
}

export function computeDirectoryStats(
  members: Member[],
  trainees: { status: string }[],
  voices: VoicePosition[],
): DirectoryStats {
  const counts = new Map<string, number>()
  const membershipCounts = new Map<MembershipType, number>()
  let active = 0
  let regular = 0
  let organistCategory = 0
  let withPrivileges = 0

  for (const member of members) {
    if (member.isActive) active += 1
    if (member.membershipType === 'regular') regular += 1
    else organistCategory += 1
    if (memberEffectivePositions(member).length > 0) withPrivileges += 1
    membershipCounts.set(
      member.membershipType,
      (membershipCounts.get(member.membershipType) ?? 0) + 1,
    )
    counts.set(
      member.voicePosition,
      (counts.get(member.voicePosition) ?? 0) + 1,
    )
  }

  return {
    total: members.length,
    active,
    inactive: members.length - active,
    regular,
    organistCategory,
    trainees: trainees.filter((t) => t.status === 'active').length,
    withPrivileges,
    membershipCounts,
    positionCounts: countMembersByPosition(members),
    // Configured voice order (Soprano 1, Soprano 2, Alto, Tenor, Bass), not by
    // size, so the distribution card reads the same way every time.
    voiceCounts: voices.map((v) => ({
      id: v.id,
      name: v.name,
      shortName: v.shortName,
      count: counts.get(v.id) ?? 0,
    })),
  }
}

export function countMembersByPosition(members: Member[]): Map<string, number> {
  const counts = new Map<string, number>(CHOIR_POSITIONS.map((p) => [p.id, 0]))
  for (const member of members) {
    for (const position of memberEffectivePositions(member)) {
      counts.set(position, (counts.get(position) ?? 0) + 1)
    }
  }
  return counts
}
