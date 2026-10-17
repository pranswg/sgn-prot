import type {
  ExtraOccasionStraightDecision,
  ExtraOccasionSuguanConfig,
  Suguan,
} from '@/core/types/suguan'
import {
  compareDateKeys,
  isDateKey,
  phtMinutesOfDay,
  todayPHT,
} from '@/lib/phDate'
import { extraOccasionName } from './extraOccasionData'
import {
  occasionLabel,
  type ExtraOccasionOccasionState,
} from './extraOccasionDraft'
import type { PlannerOccasion } from './extraOccasionSession'

/**
 * How far apart two occasion times may be before they are considered
 * non-overlapping. A shared date with times within this window is a real
 * conflict; a shared date with times further apart is only a "same day"
 * warning, since the exact service windows are not known.
 */
export const TIME_CONFLICT_THRESHOLD_MIN = 90

export type MemberConflictKind = 'time-overlap' | 'same-day' | 'unknown-date'

/** A reference to one occasion for conflict comparison. */
export interface OccasionRef {
  /** Stable key `savedId ?? localId`; never a name or array position. */
  key: string
  savedId: string | null
  name: string
  /** Authoritative Pagsasanay/Pagtupad dates, only when enabled and valid. */
  dates: string[]
  /** `HH:mm`, or blank when unset. */
  time: string
  /** Every member assigned to the occasion (choir + organista). */
  memberIds: string[]
}

export interface MemberConflict {
  memberId: string
  other: OccasionRef
  kind: MemberConflictKind
  /** The authoritative dates both occasions share. */
  dates: string[]
}

/**
 * One member who was just added to an occasion while already serving another.
 * Held in a queue so several additions in one edit are answered one at a time.
 */
export interface PendingOccasionConflict {
  /** The occasion the member was added to; `localId` in the planner. */
  targetKey: string
  memberId: string
  conflicts: MemberConflict[]
}

function validColumnDates(
  config: Pick<ExtraOccasionSuguanConfig, 'pagsasanay' | 'pagtupad'>,
): string[] {
  const dates: string[] = []
  if (config.pagsasanay.enabled && isDateKey(config.pagsasanay.date)) {
    dates.push(config.pagsasanay.date)
  }
  if (config.pagtupad.enabled && isDateKey(config.pagtupad.date)) {
    dates.push(config.pagtupad.date)
  }
  return dates
}

function organistaMemberIds(
  assignments: Record<string, { memberId: string }[]>,
): string[] {
  return Object.values(assignments).flatMap((rows) =>
    rows.map((row) => row.memberId),
  )
}

function memberIdsOfState(state: ExtraOccasionOccasionState): string[] {
  const memberIds = new Set<string>()
  for (const section of state.draft.schedules) {
    for (const assignment of section.assignments) {
      memberIds.add(assignment.memberId)
    }
  }
  for (const memberId of organistaMemberIds(state.organistaAssignments)) {
    memberIds.add(memberId)
  }
  return [...memberIds]
}

/**
 * Builds a comparison ref from a live occasion's state, whether it is a planner
 * entry or the single maker's one occasion.
 */
export function occasionRefFromInput(
  state: ExtraOccasionOccasionState,
  identity: { key: string; savedId: string | null; label: string },
): OccasionRef {
  return {
    key: identity.key,
    savedId: identity.savedId,
    name: identity.label,
    dates: validColumnDates(state),
    time: state.draft.time,
    memberIds: memberIdsOfState(state),
  }
}

/** Builds a comparison ref from a live planner occasion. */
export function occasionRefFromState(
  occasion: PlannerOccasion,
  label: string,
): OccasionRef {
  return occasionRefFromInput(occasion.state, {
    key: occasion.savedId ?? occasion.localId,
    savedId: occasion.savedId,
    label,
  })
}

/** Builds a comparison ref from a saved Extra Occasion record. */
export function occasionRefFromSuguan(record: Suguan): OccasionRef {
  const config = record.extraOccasion
  if (!config) {
    throw new Error('This Suguan record does not have Extra Occasion settings.')
  }
  const memberIds = new Set(record.assignments.map((a) => a.memberId))
  for (const memberId of organistaMemberIds(config.organistaAssignments)) {
    memberIds.add(memberId)
  }
  return {
    key: record.id,
    savedId: record.id,
    name: occasionLabelFromRecord(record, config),
    dates: validColumnDates(config),
    time: record.time ?? '',
    memberIds: [...memberIds],
  }
}

function occasionLabelFromRecord(
  record: Suguan,
  config: ExtraOccasionSuguanConfig,
): string {
  const named = extraOccasionName(config)
  if (named) return named
  const section = record.schedules[0]?.scheduleLabel?.trim()
  return section || 'Extra Occasion'
}

/** `HH:mm` → minutes since midnight, or null when unparseable. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** True when both times parse and are within the overlap threshold. */
export function isTimeConflict(
  left: string,
  right: string,
  thresholdMin: number = TIME_CONFLICT_THRESHOLD_MIN,
): boolean {
  const a = timeToMinutes(left)
  const b = timeToMinutes(right)
  if (a === null || b === null) return false
  return Math.abs(a - b) <= thresholdMin
}

/**
 * True once an occasion's own date and time have passed in PHT: it has been
 * fulfilled, so it no longer books its members and stops raising conflicts.
 *
 * The LAST of its Pagsasanay/Pagtupad dates is the one that ends it — the
 * occasion is only over when its final column is. An occasion with no usable
 * date is never "done": it cannot be ruled out, which is the same reasoning the
 * `unknown-date` warning uses. A date with no time lasts the whole day.
 *
 * Deleting the record in Suguan History needs no flag here: a deleted record is
 * simply not in the store any more, so it is never compared against.
 */
export function isOccasionDone(
  ref: OccasionRef,
  now: Date = new Date(),
): boolean {
  let last = ''
  for (const date of ref.dates) {
    if (!isDateKey(date)) continue
    if (!last || compareDateKeys(date, last) > 0) last = date
  }
  if (!last) return false
  const order = compareDateKeys(last, todayPHT(now))
  if (order < 0) return true
  if (order > 0) return false
  const time = timeToMinutes(ref.time)
  if (time === null) return false
  return phtMinutesOfDay(now) > time
}

function sharedDates(target: OccasionRef, other: OccasionRef): string[] {
  const otherDates = new Set(other.dates)
  return target.dates.filter((date) => otherDates.has(date))
}

/**
 * How one pair of occasions interacts, or `null` when they are independent.
 * Different authoritative dates never warn; a shared date is `time-overlap`
 * when the times are within the threshold, otherwise `same-day`. When either
 * occasion has no valid date yet the overlap cannot be ruled out, so the pair
 * is `unknown-date` — this is what flags two fresh drafts that share a member
 * before any Pagsasanay/Pagtupad date is entered.
 */
function pairConflict(
  target: OccasionRef,
  other: OccasionRef,
  thresholdMin: number,
): { kind: MemberConflictKind; dates: string[] } | null {
  const dates = sharedDates(target, other)
  if (dates.length > 0) {
    return {
      kind: isTimeConflict(target.time, other.time, thresholdMin)
        ? 'time-overlap'
        : 'same-day',
      dates,
    }
  }
  if (target.dates.length === 0 || other.dates.length === 0) {
    return { kind: 'unknown-date', dates }
  }
  return null
}

/**
 * Conflicts for every member shared between `target` and any of `others`.
 * Only members already on both occasions are reported; use
 * `conflictingMemberIds` for the yellow warning on members not added yet.
 */
export function detectMemberConflicts(
  target: OccasionRef,
  others: OccasionRef[],
  thresholdMin: number = TIME_CONFLICT_THRESHOLD_MIN,
): Map<string, MemberConflict[]> {
  const result = new Map<string, MemberConflict[]>()
  const targetMembers = new Set(target.memberIds)
  for (const other of others) {
    if (other.key === target.key) continue
    const pair = pairConflict(target, other, thresholdMin)
    if (!pair) continue
    for (const memberId of other.memberIds) {
      if (!targetMembers.has(memberId)) continue
      const list = result.get(memberId) ?? []
      list.push({ memberId, other, kind: pair.kind, dates: pair.dates })
      result.set(memberId, list)
    }
  }
  return result
}

/**
 * Every member serving one of `others` that overlaps the target. This is the
 * yellow warning in the member list: it covers members the user has not added
 * yet, which `detectMemberConflicts` cannot see, so a member booked in a live
 * Extra Occasion still shows up as available — just marked.
 */
export function conflictingMemberIds(
  target: OccasionRef,
  others: OccasionRef[],
  thresholdMin: number = TIME_CONFLICT_THRESHOLD_MIN,
): Set<string> {
  const ids = new Set<string>()
  for (const other of others) {
    if (other.key === target.key) continue
    if (!pairConflict(target, other, thresholdMin)) continue
    for (const memberId of other.memberIds) ids.add(memberId)
  }
  return ids
}

/** True when the user already chose "Straight" for this member and occasion. */
export function hasStraightDecision(
  decisions: ExtraOccasionStraightDecision[],
  memberId: string,
  otherSuguanId: string,
): boolean {
  return decisions.some(
    (decision) =>
      decision.memberId === memberId &&
      decision.otherSuguanId === otherSuguanId,
  )
}

/**
 * The members among `addedIds` who are already booked elsewhere, ready to be
 * asked about. Members the user already answered "Straight" for are left alone,
 * so the dialog asks once per member and other occasion.
 */
export function pendingConflictsForAdded(options: {
  targetKey: string
  addedIds: string[]
  targetRef: OccasionRef
  others: OccasionRef[]
  decisions: ExtraOccasionStraightDecision[]
  thresholdMin?: number
}): PendingOccasionConflict[] {
  const { targetKey, addedIds, targetRef, others, decisions } = options
  // The members are not on the target yet, so widen the ref before comparing.
  const widened: OccasionRef = {
    ...targetRef,
    memberIds: [...new Set([...targetRef.memberIds, ...addedIds])],
  }
  const map = detectMemberConflicts(widened, others, options.thresholdMin)
  const queued: PendingOccasionConflict[] = []
  for (const memberId of addedIds) {
    const conflicts = (map.get(memberId) ?? []).filter(
      (conflict) =>
        !hasStraightDecision(
          decisions,
          memberId,
          conflict.other.savedId ?? conflict.other.key,
        ),
    )
    if (conflicts.length > 0) queued.push({ targetKey, memberId, conflicts })
  }
  return queued
}

/**
 * Records the keep-both choice for every other occasion in `conflicts`, without
 * repeating a decision that is already stored.
 */
export function appendStraightDecisions(
  decisions: ExtraOccasionStraightDecision[],
  memberId: string,
  conflicts: MemberConflict[],
  at: string,
): ExtraOccasionStraightDecision[] {
  const next = [...decisions]
  for (const conflict of conflicts) {
    const otherSuguanId = conflict.other.savedId ?? conflict.other.key
    if (hasStraightDecision(next, memberId, otherSuguanId)) continue
    next.push({
      memberId,
      otherSuguanId,
      otherLabel: conflict.other.name,
      at,
    })
  }
  return next
}

/**
 * Every other occasion a target should be compared against: the other session
 * occasions plus the saved Extra Occasion records, excluding the target's own
 * saved record and de-duplicating any session occasion that is already saved.
 *
 * An occasion whose date and time have already passed is dropped here, so one
 * filter owns "who is still booked": the conflicts, the yellow marks and the
 * dialog all read this list.
 */
export function comparisonRefs(
  target: OccasionRef,
  sessionOccasions: PlannerOccasion[],
  savedRecords: Suguan[],
  now: Date = new Date(),
): OccasionRef[] {
  const refs: OccasionRef[] = []
  const seen = new Set<string>()
  const add = (ref: OccasionRef) => {
    if (ref.key === target.key) return
    if (seen.has(ref.key)) return
    if (isOccasionDone(ref, now)) return
    seen.add(ref.key)
    refs.push(ref)
  }
  for (const occasion of sessionOccasions) {
    add(
      occasionRefFromState(
        occasion,
        occasionLabel(occasion.state) || 'Occasion',
      ),
    )
  }
  for (const record of savedRecords) {
    if (!record.extraOccasion) continue
    if (record.id === target.savedId) continue
    add(occasionRefFromSuguan(record))
  }
  return refs
}
