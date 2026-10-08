/**
 * Membership lifecycle logic for the Members History feature.
 *
 * Every member can pass through three milestones — joined, transferred out,
 * returned to the choir — and each one is a `MemberHistoryEvent` appended to
 * the SAME member profile. Transferring out never deletes the record, and
 * returning never creates a second profile. All the derived values below
 * (current lifecycle status, membership period count, last-active date) come
 * from reading those events in order, so a member's history is the single
 * source of truth instead of a parallel list somewhere else.
 *
 * Kept framework-free so `memberHistory.test.ts` can pin it under `node:test`.
 */

import type {
  Member,
  MemberHistoryEvent,
  MemberHistoryType,
  TransferReason,
} from '@/core/types/member'
import { laterDateKey } from '@/lib/phDate'
import { normalizeNameKey } from '@/lib/rosterImport'

/** What the three event kinds are called, e.g. for the timeline. */
export const MEMBER_HISTORY_EVENT_LABELS: Record<MemberHistoryType, string> = {
  joined: 'Joined Choir',
  'transferred-out': 'Transferred Out',
  returned: 'Returned to Choir',
}

export const TRANSFER_REASON_OPTIONS: {
  id: TransferReason
  label: string
}[] = [
  { id: 'transferred-locale', label: 'Transferred Locale' },
  { id: 'temporarily-inactive', label: 'Temporarily Inactive' },
  { id: 'other', label: 'Other' },
]

export function transferReasonLabel(reason?: TransferReason): string {
  return (
    TRANSFER_REASON_OPTIONS.find((option) => option.id === reason)?.label ??
    'Other'
  )
}

/**
 * Where a member stands right now, derived from their latest lifecycle event.
 * `active` is a member who joined and never left; `returned` is someone back
 * after a transfer; `transferred-out` is someone currently out; `inactive`
 * is the legacy deactivated record that predates history events.
 */
export type MemberLifecycleStatus =
  | 'active'
  | 'returned'
  | 'transferred-out'
  | 'inactive'

export const MEMBER_LIFECYCLE_STATE_LABELS: Record<MemberLifecycleStatus, string> =
  {
    active: 'Active',
    returned: 'Returned',
    'transferred-out': 'Transferred Out',
    inactive: 'Inactive',
  }

/** Events in the member's archived order (oldest first). Missing → `[]`. */
export function memberHistoryEvents(member: Member): MemberHistoryEvent[] {
  return member.history ?? []
}

/** The most recent lifecycle event, or `null` when the member has none. */
export function lastLifecycleEvent(
  member: Member,
): MemberHistoryEvent | null {
  const events = memberHistoryEvents(member)
  if (events.length === 0) return null
  // Already appended in chronological order, so the newest is the last one.
  return events[events.length - 1]
}

/**
 * The member's current lifecycle status. `isActive` gates the result: transfer
 * and restore both flip it in the same action that appends the event, so an
 * event kind that contradicts the flag means the plain deactivate toggle has
 * run since and the flag wins. A `joined`-only active member is simply active.
 */
export function memberLifecycleStatus(member: Member): MemberLifecycleStatus {
  const last = lastLifecycleEvent(member)
  if (!last) return member.isActive ? 'active' : 'inactive'
  if (!member.isActive) {
    return last.type === 'transferred-out' ? 'transferred-out' : 'inactive'
  }
  return last.type === 'returned' ? 'returned' : 'active'
}

/** Has this member ever been transferred out and (possibly) back? */
export function memberEverTransferredOut(member: Member): boolean {
  return memberHistoryEvents(member).some(
    (event) => event.type === 'transferred-out',
  )
}

/** Was this member transferred out at some point and is currently back? */
export function memberIsReturned(member: Member): boolean {
  return memberHistoryEvents(member).some((event) => event.type === 'returned')
}

/**
 * Whether a member belongs on the Members History page: anyone who has ever
 * transferred out (including returned members) plus legacy inactive records
 * that predate event tracking.
 */
export function belongsInMemberHistory(member: Member): boolean {
  return memberEverTransferredOut(member) || !member.isActive
}

/**
 * Whether a member still appears on the Master List. A formal transfer moves
 * them off it — from then on they live on the Members History page — while a
 * plain deactivation keeps them on the list with an "Inactive" badge.
 */
export function belongsInMasterList(member: Member): boolean {
  return memberLifecycleStatus(member) !== 'transferred-out'
}

/**
 * Short copy describing how long the membership has run, used by the archive's
 * "Membership Period" column. A member with no events at all is a legacy
 * record; a single stint reads "Since YYYY"; several stints read a range.
 */
export function memberMembershipSummary(member: Member): string {
  const events = memberHistoryEvents(member)
  const periods = memberMembershipPeriods(member)
  if (periods === 0) return 'Legacy record'
  const beloved = events.filter(
    (event) => event.type === 'joined' || event.type === 'returned',
  )
  const firstYear = beloved[0]?.date.slice(0, 4) ?? ''
  const lastYear = beloved[beloved.length - 1]?.date.slice(0, 4) ?? ''
  if (firstYear === lastYear || !lastYear) return `Since ${firstYear}`.trim()
  return `${periods} terms · ${firstYear}–${lastYear}`
}

/**
 * How many separate stints the member has served: one per `joined` or
 * `returned` event. A member who joined, left, and returned has two periods.
 */
export function memberMembershipPeriods(member: Member): number {
  return memberHistoryEvents(member).filter(
    (event) => event.type === 'joined' || event.type === 'returned',
  ).length
}

/**
 * The most recent date anything happened in this member's membership journey.
 * Falls back to the date they joined, then to `''`.
 */
export function memberLastActiveDateKey(member: Member): string {
  let latest = ''
  for (const event of memberHistoryEvents(member)) {
    latest = laterDateKey(latest, event.date, '')
  }
  return laterDateKey(latest, member.dateAdded, '')
}

/** The distinct years represented by all history events, newest first. */
export function memberHistoryYears(members: Member[]): number[] {
  const years = new Set<number>()
  for (const member of members) {
    for (const event of memberHistoryEvents(member)) {
      const match = /^(\d{4})/.exec(event.date)
      if (match) years.add(Number(match[1]))
    }
  }
  return [...years].sort((a, b) => b - a)
}

/**
 * Members whose normalized name exactly matches the candidate. Name equality
 * is the signal that "Add Member" may be about to create a duplicate record,
 * so the caller can offer to restore the existing profile instead.
 */
export function findPossibleDuplicateMembers(
  members: readonly Member[],
  candidate: Pick<Member, 'firstName' | 'lastName'>,
): Member[] {
  const key = normalizeNameKey(candidate.lastName, candidate.firstName)
  if (!key) return []
  return members.filter(
    (member) => normalizeNameKey(member.lastName, member.firstName) === key,
  )
}