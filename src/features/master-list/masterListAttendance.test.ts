import assert from 'node:assert/strict'
import test from 'node:test'
import type { Member, Trainee } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  buildMasterListAttendanceRows,
  paginateMasterListAttendanceRows,
} from './masterListAttendance.ts'

const voices: VoicePosition[] = [
  { id: 'soprano', name: 'Soprano', shortName: 'S', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
]

function member(
  id: string,
  firstName: string,
  lastName: string,
  gender: Member['gender'],
  voicePosition: string,
): Member {
  return {
    id,
    firstName,
    lastName,
    gender,
    voicePosition,
    membershipType: 'regular',
    isActive: true,
    dateAdded: '2026-01-01',
    positions: [],
  }
}

function trainee(
  id: string,
  firstName: string,
  lastName: string,
  gender: Trainee['gender'],
  status: Trainee['status'] = 'active',
): Trainee {
  return {
    id,
    firstName,
    lastName,
    gender,
    voicePosition: '',
    status,
    dateAdded: '2026-01-01',
  }
}

const members = [
  member('m1', 'Zoe', 'Zulu', 'female', 'soprano'),
  member('m2', 'Amy', 'Alpha', 'female', 'soprano'),
  member('m3', 'Ben', 'Bravo', 'male', 'tenor'),
  member('m4', 'Ian', 'Indigo', 'male', 'not-configured'),
]

test('voice mode includes only selected configured voice sections and members', () => {
  const rows = buildMasterListAttendanceRows(members, voices, ['soprano'])
  assert.deepEqual(
    rows.map((row) =>
      row.kind === 'section'
        ? `section:${row.label}`
        : row.kind === 'member'
          ? `member:${row.member.id}`
          : `trainee:${row.name}`,
    ),
    [
      'section:Soprano',
      'member:m2',
      'member:m1',
    ],
  )
  assert.deepEqual(
    rows
      .filter((row) => row.kind === 'member')
      .map((row) => row.number),
    [1, 2],
  )
})

test('flat mode separates women before men without voice section labels', () => {
  const rows = buildMasterListAttendanceRows(members, voices, null)
  assert.deepEqual(
    rows.map((row) => (row.kind === 'member' ? row.member.id : undefined)),
    ['m2', 'm1', 'm3', 'm4'],
  )
  assert.ok(rows.every((row) => row.kind === 'member'))
})

test('inactive members are excluded from voice sections and the all-members list', () => {
  const roster = [
    ...members,
    { ...member('m5', 'Inactive', 'Singer', 'female', 'soprano'), isActive: false },
    { ...member('m6', 'Inactive', 'Tenor', 'male', 'tenor'), isActive: false },
  ]
  for (const selectedVoices of [['soprano', 'tenor'], null] as const) {
    const rows = buildMasterListAttendanceRows(roster, voices, selectedVoices)
    const listedMemberIds = rows.flatMap((row) =>
      row.kind === 'member' ? [row.member.id] : [],
    )
    assert.deepEqual(listedMemberIds.includes('m5'), false)
    assert.deepEqual(listedMemberIds.includes('m6'), false)
  }
})

test('trainee gender options create only the selected Nagsasanay sections', () => {
  const trainees = [
    trainee('t1', 'Mia', 'Zulu', 'female'),
    trainee('t2', 'Ana', 'Alpha', 'female'),
    trainee('t3', 'Ben', 'Bravo', 'male'),
    trainee('t4', 'Inactive', 'Member', 'male', 'inactive'),
  ]
  const rows = buildMasterListAttendanceRows(
    [],
    voices,
    [],
    trainees,
    true,
    false,
  )

  assert.deepEqual(
    rows.map((row) =>
      row.kind === 'section'
        ? `section:${row.label}`
        : row.kind === 'trainee'
          ? `trainee:${row.name}`
          : `member:${row.member.id}`,
    ),
    ['section:Nagsasanay Men', 'trainee:Ben Bravo'],
  )
})

test('both trainee gender options keep male and female rosters separate', () => {
  const trainees = [
    trainee('t1', 'Mia', 'Zulu', 'female'),
    trainee('t2', 'Ben', 'Bravo', 'male'),
  ]
  const rows = buildMasterListAttendanceRows(
    [],
    voices,
    [],
    trainees,
    true,
    true,
  )
  assert.deepEqual(
    rows
      .filter((row) => row.kind === 'section')
      .map((row) => row.label),
    ['Nagsasanay Men', 'Nagsasanay Women'],
  )
})

test('attendance names default to given-name-first and support surname-first format', () => {
  const singer = {
    ...member('m1', 'Ana', 'Cruz', 'female', 'soprano'),
    middleName: 'Maria',
    suffix: 'Jr.',
  }
  const traineeSinger = trainee('t1', 'Ben', 'Santos', 'male')
  const firstNameFirst = buildMasterListAttendanceRows(
    [singer],
    voices,
    null,
    [traineeSinger],
    true,
    false,
  )
  const lastNameFirst = buildMasterListAttendanceRows(
    [singer],
    voices,
    null,
    [traineeSinger],
    true,
    false,
    true,
  )

  assert.equal(
    firstNameFirst.find((row) => row.kind === 'member')?.name,
    'Ana Maria Cruz Jr.',
  )
  assert.equal(
    firstNameFirst.find((row) => row.kind === 'trainee')?.name,
    'Ben Santos',
  )
  assert.equal(
    lastNameFirst.find((row) => row.kind === 'member')?.name,
    'Cruz, Ana Maria Jr.',
  )
  assert.equal(
    lastNameFirst.find((row) => row.kind === 'trainee')?.name,
    'Santos, Ben',
  )
})

test('uses regular-page space and reserves signatory room only on the final page', () => {
  const sopranoVoices = [
    ...voices,
    { id: 'soprano-2', name: 'Soprano 2', shortName: 'S2', gender: 'female' as const },
  ]
  const roster = [
    ...Array.from({ length: 9 }, (_, index) =>
      member(`s1-${index}`, `Singer${index}`, `One${index}`, 'female', 'soprano'),
    ),
    ...Array.from({ length: 27 }, (_, index) =>
      member(
        `s2-${index}`,
        `Singer${index}`,
        `Two${index}`,
        'female',
        'soprano-2',
      ),
    ),
  ]
  const attendanceRows = buildMasterListAttendanceRows(
    roster,
    sopranoVoices,
    ['soprano', 'soprano-2'],
  )
  attendanceRows.push(
    { kind: 'section', label: 'Nagsasanay Women' },
    ...Array.from({ length: 5 }, (_, index) => ({
      kind: 'trainee' as const,
      name: `Trainee${index}`,
      number: 37 + index,
    })),
  )
  const pages = paginateMasterListAttendanceRows(
    attendanceRows,
    649,
    586,
  )

  assert.equal(pages.length, 2)
  assert.ok(
    pages[1].reduce(
      (height, row) => height + (row.kind === 'section' ? 22 : 26),
      0,
    ) <= 586,
  )
})
