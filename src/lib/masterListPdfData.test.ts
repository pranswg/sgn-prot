import assert from 'node:assert/strict'
import test from 'node:test'
import type { Member, Trainee } from '@/core/types/member'
import type { DutyRole } from '@/core/types/suguan'
import type { VoicePosition } from '@/core/types/suguan'
import {
  groupMasterListPdfSections,
  masterListPdfName,
  masterListPdfPosition,
  masterListPdfVoice,
  sortMasterListPdfMembers,
  splitMasterListPdfSections,
  summarizeMasterList,
} from './masterListPdfData'

const DUTY_ROLES: DutyRole[] = [
  { id: 'oic', name: 'OIC', abbreviation: 'OIC' },
  {
    id: 'pangulong-mang-aawit',
    name: 'Pangulong Mang-aawit',
    abbreviation: 'PM',
  },
  { id: 'kalihim', name: 'Kalihim ng Mang-aawit', abbreviation: 'KM' },
  { id: 'organista', name: 'Organista', abbreviation: 'ORG' },
  { id: 'organista-reserve', name: 'Reserve Organist', abbreviation: 'RO' },
  { id: 'choir-coordinator', name: 'Choir Coordinator', abbreviation: 'CC' },
]

const TEST_VOICES: VoicePosition[] = [
  { id: 'soprano-1', name: 'Soprano 1', shortName: 'S1', gender: 'female' },
  { id: 'soprano-2', name: 'Soprano 2', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

function makeMember(
  id: string,
  options: Partial<Member> = {},
): Member {
  return {
    id,
    firstName: id,
    lastName: 'Member',
    gender: 'female',
    voicePosition: 'soprano-1',
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
    ...options,
  }
}

function makeTrainee(
  id: string,
  options: Partial<Trainee> = {},
): Trainee {
  return {
    id,
    firstName: id,
    lastName: 'Trainee',
    gender: 'female',
    voicePosition: 'unassigned',
    status: 'active',
    dateAdded: '2026-01-01',
    ...options,
  }
}

test('master list PDF groups regular singers, special positions, and current trainees', () => {
  const womenSinger = makeMember('Women singer')
  const menSinger = makeMember('Men singer', {
    gender: 'male',
    voicePosition: 'tenor',
  })
  const organist = makeMember('Organist', {
    membershipType: 'organista',
    voicePosition: 'alto',
  })
  const assistant = makeMember('Assistant', {
    membershipType: 'assistant-tagapagturo',
  })
  const officer = makeMember('Officer', {
    membershipType: 'organista',
    positions: ['oic'],
  })
  const trainee = makeTrainee('Current trainee')
  const sections = groupMasterListPdfSections(
    [womenSinger, menSinger, organist, assistant, officer],
    [
      trainee,
      makeTrainee('Inactive trainee', { status: 'inactive' }),
      makeTrainee('Promoted trainee', { status: 'promoted' }),
      makeTrainee('Removed trainee', { status: 'removed' }),
    ],
    'San Jose',
    DUTY_ROLES,
  )

  const sectionByTitle = new Map(sections.map((section) => [section.title, section]))
  const womenSection = sectionByTitle.get('AWS SAN JOSE CHOIR - Women')
  assert.equal(womenSection?.kind, 'members')
  if (womenSection?.kind === 'members') {
    assert.deepEqual(womenSection.members.map((member) => member.id), [
      'Women singer',
    ])
  }
  const menSection = sectionByTitle.get('AWS SAN JOSE CHOIR - Men')
  assert.equal(menSection?.kind, 'members')
  if (menSection?.kind === 'members') {
    assert.deepEqual(menSection.members.map((member) => member.id), [
      'Men singer',
    ])
  }
  // The organist-family memberships count as the configured Organista rank, so
  // the section is titled after the role the administrator named.
  const organistaSection = sectionByTitle.get('AWS SAN JOSE CHOIR - Organista')
  assert.equal(organistaSection?.kind, 'members')
  if (organistaSection?.kind === 'members') {
    assert.deepEqual(organistaSection.members.map((member) => member.id), [
      'Organist',
      'Assistant',
      'Officer',
    ])
  }
  assert.equal(sectionByTitle.has('AWS SAN JOSE CHOIR - OIC'), true)
  const traineeSection = sectionByTitle.get(
    'AWS SAN JOSE CHOIR - Nagsasanay Women',
  )
  assert.equal(traineeSection?.kind, 'trainees')
  if (traineeSection?.kind === 'trainees') {
    assert.deepEqual(
      traineeSection.trainees.map((item) => item.id),
      ['Current trainee', 'Inactive trainee'],
    )
  }
})

test('AWS ranking tables follow the configured duty-role order and include future configured roles', () => {
  const members = [
    makeMember('President', {
      positions: ['pangulong-mang-aawit'],
    }),
    makeMember('Secretary', {
      positions: ['kalihim-ng-mang-aawit'],
    }),
    makeMember('Organist', { membershipType: 'organista' }),
    makeMember('OIC', { positions: ['oic'] }),
    makeMember('Coordinator', {
      assignedDutyRoleIds: ['choir-coordinator'],
    }),
  ]
  const sections = groupMasterListPdfSections(
    members,
    [],
    'Sta. Monica',
    DUTY_ROLES,
  )
  const { contentSections, hierarchySections } =
    splitMasterListPdfSections(sections)
  const rankingTitles = hierarchySections
    .map((section) => section.title)
    .filter((title) => !title.includes('- Women') && !title.includes('- Men'))

  assert.deepEqual(
    contentSections.map((section) => section.title),
    [
      'AWS STA. MONICA CHOIR - Women',
      'AWS STA. MONICA CHOIR - Men',
    ],
  )
  // One section per configured role, in the order Settings holds them, and a
  // role nobody holds is skipped. The ids are not the old fixed ones, so the
  // legacy stored positions only match their role by name.
  assert.deepEqual(rankingTitles, [
    'AWS STA. MONICA CHOIR - OIC',
    'AWS STA. MONICA CHOIR - Pangulong Mang-aawit',
    'AWS STA. MONICA CHOIR - Kalihim ng Mang-aawit',
    'AWS STA. MONICA CHOIR - Organista',
    'AWS STA. MONICA CHOIR - Choir Coordinator',
  ])
})

test('PNK sections use the choir prefix, omit rankings, and export members as Soprano 2', () => {
  const member = makeMember('PNK singer', {
    voicePosition: 'soprano-1',
    assignedDutyRoleIds: ['pangulong-mang-aawit'],
    choir: 'pnk',
  })
  const sections = groupMasterListPdfSections(
    [member],
    [],
    'Sta. Monica',
    DUTY_ROLES,
    'pnk',
  )

  assert.deepEqual(
    sections.map((section) => section.title),
    ['PNK STA. MONICA CHOIR - Babae', 'PNK STA. MONICA CHOIR - Lalaki'],
  )
  assert.equal(
    masterListPdfVoice(member, TEST_VOICES, 'pnk'),
    'Soprano 2',
  )
})

test('singer tables are ordered by voice section and then by surname', () => {
  const alto = makeMember('Alto singer', {
    firstName: 'Amy',
    lastName: 'Alto',
    voicePosition: 'alto',
  })
  const soprano = makeMember('Soprano singer', {
    firstName: 'Zoe',
    lastName: 'Soprano',
    voicePosition: 'soprano-1',
  })
  const sorted = sortMasterListPdfMembers(
    [alto, soprano],
    TEST_VOICES,
    'voice',
  )

  assert.deepEqual(
    sorted.map((member) => member.voicePosition),
    ['soprano-1', 'alto'],
  )
})

test('Master List summary contains only the requested total and status counts', () => {
  const members = [
    makeMember('Soprano', { voicePosition: 'soprano-2' }),
    makeMember('Alto', { voicePosition: 'alto', isActive: false }),
    makeMember('Tenor', {
      gender: 'male',
      voicePosition: 'tenor',
    }),
    makeMember('Bass', {
      gender: 'male',
      voicePosition: 'bass',
    }),
    makeMember('Organist', {
      gender: 'male',
      membershipType: 'organista',
      positions: ['oic'],
    }),
  ]
  const rows = new Map(
    summarizeMasterList(members, [
      makeTrainee('Active trainee'),
      makeTrainee('Inactive trainee', { gender: 'male', status: 'inactive' }),
      makeTrainee('Promoted trainee', { status: 'promoted' }),
    ])
      .filter((row) => row.kind === 'item')
      .map(({ category, count }) => [category, count]),
  )

  assert.deepEqual([...rows.keys()], [
    'Total Choir Members',
    'Female Members',
    'Male Members',
    'Active Members',
    'Inactive Members',
    'Trainees / Nagsasanay',
  ])
  assert.equal(rows.get('Total Choir Members'), 5)
  assert.equal(rows.get('Female Members'), 2)
  assert.equal(rows.get('Male Members'), 3)
  assert.equal(rows.get('Active Members'), 4)
  assert.equal(rows.get('Inactive Members'), 1)
  assert.equal(rows.get('Trainees / Nagsasanay'), 2)
})

test('AWS Master List summary includes voice counts while PNK keeps its summary compact', () => {
  const members = [
    makeMember('Soprano 1', { voicePosition: 'soprano-1' }),
    makeMember('Soprano 2', { voicePosition: 'soprano-2' }),
    makeMember('Alto', { voicePosition: 'alto' }),
    makeMember('Tenor', { gender: 'male', voicePosition: 'tenor' }),
    makeMember('Bass', { gender: 'male', voicePosition: 'bass' }),
    makeMember('Unknown voice', { voicePosition: 'legacy-voice' }),
  ]
  const awsRows = summarizeMasterList(members, [], TEST_VOICES)

  assert.deepEqual(awsRows.slice(6), [
    { kind: 'section', category: 'Voice Positions' },
    { kind: 'item', category: 'Soprano 1', count: 1 },
    { kind: 'item', category: 'Soprano 2', count: 1 },
    { kind: 'item', category: 'Alto', count: 1 },
    { kind: 'item', category: 'Tenor', count: 1 },
    { kind: 'item', category: 'Bass', count: 1 },
  ])
  assert.equal(
    summarizeMasterList(members, [], TEST_VOICES, 'pnk').length,
    6,
  )
})

test('PDF rows preserve full member names and show configured ranks', () => {
  const member = makeMember('Ana', {
    firstName: 'Ana',
    middleName: 'Maria',
    lastName: 'Santos',
    suffix: 'Jr.',
    positions: ['oic'],
  })

  assert.equal(masterListPdfName(member), 'Santos, Ana Maria Jr.')
  assert.equal(masterListPdfPosition(member, DUTY_ROLES), 'OIC')
  assert.equal(
    masterListPdfPosition(makeMember('Singer'), DUTY_ROLES),
    'Mang-aawit',
  )
})
