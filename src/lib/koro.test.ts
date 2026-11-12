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
  buildKoroTableVoiceSections,
  createKoroDocument,
  createKoroTable,
  duplicateKoroDocument,
  duplicateKoroTable,
  fillKoroDocument,
  fillKoroTable,
  formatKoroTime,
  koroDayLabel,
  moveKoroSeat,
  normalizeKoroDocument,
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

test('duplicating a table copies its formation and every seated member under fresh ids', () => {
  const document = documentWithMember()
  const source = document.tables[0]
  const copy = duplicateKoroTable(source)
  assert.notEqual(copy.id, source.id)
  assert.equal(copy.title, 'PRINCIPAL CHOIR GROUP (copy)')
  assert.deepEqual(
    copy.rows.map((row) => row.cells.length),
    source.rows.map((row) => row.cells.length),
  )
  assert.notEqual(copy.rows[0].id, source.rows[0].id)
  assert.deepEqual(copy.rows[0].cells[0], source.rows[0].cells[0])
  assert.equal(copy.rows[0].cells[0].memberId, member.id)
})

test('dragging a seated member onto an empty seat in another table moves them there', () => {
  const first = createKoroTable('Table 1')
  const second = createKoroTable('Table 2')
  first.rows[0].cells[0] = {
    memberId: member.id,
    firstName: member.firstName,
    voicePosition: 'soprano-1',
  }
  const next = moveKoroSeat(
    [first, second],
    { tableId: first.id, rowIndex: 0, columnIndex: 0 },
    { tableId: second.id, rowIndex: 1, columnIndex: 2 },
  )
  assert.equal(next[0].rows[0].cells[0].memberId, null)
  assert.equal(next[1].rows[1].cells[2].memberId, member.id)
})

test('dragging a member onto a filled seat in another table trades the two', () => {
  const first = createKoroTable('Table 1')
  const second = createKoroTable('Table 2')
  first.rows[0].cells[0] = { memberId: 'a', firstName: 'Ann', voicePosition: 'alto' }
  second.rows[2].cells[3] = { memberId: 'b', firstName: 'Bea', voicePosition: 'alto' }
  const next = moveKoroSeat(
    [first, second],
    { tableId: first.id, rowIndex: 0, columnIndex: 0 },
    { tableId: second.id, rowIndex: 2, columnIndex: 3 },
  )
  assert.equal(next[0].rows[0].cells[0].memberId, 'b')
  assert.equal(next[1].rows[2].cells[3].memberId, 'a')
})

test('dragging a seat onto itself and onto a missing seat leave the tables unchanged', () => {
  const first = createKoroTable('Table 1')
  first.rows[0].cells[0] = { memberId: 'a', firstName: 'Ann', voicePosition: 'alto' }
  const same = moveKoroSeat(
    [first],
    { tableId: first.id, rowIndex: 0, columnIndex: 0 },
    { tableId: first.id, rowIndex: 0, columnIndex: 0 },
  )
  assert.equal(same[0].rows[0].cells[0].memberId, 'a')
  const missing = moveKoroSeat(
    [first],
    { tableId: 'nope', rowIndex: 0, columnIndex: 0 },
    { tableId: first.id, rowIndex: 0, columnIndex: 1 },
  )
  assert.equal(missing[0].rows[0].cells[0].memberId, 'a')
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

test('filling a table leaves a reserved labelled seat untouched', () => {
  const document = createKoroDocument()
  const table = document.tables[0]
  table.rows[0].cells[0] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  const candidates: Member[] = [{ ...member, id: 'ana', firstName: 'Ana' }]
  const filled = fillKoroTable(table, candidates, new Set())
  assert.equal(filled.rows[0].cells[0].label, 'Organ')
  assert.equal(filled.rows[0].cells[0].memberId, null)
  // The candidate lands in the next empty seat instead of the organ seat.
  assert.equal(filled.rows[0].cells[1].memberId, 'ana')
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

test('a new table seeds its own date and time and a fresh table leaves them blank', () => {
  const seeded = createKoroTable('G1', [2], {
    date: '2026-11-11',
    time: '6:00AM',
  })
  assert.equal(seeded.date, '2026-11-11')
  assert.equal(seeded.time, '6:00AM')
  const fresh = createKoroTable('G2', [2])
  assert.deepEqual({ date: fresh.date, time: fresh.time }, { date: '', time: '' })
})

test('a new document defaults to no occasion title and its first table carries the service date', () => {
  const document = createKoroDocument()
  assert.equal(document.title, '')
  assert.equal(document.tables[0].date, document.date)
  assert.equal(document.tables[0].time, '06:00')
})

test('formatKoroTime renders the picker value in the sheet 12-hour style', () => {
  assert.equal(formatKoroTime('06:00'), '6:00AM')
  assert.equal(formatKoroTime('12:00'), '12:00PM')
  assert.equal(formatKoroTime('18:30'), '6:30PM')
  assert.equal(formatKoroTime('00:15'), '12:15AM')
  assert.equal(formatKoroTime(''), '')
  // A legacy free-text value is printed uppercased, not parsed.
  assert.equal(formatKoroTime('6:00AM'), '6:00AM')
})

test('normalizing a legacy document backfills each table date and time', () => {
  const legacy = {
    id: 'd',
    title: 'T',
    date: '2026-07-25',
    serviceTime: '6:00AM',
    group: 'mixed',
    createdAt: '',
    updatedAt: '',
    tables: [
      {
        id: 't1',
        title: 'PRINCIPAL',
        // The date and time fields are absent, as they were before version 2.
        rows: [],
      },
    ],
  } as unknown as KoroDocument
  const normalized = normalizeKoroDocument(legacy)
  assert.equal(normalized.tables[0].date, '2026-07-25')
  assert.equal(normalized.tables[0].time, '6:00AM')
})

test('normalizing keeps a table that already owns its date and time', () => {
  const document = createKoroDocument()
  document.tables[0].date = '2026-01-01'
  document.tables[0].time = '7:30PM'
  const normalized = normalizeKoroDocument(document)
  assert.equal(normalized.tables[0].date, '2026-01-01')
  assert.equal(normalized.tables[0].time, '7:30PM')
})

test('per-table voice sections only read that table', () => {
  const document = createKoroDocument()
  const first = document.tables[0]
  first.rows[0].cells[0] = {
    memberId: 'kim',
    firstName: 'Kim',
    voicePosition: 'alto',
  }
  const second = createKoroTable('G2', [2])
  second.rows[0].cells[0] = {
    memberId: 'ana',
    firstName: 'Ana',
    voicePosition: 'alto',
  }
  const alto: VoicePosition = {
    id: 'alto',
    name: 'Alto',
    shortName: 'A',
    gender: 'female',
  }
  const firstSections = buildKoroTableVoiceSections(first, [], [alto])
  const secondSections = buildKoroTableVoiceSections(second, [], [alto])
  assert.deepEqual(
    firstSections.find((section) => section.label === 'ALTO')?.members,
    ['Kim'],
  )
  assert.deepEqual(
    secondSections.find((section) => section.label === 'ALTO')?.members,
    ['Ana'],
  )
})
