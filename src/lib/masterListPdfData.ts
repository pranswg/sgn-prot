import {
  MEMBERSHIP_LABELS,
  memberIsOrganist,
} from '@/core/constants/memberMembership'
import { countMembersByRank, memberRankIds, memberRankNames } from '@/lib/memberRanks'
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

  // One ranking section per configured duty role, in the order Settings holds
  // them, so the sheet names each rank exactly as the administrator typed it. A
  // member appears under every rank they hold, and a rank with no members is
  // skipped.
  for (const role of dutyRoles) {
    const assigned = members.filter((member) =>
      memberRankIds(member, dutyRoles).includes(role.id),
    )
    if (assigned.length > 0) {
      sections.push({
        kind: 'members',
        title: `${choirName} - ${role.name}`,
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
  dutyRoles: DutyRole[] = [],
): MasterListSummaryRow[] {
  const rankCounts = countMembersByRank(members, dutyRoles)
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
    // One count per configured duty role, so the summary reflects the ranks the
    // administrator actually uses instead of a built-in list.
    ...dutyRoles.map(
      (role): MasterListSummaryRow => ({
        kind: 'item',
        category: role.name,
        count: rankCounts.get(role.id) ?? 0,
      }),
    ),
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
  const ranks = memberRankNames(member, dutyRoles)
  if (ranks.length > 0) return ranks.join(', ')
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
