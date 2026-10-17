import type { Suguan } from '@/core/types/suguan'

/**
 * Members a Choir Suguan already books at the same instant as `date` + `time`.
 *
 * Only worship Suguan records count. An Extra Occasion keeps its own rules in
 * the Extra Occasion makers (`extraOccasionConflicts`), which pass their marks
 * into the workspace separately, so an Extra Occasion never blocks a Choir
 * Suguan here — and the Choir Suguan never blocks an Extra Occasion. The two
 * services are independent.
 *
 * The record being edited is skipped so its own roster is not treated as a
 * clash. A blank date resolves to `NaN`, which matches nothing.
 */
export function membersBookedAtSameInstant(
  records: Suguan[],
  when: { date: string; time: string; editingId?: string | null },
): Set<string> {
  const ids = new Set<string>()
  const millis = new Date(`${when.date}T${when.time || '00:00'}`).getTime()
  for (const record of records) {
    if (record.extraOccasion) continue
    if (when.editingId && record.id === when.editingId) continue
    if (new Date(`${record.date}T${record.time || '00:00'}`).getTime() !== millis) {
      continue
    }
    for (const assignment of record.assignments) ids.add(assignment.memberId)
  }
  return ids
}
