/**
 * Filtering for the Members History page, kept pure so `node:test` can pin it.
 */

import type { Member } from '@/core/types/member'
import {
  belongsInMemberHistory,
  memberHistoryEvents,
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
    if (needle) {
      const fullName =
        [member.firstName, member.middleName, member.lastName, member.suffix]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      if (!fullName.includes(needle)) return false
    }
    return true
  })
}