import assert from 'node:assert/strict'
import test from 'node:test'
import type { Member, Trainee } from '@/core/types/member'
import type { DutyRole } from '@/core/types/suguan'
import { DEFAULT_VOICE_POSITIONS } from '@/core/constants/voicePositions'
import {
  groupMasterListPdfSections,
  masterListPdfName,
  masterListPdfPosition,
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
  const womenSection = sectionByTitle.get('SAN JOSE CHOIR - Women')
  assert.equal(womenSection?.kind, 'members')
  if (womenSection?.kind === 'members') {
    assert.deepEqual(womenSection.members.map((member) => member.id), [
      'Women singer',
    ])
  }
  const menSection = sectionByTitle.get('SAN JOSE CHOIR - Men')
  assert.equal(menSection?.kind, 'members')
  if (menSection?.kind === 'members') {
    assert.deepEqual(menSection.members.map((member) => member.id), [
      'Men singer',
    ])
  }
  assert.equal(sectionByTitle.has('SAN JOSE CHOIR - Organists'), true)
  assert.equal(sectionByTitle.has('SAN JOSE CHOIR - OIC'), true)
  const traineeSection = sectionByTitle.get(
    'SAN JOSE CHOIR - Nagsasanay Women',
  )
  assert.equal(traineeSection?.kind, 'trainees')
  if (traineeSection?.kind === 'trainees') {
    assert.deepEqual(
      traineeSection.trainees.map((item) => item.id),
      ['Current trainee', 'Inactive trainee'],
    )
  }
})

test('ranking tables follow the requested hierarchy and include future configured roles', () => {
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
      'STA. MONICA CHOIR - Women',
      'STA. MONICA CHOIR - Men',
    ],
  )
  assert.deepEqual(rankingTitles, [
    'STA. MONICA CHOIR - Pangulong Mang-aawit',
    'STA. MONICA CHOIR - Kalihim ng Mang-aawit',
    'STA. MONICA CHOIR - Organists',
    'STA. MONICA CHOIR - OIC',
    'STA. MONICA CHOIR - Choir Coordinator',
  ])
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
    DEFAULT_VOICE_POSITIONS,
    'voice',
  )

  assert.deepEqual(
    sorted.map((member) => member.voicePosition),
    ['soprano-1', 'alto'],
  )
})

test('PDF summary uses stored gender, voice family, positions, and active status', () => {
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
    summarizeMasterList(
      members,
      [
        makeTrainee('Active trainee'),
        makeTrainee('Inactive trainee', { gender: 'male', status: 'inactive' }),
        makeTrainee('Promoted trainee', { status: 'promoted' }),
      ],
      DEFAULT_VOICE_POSITIONS,
    )
      .filter((row) => row.kind === 'item')
      .map(({ category, count }) => [category, count]),
  )

  assert.equal(rows.get('Total Choir Members'), 5)
  assert.equal(rows.get('Female Members'), 2)
  assert.equal(rows.get('Male Members'), 3)
  assert.equal(rows.get('Sopranos'), 1)
  assert.equal(rows.get('Altos'), 1)
  assert.equal(rows.get('Tenors'), 1)
  assert.equal(rows.get('Basses'), 1)
  assert.equal(rows.get('Organists'), 1)
  assert.equal(rows.get('OIC / Other Positions'), 1)
  assert.equal(rows.get('Active Members'), 4)
  assert.equal(rows.get('Inactive Members'), 1)
  assert.equal(rows.get('Total Trainees'), 2)
  assert.equal(rows.get('Female Trainees'), 1)
  assert.equal(rows.get('Male Trainees'), 1)
  assert.equal(rows.get('Active Trainees'), 1)
  assert.equal(rows.get('Inactive Trainees'), 1)
})

test('PDF rows preserve full member names and show stored positions', () => {
  const member = makeMember('Ana', {
    firstName: 'Ana',
    middleName: 'Maria',
    lastName: 'Santos',
    suffix: 'Jr.',
    positions: ['oic'],
  })

  assert.equal(masterListPdfName(member), 'Santos, Ana Maria Jr.')
  assert.equal(masterListPdfPosition(member), 'OIC')
  assert.equal(
    masterListPdfPosition(makeMember('Singer')),
    'Mang-aawit',
  )
})
