/**
 * Format-helper tests.
 *
 * Small display wrappers over `phDate`. Worth pinning because they guard the
 * "— for anything unusable" contract the UI relies on, and because
 * `formatTime` is the one place a 12-hour label is produced.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { formatAddedDate, formatDate, formatDateLong, formatTime, fullName } from './format.ts'

test('formatDate renders a valid key as a short date', () => {
  assert.equal(formatDate('2026-09-30'), 'Sep 30, 2026')
})

test('formatAddedDate renders a PHT instant or a plain key as a short date', () => {
  assert.equal(formatAddedDate('2026-09-30T19:04:00+08:00'), 'Sep 30, 2026')
  assert.equal(formatAddedDate('2026-09-30'), 'Sep 30, 2026')
})

test('formatAddedDate passes through an unusable value', () => {
  assert.equal(formatAddedDate(''), '—')
  assert.equal(formatAddedDate('garbage'), 'garbage')
})

test('formatDate passes through a value that is not a date key', () => {
  assert.equal(formatDate('not a date'), 'not a date')
  assert.equal(formatDate('2026-13-01'), '2026-13-01')
})

test('empty input renders as an em dash', () => {
  assert.equal(formatDate(''), '—')
  assert.equal(formatDateLong(''), '—')
})

test('formatDateLong includes the weekday and full month', () => {
  assert.equal(formatDateLong('2026-09-30'), 'Wednesday, September 30, 2026')
})

test('formatTime converts 24-hour input to a 12-hour label', () => {
  assert.equal(formatTime('00:00'), '12:00 AM')
  assert.equal(formatTime('09:30'), '9:30 AM')
  assert.equal(formatTime('12:00'), '12:00 PM')
  assert.equal(formatTime('13:05'), '1:05 PM')
  assert.equal(formatTime('19:00'), '7:00 PM')
  assert.equal(formatTime('23:59'), '11:59 PM')
})

test('formatTime leaves an unparseable value alone', () => {
  assert.equal(formatTime(''), '—')
  assert.equal(formatTime('abc'), 'abc')
})

test('fullName joins the two halves', () => {
  assert.equal(fullName('Ana', 'Reyes'), 'Ana Reyes')
})