/**
 * Filtering tests for the Members History page.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EMPTY_HISTORY_FILTERS,
  filterMemberHistory,
} from './memberHistoryFilter.ts'
import type { Member, MemberHistoryEvent } from '@/core/types/member.ts'

const event = (
  type: MemberHistoryEvent['type'],
  date: string,
): MemberHistoryEvent => ({
  id: `${type}-${date}`,
  type,
  date,
  createdAt: `${date}T00:00:00+08:00`,
})

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 'm1',
  firstName: 'Maria',
  lastName: 'Dela Cruz',
  gender: 'female',
  voicePosition: 'soprano-1',
  membershipType: 'regular',
  isActive: true,
  dateAdded: '2024-01-05',
  positions: [],
  ...overrides,
})

const transferredOut = member({
  id: 'x',
  isActive: false,
  history: [
    event('joined', '2024-01-05'),
    event('transferred-out', '2025-03-10'),
  ],
})

const returned = member({
  id: 'y',
  isActive: true,
  history: [
    event('joined', '2024-01-05'),
    event('transferred-out', '2025-03-10'),
    event('returned', '2026-01-20'),
  ],
})

test('the empty filter keeps exactly the members who belong on the page', () => {
  const plain = member()
  assert.deepEqual(
    filterMemberHistory([plain, transferredOut, returned], EMPTY_HISTORY_FILTERS).map(
      (m) => m.id,
    ),
    ['x', 'y'],
  )
})

test('status filter narrows to currently-transferred or currently-returned', () => {
  assert.deepEqual(
    filterMemberHistory([transferredOut, returned], {
      ...EMPTY_HISTORY_FILTERS,
      status: 'transferred-out',
    }).map((m) => m.id),
    ['x'],
  )
  assert.deepEqual(
    filterMemberHistory([transferredOut, returned], {
      ...EMPTY_HISTORY_FILTERS,
      status: 'returned',
    }).map((m) => m.id),
    ['y'],
  )
})

test('query matches any name part, case-insensitively', () => {
  const members = [transferredOut, returned]
  assert.deepEqual(
    filterMemberHistory(members, {
      ...EMPTY_HISTORY_FILTERS,
      query: 'DELA',
    }).map((m) => m.id),
    ['x', 'y'],
  )
  assert.deepEqual(
    filterMemberHistory(members, { ...EMPTY_HISTORY_FILTERS, query: 'nope' }),
    [],
  )
})

test('year filter matches any event year, oldest transfers included', () => {
  const members = [transferredOut, returned]
  assert.deepEqual(
    filterMemberHistory(members, {
      ...EMPTY_HISTORY_FILTERS,
      year: 2025,
    }).map((m) => m.id),
    ['x', 'y'],
  )
  assert.deepEqual(
    filterMemberHistory(members, {
      ...EMPTY_HISTORY_FILTERS,
      year: 2026,
    }).map((m) => m.id),
    ['y'],
  )
  assert.deepEqual(
    filterMemberHistory(members, { ...EMPTY_HISTORY_FILTERS, year: 1999 }),
    [],
  )
})

test('combined query and status narrow further', () => {
  assert.deepEqual(
    filterMemberHistory([transferredOut, returned], {
      ...EMPTY_HISTORY_FILTERS,
      query: 'Maria',
      status: 'returned',
    }).map((m) => m.id),
    ['y'],
  )
})