import assert from 'node:assert/strict'
import test from 'node:test'
import type { KoroDocument } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  addKoroRow,
  addKoroSeat,
  assignmentsFromKoro,
  balanceKoroVoiceSections,
  buildKoroSuguanVoiceSections,
  createKoroDocument,
  duplicateKoroDocument,
  fillKoroDocument,
  fillKoroTable,
  koroDayLabel,
  removeKoroRow,
  removeKoroSeat,
  suguanFromKoro,
  swapKoroSeats,
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

test('seat and tier transforms keep the grid rectangular and non-empty', () => {
  const document = createKoroDocument()
  const table = document.tables[0]
  const front = table.rows[2]

  const widened = addKoroSeat(table, front.id)
  assert.equal(widened.rows[2].cells.length, 15)
  assert.equal(widened.rows[0].cells.length, 10)

  const narrowed = removeKoroSeat(widened, front.id)
  assert.equal(narrowed.rows[2].cells.length, 14)

  const added = addKoroRow(table)
  assert.equal(added.rows.length, 4)
  assert.equal(added.rows[3].cells.length, 15)

  const removed = removeKoroRow(table, table.rows[1].id)
  assert.equal(removed.rows.length, 2)
  const single = { ...removed, rows: removed.rows.slice(0, 1) }
  assert.equal(removeKoroRow(single, single.rows[0].id).rows.length, 1)
})

test('duplicating a Koro re-keys its tables and rows under a copy title', () => {
  const document = createKoroDocument()
  const copy = duplicateKoroDocument(document)
  assert.notEqual(copy.id, document.id)
  assert.equal(copy.title, 'Special Occasion Koro (copy)')
  assert.equal(copy.tables.length, document.tables.length)
  assert.notEqual(copy.tables[0].id, document.tables[0].id)
  assert.notEqual(copy.tables[0].rows[0].id, document.tables[0].rows[0].id)
  assert.equal(copy.tables[0].rows[0].cells.length, 10)
})

test('swapping two seats exchanges their occupants', () => {
  const document = createKoroDocument()
  const table = document.tables[0]
  table.rows[0].cells[0] = { memberId: 'kim', firstName: 'Kim', voicePosition: 'alto' }
  table.rows[2].cells[13] = { memberId: 'ana', firstName: 'Ana', voicePosition: 'bass' }
  const swapped = swapKoroSeats(
    table,
    { rowIndex: 0, columnIndex: 0 },
    { rowIndex: 2, columnIndex: 13 },
  )
  assert.equal(swapped.rows[0].cells[0].memberId, 'ana')
  assert.equal(swapped.rows[2].cells[13].memberId, 'kim')
  // The original table is untouched.
  assert.equal(table.rows[0].cells[0].memberId, 'kim')
})

test('filling a table seats candidates in empty seats only, skipping placed members', () => {
  const document = createKoroDocument()
  const table = document.tables[0]
  table.rows[0].cells[0] = { memberId: 'kim', firstName: 'Kim', voicePosition: 'alto' }
  const candidates: Member[] = [
    { ...member, id: 'kim', firstName: 'Kim' },
    { ...member, id: 'ana', firstName: 'Ana' },
  ]
  const filled = fillKoroTable(table, candidates, new Set(['kim']))
  assert.equal(filled.rows[0].cells[0].memberId, 'kim')
  assert.equal(filled.rows[0].cells[1].memberId, 'ana')
  assert.equal(filled.rows[0].cells[2].memberId, null)
})

test('filling a document stops once the candidates run out', () => {
  const document = createKoroDocument()
  const candidates: Member[] = [{ ...member, id: 'ana', firstName: 'Ana' }]
  const filled = fillKoroDocument(document, candidates)
  const seated = filled.tables[0].rows[0].cells.filter((cell) => cell.memberId)
  assert.equal(seated.length, 1)
  assert.equal(seated[0].memberId, 'ana')
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
