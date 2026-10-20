import type { ChoirPosition, MembershipType } from '@/core/types/member'
import type { DutyRole } from '@/core/types/suguan'
import { isOrganistMembership } from '@/core/constants/memberMembership'
import {
  ORGANISTA_DUTY_ROLE_NAME,
  findDutyRoleByName,
} from '@/core/constants/dutyRoles'

/**
 * A member's ranks are the Duty Roles the administrator configured in Settings,
 * so nothing here is a built-in catalogue. The small maps below exist only to
 * read data saved before ranks became configurable, and each one resolves
 * against the configured roles rather than a fixed name of its own.
 */

/** The rank name each legacy stored `ChoirPosition` used to stand for. */
export const LEGACY_POSITION_RANK_NAMES: Record<ChoirPosition, string> = {
  'pangulong-mang-aawit': 'Pangulong Mang-aawit',
  'kalihim-ng-mang-aawit': 'Kalihim ng Mang-aawit',
  oic: 'OIC',
  organista: 'Organista',
  'assistant-tagapagturo': 'Assistant Tagapagturo',
}

/** The rank the organist-family Member categories count as. */
const ORGANIST_RANK_NAME = ORGANISTA_DUTY_ROLE_NAME

type RankMember = {
  assignedDutyRoleIds?: readonly string[]
  positions?: readonly ChoirPosition[]
  membershipType?: MembershipType
}

/**
 * Every configured rank a member holds, as configured-role ids.
 *
 * `assignedDutyRoleIds` is the source of truth. Two bridges keep older data
 * visible: a stored legacy `position` counts when a configured role carries the
 * same name, and an organist-family membership counts as the configured
 * Organista rank.
 */
export function memberRankIds(
  member: RankMember,
  roles: readonly DutyRole[],
): string[] {
  const ids = new Set(member.assignedDutyRoleIds ?? [])
  const addByName = (name: string) => {
    const role = findDutyRoleByName(roles, name)
    if (role) ids.add(role.id)
  }
  for (const position of member.positions ?? []) {
    const name = LEGACY_POSITION_RANK_NAMES[position]
    if (name) addByName(name)
  }
  if (member.membershipType && isOrganistMembership(member.membershipType)) {
    addByName(ORGANIST_RANK_NAME)
  }
  return [...ids]
}

/** True when the member holds the configured rank identified by `roleId`. */
export function memberHasRank(
  member: RankMember,
  roleId: string,
  roles: readonly DutyRole[],
): boolean {
  return memberRankIds(member, roles).includes(roleId)
}

/** The names of a member's ranks, in the configured order. */
export function memberRankNames(
  member: RankMember,
  roles: readonly DutyRole[],
): string[] {
  const held = new Set(memberRankIds(member, roles))
  return roles.filter((role) => held.has(role.id)).map((role) => role.name)
}

/** How many members hold each configured rank, including the zero-count ones. */
export function countMembersByRank(
  members: readonly RankMember[],
  roles: readonly DutyRole[],
): Map<string, number> {
  const counts = new Map<string, number>(roles.map((role) => [role.id, 0]))
  for (const member of members) {
    for (const id of memberRankIds(member, roles)) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}
