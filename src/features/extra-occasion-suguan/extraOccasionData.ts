import type { Member } from '@/core/types/member'
import type {
  DutyRole,
  ExtraOccasionOrganistaAssignment,
  ExtraOccasionOrganistaRole,
  Suguan,
  ExtraOccasionSuguanConfig,
  SuguanScheduleSection,
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
  dutyRoles: readonly DutyRole[] = [],
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

  return suguan.schedules.map((schedule) => {
    const scheduleLabel = schedule.scheduleLabel.trim()
    const scheduleTime = schedule.scheduleTime.trim()
    const label =
      scheduleLabel &&
      scheduleTime &&
      !scheduleLabel.toLowerCase().includes(scheduleTime.toLowerCase())
        ? `${scheduleLabel} · ${scheduleTime}`
        : scheduleLabel || scheduleTime
    return {
      id: schedule.id,
      label,
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
          if (!member || !member.isActive || !memberIsOrganist(member, dutyRoles))
            return null
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
    }
  })
}

export function memberIsEligibleExtraOrganista(
  member: Member,
  dutyRoles: readonly DutyRole[] = [],
): boolean {
  return member.isActive && memberIsOrganist(member, dutyRoles)
}

/** The name typed into "Occasion name", trimmed, or `''` when it is blank. */
export function extraOccasionName(
  config: ExtraOccasionSuguanConfig | undefined,
): string {
  return config?.name?.trim() ?? ''
}

/**
 * What Suguan History calls a saved Extra Occasion: the name the user gave it,
 * or the generic label when they left the field blank. The record is stored
 * under that generic name, so without this an occasion the user called "Wedding"
 * would read back as "Extra Occasion Suguan".
 */
export function extraOccasionRecordLabel(suguan: Suguan): string {
  return extraOccasionName(suguan.extraOccasion) || 'Extra Occasion Suguan'
}

export function buildExtraOccasionSheetSuguan(
  suguan: Suguan,
  voices: VoicePosition[],
  members: Member[],
  config: ExtraOccasionSuguanConfig,
  dutyRoles: readonly DutyRole[] = [],
): Suguan {
  const sections = buildExtraOccasionSections(
    suguan,
    voices,
    members,
    config.organistaAssignments,
    dutyRoles,
  )
  const scheduleById = new Map(
    suguan.schedules.map((schedule) => [schedule.id, schedule]),
  )
  const schedules: SuguanScheduleSection[] = sections.flatMap((section) => {
    const source = scheduleById.get(section.id)
    if (!source) return []
    const scheduleHeading: SuguanScheduleSection = {
      ...source,
      id: `${section.id}-schedule`,
      scheduleLabel: section.label,
      headingType: 'schedule',
      assignments: [],
    }
    const voiceSchedules = section.voiceSections.map((voice) => ({
      ...source,
      id: `${section.id}-${voice.id}`,
      scheduleLabel: voice.label.toLocaleUpperCase(),
      headingType: 'voice' as const,
      assignments: voice.rows.map((row) => ({
        memberId: row.memberId,
        memberName: row.name,
        displayName: row.name,
        voicePosition: voice.id,
        assignedAt: '',
      })),
    }))
    const organistaSchedule =
      section.organistaRows.length > 0
        ? [
            {
              ...source,
              id: `${section.id}-organista`,
              scheduleLabel: 'ORGANISTA',
              headingType: 'voice' as const,
              assignments: section.organistaRows.map((row) => ({
                memberId: row.memberId,
                memberName: row.name,
                displayName: row.name,
                voicePosition: 'organista',
                assignedAt: '',
              })),
            },
          ]
        : []
    return [
      scheduleHeading,
      ...voiceSchedules,
      ...organistaSchedule,
    ]
  })
  const events = [
    ...(config.pagsasanay.enabled
      ? [
          {
            id: 'extra-occasion-pagsasanay',
            type: 'pagsasanay' as const,
            date: config.pagsasanay.date,
            label: config.pagsasanay.label,
          },
        ]
      : []),
    ...(config.pagtupad.enabled
      ? [
          {
            id: 'extra-occasion-pagtupad',
            type: 'pagtupad' as const,
            date: config.pagtupad.date,
            label: config.pagtupad.label,
          },
        ]
      : []),
  ]
  return {
    ...suguan,
    extraOccasion: config,
    events,
    schedules,
    assignments: schedules.flatMap((schedule) => schedule.assignments),
    dutyRoles: suguan.dutyRoles.filter((role) => role.dutyRoleId !== 'oic'),
  }
}
