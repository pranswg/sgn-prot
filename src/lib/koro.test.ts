import assert from 'node:assert/strict'
import test from 'node:test'
import type { KoroDocument } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  assignmentsFromKoro,
  balanceKoroVoiceSections,
  buildKoroSuguanVoiceSections,
  createKoroDocument,
  koroDayLabel,
  suguanFromKoro,
} from './koro.ts'

const member: Member = {
  id: 'member-1',
  firstName: 'Maria',
  lastName: 'Santos',
  gender: 'female',
  voicePosition: 'alto',
  membershipType: 'regular',
  isActive: true,
  dateAdded: '2026-01-01',
  positions: [],
}

const TEST_VOICES: VoicePosition[] = [
  { id: 'soprano-1', name: 'Soprano 1', shortName: 'S1', gender: 'female' },
  { id: 'soprano-2', name: 'Soprano 2', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

function documentWithMember(): KoroDocument {
  const document = createKoroDocument()
  document.title = 'Thanksgiving'
  document.date = '2026-07-25'
  document.group = 'babae'
  document.tables[0].title = 'PRINCIPAL CHOIR GROUP'
  document.tables[0].rows[0].cells[0] = {
    memberId: member.id,
    firstName: member.firstName,
    voicePosition: 'soprano-1',
  }
  return document
}

test('Koro documents default to Mixed on three tiers of 10/10/14 seats, back to front', () => {
  const document = createKoroDocument()
  const table = document.tables[0]
  assert.equal(document.group, 'mixed')
  assert.equal(document.exportFontSize, 'large')
  assert.equal(table.rows.length, 3)
  assert.deepEqual(
    table.rows.map((row) => row.cells.length),
    [10, 10, 14],
  )
  assert.ok(table.rows.flatMap((row) => row.cells).every((cell) => !cell.memberId))
})

test('Koro derives a Filipino weekday from the service date', () => {
  assert.equal(koroDayLabel('2026-07-25'), 'SABADO')
  assert.equal(koroDayLabel(''), '')
})

test('Koro assignments carry the full member name with the last name first', () => {
  const document = documentWithMember()
  const assignments = assignmentsFromKoro(document, [member])
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0].memberName, 'Santos, Maria')
  assert.equal(assignments[0].voicePosition, 'soprano-1')
})

test('direct Suguan groups names by effective voice and balances sections across panels', () => {
  const document = documentWithMember()
  const sopranoTwoMember: Member = {
    ...member,
    id: 'member-2',
    firstName: 'Ana',
    voicePosition: 'soprano-2',
  }
  const altoMember: Member = {
    ...member,
    id: 'member-3',
    firstName: 'Liza',
    voicePosition: 'alto',
  }
  document.tables[0].rows[0].cells[1] = {
    memberId: sopranoTwoMember.id,
    firstName: sopranoTwoMember.firstName,
    voicePosition: '',
  }
  document.tables[0].rows[0].cells[2] = {
    memberId: altoMember.id,
    firstName: altoMember.firstName,
    voicePosition: '',
  }

  const sections = buildKoroSuguanVoiceSections(
    document,
    [member, sopranoTwoMember, altoMember],
    TEST_VOICES,
  )
  assert.deepEqual(
    sections.map(({ voicePosition, label, members }) => ({
      voicePosition,
      label,
      members,
    })),
    [
      {
        voicePosition: 'soprano',
        label: 'SOPRANO',
        members: ['Santos, Maria', 'Santos, Ana'],
      },
      { voicePosition: 'alto', label: 'ALTO', members: ['Santos, Liza'] },
    ],
  )
  const [left, right] = balanceKoroVoiceSections(sections)
  assert.equal(left.length, 1)
  assert.equal(right.length, 1)
})

test('direct Suguan conversion carries date, choir group, tables, and full names', () => {
  const document = documentWithMember()
  const suguan = suguanFromKoro(document, [member])

  assert.equal(suguan.date, document.date)
  assert.equal(suguan.group, 'babae')
  assert.equal(suguan.events[0].date, document.date)
  assert.equal(suguan.schedules[0].scheduleLabel, 'PRINCIPAL CHOIR GROUP')
  assert.equal(suguan.schedules[0].assignments[0].memberName, 'Santos, Maria')
  assert.equal(suguan.schedules[0].assignments[0].voicePosition, 'soprano-1')
})
