import {
  CHOIR_POSITIONS,
  POSITION_LABELS,
} from '@/core/constants/choirPositions'
import {
  MEMBERSHIP_LABELS,
  memberEffectivePositions,
  memberIsOrganist,
} from '@/core/constants/memberMembership'
import type { Member, Trainee } from '@/core/types/member'
import type { DutyRole, VoicePosition } from '@/core/types/suguan'
import { getVoiceName } from '@/core/constants/voicePositions'

export type MasterListPdfSection =
  | {
      kind: 'members'
      title: string
      members: Member[]
      order: 'voice' | 'name'
    }
  | { kind: 'trainees'; title: string; trainees: Trainee[] }

export type MasterListSummaryRow =
  | { kind: 'section'; category: string }
  | { kind: 'item'; category: string; count: number }

const RANKING_ORDER = [
  'pangulong-mang-aawit',
  'kalihim',
  'organista',
  'oic',
]

const LEGACY_POSITION_FOR_ROLE: Partial<
  Record<string, Member['positions'][number]>
> = {
  'pangulong-mang-aawit': 'pangulong-mang-aawit',
  kalihim: 'kalihim-ng-mang-aawit',
  oic: 'oic',
}

function memberHasDutyRole(member: Member, roleId: string): boolean {
  return (
    member.assignedDutyRoleIds?.includes(roleId) === true ||
    (LEGACY_POSITION_FOR_ROLE[roleId] !== undefined &&
      memberEffectivePositions(member).includes(
        LEGACY_POSITION_FOR_ROLE[roleId]!,
      ))
  )
}

export function groupMasterListPdfSections(
  members: Member[],
  trainees: Trainee[],
  localeName: string,
  dutyRoles: DutyRole[],
): MasterListPdfSection[] {
  const choirName = `${localeName.trim().toLocaleUpperCase()} CHOIR`
  const sections: MasterListPdfSection[] = [
    {
      kind: 'members',
      title: `${choirName} - Women`,
      order: 'voice',
      members: members.filter(
        (member) =>
          member.membershipType === 'regular' && member.gender === 'female',
      ),
    },
    {
      kind: 'members',
      title: `${choirName} - Men`,
      order: 'voice',
      members: members.filter(
        (member) =>
          member.membershipType === 'regular' && member.gender === 'male',
      ),
    },
  ]

  const roleFor = (id: string) =>
    dutyRoles.find((candidate) => candidate.id === id)
  const rankedRoles: {
    role: DutyRole
    title: string
    isOrganist: boolean
  }[] = []
  for (const id of ['pangulong-mang-aawit', 'kalihim']) {
    const role = roleFor(id)
    if (role) rankedRoles.push({ role, title: role.name, isOrganist: false })
  }
  const organistRole = roleFor('organista') ?? roleFor('organista-reserve')
  if (organistRole) {
    rankedRoles.push({
      role: organistRole,
      title: 'Organists',
      isOrganist: true,
    })
  }
  const oicRole = roleFor('oic')
  if (oicRole) rankedRoles.push({ role: oicRole, title: oicRole.name, isOrganist: false })
  const standardRoleIds = new Set([...RANKING_ORDER, 'organista-reserve'])
  for (const role of dutyRoles) {
    if (!standardRoleIds.has(role.id)) {
      rankedRoles.push({ role, title: role.name, isOrganist: false })
    }
  }

  for (const { role, title, isOrganist } of rankedRoles) {
    const assigned = members.filter((member) =>
      isOrganist
        ? memberIsOrganist(member) ||
          member.assignedDutyRoleIds?.includes('organista') === true ||
          member.assignedDutyRoleIds?.includes('organista-reserve') === true
        : memberHasDutyRole(member, role.id),
    )
    if (assigned.length > 0) {
      sections.push({
        kind: 'members',
        title: `${choirName} - ${title}`,
        order: 'name',
        members: assigned,
      })
    }
  }

  for (const gender of ['female', 'male'] as const) {
    const genderTrainees = trainees.filter(
      (trainee) =>
        trainee.gender === gender &&
        (trainee.status === 'active' || trainee.status === 'inactive'),
    )
    if (genderTrainees.length > 0) {
      sections.push({
        kind: 'trainees',
        title: `${choirName} - Nagsasanay ${
          gender === 'female' ? 'Women' : 'Men'
        }`,
        trainees: genderTrainees,
      })
    }
  }

  return sections
}

export function splitMasterListPdfSections(
  sections: MasterListPdfSection[],
): {
  contentSections: MasterListPdfSection[]
  hierarchySections: Extract<MasterListPdfSection, { kind: 'members' }>[]
} {
  const isHierarchySection = (
    section: MasterListPdfSection,
  ): section is Extract<MasterListPdfSection, { kind: 'members' }> =>
    section.kind === 'members' &&
    !section.title.endsWith(' - Women') &&
    !section.title.endsWith(' - Men')
  const hierarchySections = sections.filter(isHierarchySection)
  return {
    contentSections: sections.filter((section) => !isHierarchySection(section)),
    hierarchySections,
  }
}

export function sortMasterListPdfMembers(
  members: Member[],
  voices: VoicePosition[],
  order: 'voice' | 'name',
): Member[] {
  const voiceOrder = new Map(voices.map((voice, index) => [voice.id, index]))
  return [...members].sort((a, b) => {
    if (order === 'voice') {
      const voiceDifference =
        (voiceOrder.get(a.voicePosition) ?? Number.MAX_SAFE_INTEGER) -
        (voiceOrder.get(b.voicePosition) ?? Number.MAX_SAFE_INTEGER)
      if (voiceDifference !== 0) return voiceDifference
    }
    return (
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName) ||
      a.id.localeCompare(b.id)
    )
  })
}

function voiceFamilyCount(
  members: Member[],
  voices: VoicePosition[],
  gender: Member['gender'],
  family: string,
): number {
  return members.filter(
    (member) =>
      member.membershipType === 'regular' &&
      member.gender === gender &&
      getVoiceName(member.voicePosition, voices)
        .trim()
        .toLowerCase()
        .startsWith(family),
  ).length
}

export function summarizeMasterList(
  members: Member[],
  trainees: Trainee[],
  voices: VoicePosition[],
): MasterListSummaryRow[] {
  const otherPositionIds = new Set(
    CHOIR_POSITIONS.filter(
      ({ id }) => id !== 'organista' && id !== 'assistant-tagapagturo',
    ).map(({ id }) => id),
  )
  return [
    { kind: 'section', category: 'CHOIR MEMBERS' },
    { kind: 'item', category: 'Total Choir Members', count: members.length },
    {
      kind: 'item',
      category: 'Female Members',
      count: members.filter((member) => member.gender === 'female').length,
    },
    {
      kind: 'item',
      category: 'Male Members',
      count: members.filter((member) => member.gender === 'male').length,
    },
    {
      kind: 'item',
      category: 'Sopranos',
      count: voiceFamilyCount(members, voices, 'female', 'soprano'),
    },
    {
      kind: 'item',
      category: 'Altos',
      count: voiceFamilyCount(members, voices, 'female', 'alto'),
    },
    {
      kind: 'item',
      category: 'Tenors',
      count: voiceFamilyCount(members, voices, 'male', 'tenor'),
    },
    {
      kind: 'item',
      category: 'Basses',
      count: voiceFamilyCount(members, voices, 'male', 'bass'),
    },
    {
      kind: 'item',
      category: 'Organists',
      count: members.filter(memberIsOrganist).length,
    },
    {
      kind: 'item',
      category: 'OIC / Other Positions',
      count: members.filter((member) =>
        memberEffectivePositions(member).some((position) =>
          otherPositionIds.has(position),
        ),
      ).length,
    },
    {
      kind: 'item',
      category: 'Active Members',
      count: members.filter((member) => member.isActive).length,
    },
    {
      kind: 'item',
      category: 'Inactive Members',
      count: members.filter((member) => !member.isActive).length,
    },
    {
      kind: 'section',
      category: 'TRAINEES / NAGSASANAY',
    },
    {
      kind: 'item',
      category: 'Total Trainees',
      count: trainees.filter(
        (trainee) =>
          trainee.status === 'active' || trainee.status === 'inactive',
      ).length,
    },
    {
      kind: 'item',
      category: 'Female Trainees',
      count: trainees.filter(
        (trainee) =>
          trainee.gender === 'female' &&
          (trainee.status === 'active' || trainee.status === 'inactive'),
      ).length,
    },
    {
      kind: 'item',
      category: 'Male Trainees',
      count: trainees.filter(
        (trainee) =>
          trainee.gender === 'male' &&
          (trainee.status === 'active' || trainee.status === 'inactive'),
      ).length,
    },
    {
      category: 'Active Trainees',
      count: trainees.filter((trainee) => trainee.status === 'active').length,
      kind: 'item',
    },
    {
      kind: 'item',
      category: 'Inactive Trainees',
      count: trainees.filter((trainee) => trainee.status === 'inactive').length,
    },
  ]
}

export function masterListPdfPosition(
  member: Member,
  dutyRoles: DutyRole[] = [],
): string {
  const positions = memberEffectivePositions(member).map(
    (position) => POSITION_LABELS[position],
  )
  const assignedRoleNames = (member.assignedDutyRoleIds ?? [])
    .map((id) => dutyRoles.find((role) => role.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  const labels = [...new Set([...positions, ...assignedRoleNames])]
  if (labels.length > 0) return labels.join(', ')
  return MEMBERSHIP_LABELS[member.membershipType]
}

export function masterListPdfName(
  person: Pick<Member | Trainee, 'firstName' | 'lastName'> &
    Partial<Pick<Member, 'middleName' | 'suffix'>>,
): string {
  const givenName = [person.firstName, person.middleName]
    .filter((part) => part?.trim())
    .join(' ')
  const suffix = person.suffix?.trim()
  return `${person.lastName}, ${givenName}${suffix ? ` ${suffix}` : ''}`.trim()
}
