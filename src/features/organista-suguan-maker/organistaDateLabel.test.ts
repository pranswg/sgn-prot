import assert from 'node:assert/strict'
import test from 'node:test'
import { organistaDateLabel } from './organistaDateLabel.ts'

test('formats midweek and weekend date ranges for a selected rehearsal date', () => {
  assert.equal(
    organistaDateLabel('2026-10-14'),
    'October 14-15 (Midweek) and 17-18 (Weekend), 2026',
  )
})

test('formats month and year boundaries without losing a date', () => {
  assert.equal(
    organistaDateLabel('2026-09-30'),
    'September 30-October 1 (Midweek) and 3-4 (Weekend), 2026',
  )
  assert.equal(
    organistaDateLabel('2026-12-30'),
    'December 30-31, 2026 (Midweek) and January 2-3, 2027 (Weekend)',
  )
})

test('returns an empty heading date for no valid selected rehearsal date', () => {
  assert.equal(organistaDateLabel(''), '')
  assert.equal(organistaDateLabel('2026-02-30'), '')
})
