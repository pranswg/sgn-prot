import type { Member } from '@/core/types/member'
import type {
  ExtraOccasionOrganistaAssignment,
  ExtraOccasionOrganistaRole,
  Suguan,
} from '@/core/types/suguan'
import { memberIsOrganist } from '@/core/constants/memberMembership'
import type { VoicePosition } from '@/core/types/suguan'

export type ExtraOrganistaRole = ExtraOccasionOrganistaRole
export type ExtraOrganistaAssignment = ExtraOccasionOrganistaAssignment

export interface ExtraOccasionSection {
  id: string
  label: string
  voiceSections: {
    id: string
    label: string
    rows: { name: string; memberId: string }[]
  }[]
  organistaRows: { name: string; memberId: string }[]
}

function compareName(left: Member, right: Member): number {
  return (
    left.lastName.localeCompare(right.lastName, undefined, {
      sensitivity: 'base',
    }) ||
    left.firstName.localeCompare(right.firstName, undefined, {
      sensitivity: 'base',
    })
  )
}

function memberName(member: Member): string {
  return `${member.lastName}, ${[
    member.firstName,
    member.middleName,
    member.suffix,
  ]
    .filter(Boolean)
    .join(' ')}`
}

export function buildExtraOccasionSections(
  suguan: Suguan,
  voices: VoicePosition[],
  members: Member[],
  organistaAssignments: Record<string, ExtraOrganistaAssignment[]>,
): ExtraOccasionSection[] {
  const memberById = new Map(members.map((member) => [member.id, member]))
  const oicMemberId = suguan.dutyRoles.find(
    (role) => role.dutyRoleId === 'oic',
  )?.memberId
  const voiceSections = voices.filter((voice) =>
    suguan.group === 'babae'
      ? voice.gender === 'female'
      : suguan.group === 'lalaki'
        ? voice.gender === 'male'
        : true,
  )

  return suguan.schedules.map((schedule) => ({
    id: schedule.id,
    label: [schedule.scheduleDay, schedule.scheduleTime]
      .filter(Boolean)
      .join(' ')
      .trim() || schedule.scheduleLabel,
    voiceSections: voiceSections
      .map((voice) => ({
        id: voice.id,
        label: voice.name,
        rows: schedule.assignments
          .filter((assignment) => assignment.voicePosition === voice.id)
          .map((assignment) => {
            const member = memberById.get(assignment.memberId)
            const name = member
              ? memberName(member)
              : assignment.memberName.split(' ').reverse().join(', ')
            return {
              memberId: assignment.memberId,
              name: assignment.memberId === oicMemberId ? `${name} - OIC` : name,
              member,
            }
          })
          .sort((left, right) =>
            left.member && right.member
              ? compareName(left.member, right.member)
              : left.name.localeCompare(right.name, undefined, {
                  sensitivity: 'base',
                }),
          )
          .map(({ memberId, name }) => ({ memberId, name })),
      }))
      .filter((voice) => voice.rows.length > 0),
    organistaRows: (organistaAssignments[schedule.id] ?? [])
      .map((assignment) => {
        const member = memberById.get(assignment.memberId)
        if (!member || !member.isActive || !memberIsOrganist(member)) return null
        return {
          memberId: member.id,
          member,
          name: `${memberName(member)} - ${
            assignment.role === 'organista'
              ? 'ORGANISTA'
              : 'RESERBANG ORGANISTA'
          }`,
        }
      })
      .filter(
        (
          row,
        ): row is {
          memberId: string
          member: Member
          name: string
        } => row !== null,
      )
      .sort((left, right) => compareName(left.member, right.member))
      .map(({ memberId, name }) => ({ memberId, name })),
  }))
}

export function memberIsEligibleExtraOrganista(member: Member): boolean {
  return member.isActive && memberIsOrganist(member)
}
