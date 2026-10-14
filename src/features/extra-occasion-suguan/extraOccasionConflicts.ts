import type { ExtraOccasionSuguanConfig, Suguan } from '@/core/types/suguan'
import { isDateKey } from '@/lib/phDate'
import {
  occasionLabel,
} from './extraOccasionDraft'
import type { PlannerOccasion } from './extraOccasionSession'

/**
 * How far apart two occasion times may be before they are considered
 * non-overlapping. A shared date with times within this window is a real
 * conflict; a shared date with times further apart is only a "same day"
 * warning, since the exact service windows are not known.
 */
export const TIME_CONFLICT_THRESHOLD_MIN = 90

export type MemberConflictKind = 'time-overlap' | 'same-day'

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

/** Builds a comparison ref from a live planner occasion. */
export function occasionRefFromState(
  occasion: PlannerOccasion,
  label: string,
): OccasionRef {
  const { state } = occasion
  const memberIds = new Set<string>()
  for (const section of state.draft.schedules) {
    for (const assignment of section.assignments) {
      memberIds.add(assignment.memberId)
    }
  }
  for (const memberId of organistaMemberIds(state.organistaAssignments)) {
    memberIds.add(memberId)
  }
  return {
    key: occasion.savedId ?? occasion.localId,
    savedId: occasion.savedId,
    name: label,
    dates: validColumnDates(state),
    time: state.draft.time,
    memberIds: [...memberIds],
  }
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
  const named = config.name?.trim()
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

function sharedDates(target: OccasionRef, other: OccasionRef): string[] {
  const otherDates = new Set(other.dates)
  return target.dates.filter((date) => otherDates.has(date))
}

/**
 * Conflicts for every member shared between `target` and any of `others`.
 * Different authoritative dates never warn; a shared date is `time-overlap`
 * when the times are within the threshold, otherwise `same-day`.
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
    const dates = sharedDates(target, other)
    if (dates.length === 0) continue
    const kind: MemberConflictKind = isTimeConflict(
      target.time,
      other.time,
      thresholdMin,
    )
      ? 'time-overlap'
      : 'same-day'
    for (const memberId of other.memberIds) {
      if (!targetMembers.has(memberId)) continue
      const list = result.get(memberId) ?? []
      list.push({ memberId, other, kind, dates })
      result.set(memberId, list)
    }
  }
  return result
}

/**
 * Every other occasion a planner occasion should be compared against: all other
 * session occasions plus saved Extra Occasion records, excluding the target's
 * own saved record and de-duplicating any session occasion that is already
 * saved.
 */
export function comparisonRefs(
  target: PlannerOccasion,
  sessionOccasions: PlannerOccasion[],
  savedRecords: Suguan[],
): OccasionRef[] {
  const refs: OccasionRef[] = []
  const seen = new Set<string>()
  for (const occasion of sessionOccasions) {
    if (occasion.localId === target.localId) continue
    const label = occasionLabel(occasion.state) || 'Occasion'
    const ref = occasionRefFromState(occasion, label)
    if (seen.has(ref.key)) continue
    seen.add(ref.key)
    refs.push(ref)
  }
  for (const record of savedRecords) {
    if (!record.extraOccasion) continue
    if (record.id === target.savedId) continue
    if (seen.has(record.id)) continue
    seen.add(record.id)
    refs.push(occasionRefFromSuguan(record))
  }
  return refs
}
