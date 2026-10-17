import assert from 'node:assert/strict'
import { test } from 'node:test'
import { phtMinutesOfDay } from './phDate'

test('phtMinutesOfDay reads the Philippine wall clock, not the device timezone', () => {
  // 08:30 UTC is 16:30 in PHT (UTC+8, no daylight saving).
  assert.equal(phtMinutesOfDay(new Date('2026-10-30T08:30:00Z')), 16 * 60 + 30)
  // Just past midnight in PHT, still the previous day in UTC.
  assert.equal(phtMinutesOfDay(new Date('2026-10-30T16:05:00Z')), 5)
})
