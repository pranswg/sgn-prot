/**
 * Filtering for the Members History page, kept pure so `node:test` can pin it.
 */

import type { Member } from '@/core/types/member'
import {
  belongsInMemberHistory,
  memberHistoryEvents,
  memberLastActiveDateKey,
  memberLifecycleStatus,
} from '@/lib/memberHistory'

export type HistoryStatusFilter = 'all' | 'transferred-out' | 'returned'

export interface MemberHistoryFilters {
  query: string
  status: HistoryStatusFilter
  /** A single calendar year to narrow to, or `'all'` for every year. */
  year: number | 'all'
}

export const EMPTY_HISTORY_FILTERS: MemberHistoryFilters = {
  query: '',
  status: 'all',
  year: 'all',
}

function memberFullName(member: Member): string {
  return [member.firstName, member.middleName, member.lastName, member.suffix]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** The members on the Members History page that survive the current filters. */
export function filterMemberHistory(
  members: readonly Member[],
  filters: MemberHistoryFilters,
): Member[] {
  const needle = filters.query.trim().toLowerCase()
  return members.filter((member) => {
    if (!belongsInMemberHistory(member)) return false
    if (filters.status === 'transferred-out') {
      if (memberLifecycleStatus(member) !== 'transferred-out') return false
    } else if (filters.status === 'returned') {
      if (memberLifecycleStatus(member) !== 'returned') return false
    }
    if (filters.year !== 'all') {
      const hasEventThatYear = memberHistoryEvents(member).some((event) =>
        event.date.startsWith(String(filters.year)),
      )
      if (!hasEventThatYear) return false
    }
    if (needle && !memberFullName(member).includes(needle)) return false
    return true
  })
}

/**
 * The archive reads newest first: the member whose membership changed most
 * recently sits at the top. Dates are canonical `YYYY-MM-DD` keys, so a plain
 * string comparison orders them; equal dates fall back to the name so the list
 * never reorders between renders.
 */
export function sortMemberHistoryLatestFirst(
  members: readonly Member[],
): Member[] {
  return [...members].sort((a, b) => {
    const byDate = memberLastActiveDateKey(b).localeCompare(
      memberLastActiveDateKey(a),
    )
    if (byDate !== 0) return byDate
    return memberFullName(a).localeCompare(memberFullName(b))
  })
}