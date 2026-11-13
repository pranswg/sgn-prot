import assert from 'node:assert/strict'
import test from 'node:test'
import type { KoroDocument } from '@/core/types/koro'
import { createKoroDocument, createKoroTable } from './koro.ts'
import {
  koroColumnWidthsMm,
  koroDocumentCounts,
  koroMergedSeats,
  koroPlacedMemberIds,
  koroPlacedSeatLabels,
  koroReservedColumns,
  koroRosterByVoice,
  koroSeatKey,
  koroSeatLabelsByService,
  koroSeatLocationsByMember,
  koroTableCounts,
  koroTierLabel,
} from './koroLayout.ts'

function seat(
  document: KoroDocument,
  rowIndex: number,
  columnIndex: number,
  memberId: string,
  voicePosition = 'alto',
) {
  document.tables[0].rows[rowIndex].cells[columnIndex] = {
    memberId,
    firstName: memberId,
    voicePosition,
  }
}

test('rows are numbered from the bottom of the chart up', () => {
  assert.equal(koroTierLabel(2, 3), 'Row 1')
  assert.equal(koroTierLabel(1, 3), 'Row 2')
  assert.equal(koroTierLabel(0, 3), 'Row 3')
  assert.equal(koroTierLabel(0, 1), 'Row 1')
})

test('seat keys are stable per table, row and column', () => {
  assert.equal(koroSeatKey('t1', 2, 14), 't1:2:14')
})

test('table counts report capacities per tier and the filled total', () => {
  const document = createKoroDocument()
  seat(document, 2, 0, 'ana')
  seat(document, 2, 1, 'liza')
  const counts = koroTableCounts(document.tables[0])
  assert.equal(counts.seats, 34)
  assert.equal(counts.filled, 2)
  assert.deepEqual(
    counts.tiers.map((tier) => tier.label),
    ['Row 3', 'Row 2', 'Row 1'],
  )
  assert.deepEqual(
    counts.tiers.map((tier) => tier.capacity),
    [10, 10, 14],
  )
  assert.equal(counts.tiers[2].filled, 2)
})

test('a cleared cell keeps its voice but is not counted as seated', () => {
  const document = createKoroDocument()
  document.tables[0].rows[0].cells[0] = {
    memberId: null,
    firstName: '',
    voicePosition: 'soprano-1',
  }
  const counts = koroDocumentCounts(document)
  assert.equal(counts.filled, 0)
  assert.equal(counts.empty, counts.seats)
  assert.equal(counts.byVoice['soprano-1'], undefined)
})

test('document counts group seats by voice and flag a member seated twice', () => {
  const document = createKoroDocument()
  seat(document, 0, 0, 'kim', 'soprano-1')
  seat(document, 1, 0, 'ana', 'soprano-2')
  seat(document, 2, 0, 'kim', 'soprano-1')
  const counts = koroDocumentCounts(document)
  assert.equal(counts.filled, 3)
  assert.equal(counts.empty, counts.seats - 3)
  assert.deepEqual(counts.byVoice, { 'soprano-1': 2, 'soprano-2': 1 })
  assert.deepEqual(counts.duplicatedMemberIds, ['kim'])
})

test('placed ids ignore cleared cells that still carry a name', () => {
  const document = createKoroDocument()
  document.tables[0].rows[0].cells[0] = {
    memberId: null,
    firstName: 'Ghost',
    voicePosition: '',
  }
  seat(document, 0, 1, 'kim')
  assert.deepEqual([...koroPlacedMemberIds(document)], ['kim'])
})

test('placed seat labels name the table, row and seat of each seated member', () => {
  const document = createKoroDocument()
  document.tables.push({ ...document.tables[0], id: 'second-table', rows: document.tables[0].rows.map((row) => ({ ...row, id: `${row.id}-b`, cells: row.cells.map((cell) => ({ ...cell })) })) })
  document.tables[1].rows[0].cells[2] = {
    memberId: 'kim',
    firstName: 'Kim',
    voicePosition: 'alto',
  }
  const labels = koroPlacedSeatLabels(document)
  // Row 1 is the bottom row, so the top row of a three-row table is Row 3.
  assert.equal(labels.get('kim'), 'Table 2 · Row 3 seat 3')
  assert.equal(labels.size, 1)
})

test('seat locations list every table a duplicated member sits in', () => {
  const document = createKoroDocument()
  document.tables.push({ ...document.tables[0], id: 'second-table', rows: document.tables[0].rows.map((row) => ({ ...row, id: `${row.id}-b`, cells: row.cells.map((cell) => ({ ...cell })) })) })
  seat(document, 0, 0, 'kim')
  document.tables[1].rows[0].cells[2] = {
    memberId: 'kim',
    firstName: 'kim',
    voicePosition: 'alto',
  }
  document.tables[1].rows[1].cells[1] = {
    memberId: 'joan',
    firstName: 'joan',
    voicePosition: 'tenor',
  }
  const locations = koroSeatLocationsByMember(document)
  assert.deepEqual(locations.get('kim'), [
    'Table 1 · Row 3 seat 1',
    'Table 2 · Row 3 seat 3',
  ])
  assert.deepEqual(locations.get('joan'), ['Table 2 · Row 2 seat 2'])
})

test('seats split by service block a same date-and-time repeat and only flag a different one', () => {
  const document = createKoroDocument()
  const cloneRows = () =>
    document.tables[0].rows.map((row) => ({
      ...row,
      id: `${row.id}-copy`,
      cells: row.cells.map((cell) => ({ ...cell })),
    }))
  // Table 1 and Table 2 share the same date and time; Table 3 is a different service.
  document.tables[0].date = '2026-07-25'
  document.tables[0].time = '06:00'
  document.tables.push({ ...document.tables[0], id: 'same-service', rows: cloneRows() })
  document.tables.push({ ...document.tables[0], id: 'other-service', date: '2026-07-25', time: '18:00', rows: cloneRows() })

  // Kim already sits in Table 1 (same service as the target) and Table 3 (different service).
  document.tables[0].rows[0].cells[0] = { memberId: 'kim', firstName: 'Kim', voicePosition: 'alto' }
  document.tables[2].rows[1].cells[1] = { memberId: 'kim', firstName: 'Kim', voicePosition: 'alto' }

  const labels = koroSeatLabelsByService(document, 'same-service', 'kim')
  assert.deepEqual(labels.sameService, ['Table 1 · Row 3 seat 1'])
  assert.deepEqual(labels.otherService, ['Table 3 · Row 2 seat 2'])
})

test('a member seated nowhere has no service labels', () => {
  const document = createKoroDocument()
  const labels = koroSeatLabelsByService(document, document.tables[0].id, 'kim')
  assert.deepEqual(labels, { sameService: [], otherService: [] })
})

test('roster counts skip members without a voice', () => {
  assert.deepEqual(
    koroRosterByVoice([
      { voicePosition: 'alto' },
      { voicePosition: 'alto' },
      { voicePosition: '' },
    ]),
    { alto: 2 },
  )
})

test('a reserved seat fuses with the blank seats above and below it', () => {
  const table = createKoroTable('KORO', [10, 10, 10])
  table.rows[1].cells[5] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  // Rows 0 and 2 are blank in column 5, so the organ covers all three rows.
  assert.deepEqual(koroMergedSeats(table.rows), [
    { rowIndex: 1, columnIndex: 5, startRow: 0, endRow: 2 },
  ])
})

test('a reserved seat stops at a filled, labelled, or differently sized row', () => {
  const table = createKoroTable('KORO', [10, 10, 10])
  table.rows[1].cells[5] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  table.rows[2].cells[5] = {
    memberId: 'kim',
    firstName: 'Kim',
    voicePosition: 'alto',
  }
  assert.deepEqual(koroMergedSeats(table.rows), [
    { rowIndex: 1, columnIndex: 5, startRow: 0, endRow: 1 },
  ])

  // Two reserved seats cannot share one block, so neither expands.
  table.rows[0].cells[5] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Piano',
  }
  assert.deepEqual(koroMergedSeats(table.rows), [])

  // The default formation's front row is wider, so the columns no longer line up.
  const document = createKoroDocument()
  const rows = document.tables[0].rows
  rows[1].cells[3] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  assert.deepEqual(koroMergedSeats(rows), [
    { rowIndex: 1, columnIndex: 3, startRow: 0, endRow: 1 },
  ])
})

test('only a labelled seat has a merge span', () => {
  const document = createKoroDocument()
  assert.deepEqual(koroMergedSeats(document.tables[0].rows), [])
})

test('a reserved seat takes two shares of its row and widens matching rows', () => {
  const table = createKoroTable('KORO', [6, 6, 8])
  table.rows[1].cells[2] = {
    memberId: null,
    firstName: '',
    voicePosition: '',
    label: 'Organ',
  }
  const reserved = koroReservedColumns(table.rows)
  assert.deepEqual([...(reserved.get(6) ?? [])], [2])
  // The wider front row starts its columns differently, so it is untouched.
  assert.equal(reserved.get(8), undefined)

  const widths = koroColumnWidthsMm(table.rows[0], reserved, 60)
  assert.equal(widths.length, 6)
  assert.ok(Math.abs(widths[2] - widths[0] * 2) < 1e-9)
  assert.ok(Math.abs(widths.reduce((sum, width) => sum + width, 0) - 60) < 1e-9)

  const wideRow = koroColumnWidthsMm(table.rows[2], reserved, 60)
  assert.ok(wideRow.every((width) => Math.abs(width - 60 / 8) < 1e-9))
})

test('a formation without reserved seats divides every row evenly', () => {
  const document = createKoroDocument()
  const reserved = koroReservedColumns(document.tables[0].rows)
  assert.equal(reserved.size, 0)
  const widths = koroColumnWidthsMm(document.tables[0].rows[0], reserved, 100)
  assert.ok(widths.every((width) => Math.abs(width - 10) < 1e-9))
})
