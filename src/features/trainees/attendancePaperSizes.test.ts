import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ATTENDANCE_PAPER_SIZES,
  DEFAULT_ATTENDANCE_PAPER_SIZE,
} from './attendancePaperSizes.ts'

test('Folio is the default attendance paper with 8.5 × 13 inch dimensions', () => {
  assert.equal(DEFAULT_ATTENDANCE_PAPER_SIZE, 'folio')
  assert.deepEqual(
    ATTENDANCE_PAPER_SIZES.find((paper) => paper.id === 'folio'),
    { id: 'folio', label: 'Folio', width: 215.9, height: 330.2 },
  )
})
