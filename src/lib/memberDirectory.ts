import type { Member, MembershipType } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  CHOIR_POSITIONS,
  POSITION_LABELS,
} from '@/core/constants/choirPositions'
import { getVoiceName } from '@/core/constants/voicePositions'

export type DirectoryQuickFilter =
  'all' | MembershipType | 'active' | 'inactive'

export type MemberSort = 'last-name' | 'first-name'

export const MEMBER_SORT_LABEL: Record<MemberSort, string> = {
  'last-name': 'Last Name (A-Z)',
  'first-name': 'First Name (A-Z)',
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
          (member.positions ?? []).includes(p as Member['positions'][number]),
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
          ...(member.positions ?? []).map((p) => POSITION_LABELS[p]),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    .sort((a, b) => {
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
  provisional: number
  trainees: number
  withPrivileges: number
  voiceCounts: { id: string; name: string; shortName: string; count: number }[]
  positionCounts: Map<string, number>
}

export function computeDirectoryStats(
  members: Member[],
  trainees: { status: string }[],
  voices: VoicePosition[],
): DirectoryStats {
  const counts = new Map<string, number>()
  let active = 0
  let regular = 0
  let withPrivileges = 0

  for (const member of members) {
    if (member.isActive) active += 1
    if (member.membershipType === 'regular') regular += 1
    if ((member.positions ?? []).length > 0) withPrivileges += 1
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
    provisional: members.length - regular,
    trainees: trainees.filter((t) => t.status === 'active').length,
    withPrivileges,
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
    for (const position of member.positions ?? []) {
      counts.set(position, (counts.get(position) ?? 0) + 1)
    }
  }
  return counts
}
