import assert from 'node:assert/strict'
import test from 'node:test'
import { MASTER_LIST_PAPER_SIZES } from './masterListPaperSizes'
import {
  formatMasterListPdfTimestamp,
  paperSizePoints,
} from './masterListPdfUtils'

test('PDF export supports only A4, Letter, Legal, and Folio', () => {
  assert.deepEqual(
    MASTER_LIST_PAPER_SIZES.map((paper) => paper.label),
    ['A4', 'Letter', 'Legal', 'Folio'],
  )
})

test('paper dimensions are converted to PDF points', () => {
  const a4 = paperSizePoints(210, 297)
  assert.ok(Math.abs(a4.width - 595.28) < 0.01)
  assert.ok(Math.abs(a4.height - 841.89) < 0.01)
})

test('footer timestamp uses the requested date, time, and Manila timezone', () => {
  assert.equal(
    formatMasterListPdfTimestamp(new Date('2026-10-08T07:07:00.000Z')),
    'As of Thursday, October 08, 2026 - 3:07 PM',
  )
})
