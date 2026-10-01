import type {
  Suguan,
  SuguanAssignment,
  SuguanCoverage,
  SuguanDocFormat,
  SuguanDutyRole,
  SuguanEvent,
  SuguanFormation,
  SuguanGroup,
  SuguanScheduleSection,
  SuguanType,
  VoicePosition,
} from '@/core/types/suguan'
import { defaultCapacities } from '@/core/constants/serviceTypes'
import { isDateKey } from '@/lib/phDate'
import {
  DEFAULT_DOC_FORMAT,
  generateEventsFromCoverage,
  inferCoverageFromEvents,
  todayPHT,
} from '@/lib/suguanUtils'

export interface SuguanDraft {
  type: SuguanType
  docFormat: SuguanDocFormat
  coverage: SuguanCoverage | null
  date: string
  time: string
  serviceTypeId: string
  eventTitle: string
  pagsasanayDate: string
  pagtupadDate: string
  group: SuguanGroup
  events: SuguanEvent[]
  formation: SuguanFormation | null
  voiceCapacities: Record<string, number>
  assignments: SuguanAssignment[]
  schedules: SuguanScheduleSection[]
  dutyRoles: SuguanDutyRole[]
  destinadoName: string
}

export type BuilderStepId =
  | 'coverage'
  | 'document'
  | 'schedules'
  | 'assignments'
  | 'preview'

export interface BuilderStepDef {
  id: BuilderStepId
  title: string
  short: string
  description: string
}

export const BUILDER_STEPS: BuilderStepDef[] = [
  {
    id: 'coverage',
    title: 'Coverage & Service',
    short: 'Coverage',
    description: 'Choose the type, duration, coverage, choir, and service of this Suguan.',
  },
  {
    id: 'document',
    title: 'Document Setup',
    short: 'Document',
    description: 'Set paper, orientation, margins, and text size for the printed sheet.',
  },
  {
    id: 'schedules',
    title: 'Worship Schedules',
    short: 'Schedules',
    description: 'Pick the worship schedules that make up this Suguan.',
  },
  {
    id: 'assignments',
    title: 'Assignments',
    short: 'Assignments',
    description: 'Assign members to each schedule and set duty roles.',
  },
  {
    id: 'preview',
    title: 'Preview & Export',
    short: 'Preview',
    description: 'Review the sheet, then save, print, or export it.',
  },
]

export function stepIndex(id: BuilderStepId): number {
  return BUILDER_STEPS.findIndex((s) => s.id === id)
}

/**
 * A brand-new Suguan starts with no date selected.
 *
 * `startDate` is the Pagsasanay date and is intentionally blank: every date on
 * the sheet should be something the user chose, never a value inferred from the
 * clock. The planner treats an empty `startDate` as "nothing to plan yet" and
 * emits no events until a date is entered.
 */
export function defaultCoverage(): SuguanCoverage {
  return { template: 'midweek-2w', startDate: '' }
}

export function groupGendersFor(group: SuguanGroup): ('female' | 'male')[] {
  if (group === 'babae') return ['female']
  if (group === 'lalaki') return ['male']
  return ['female', 'male']
}

export function createEmptyDraft(voices: VoicePosition[]): SuguanDraft {
  const coverage = defaultCoverage()
  return {
    type: 'regular',
    docFormat: { ...DEFAULT_DOC_FORMAT },
    coverage,
    date: coverage.startDate,
    time: '19:00',
    serviceTypeId: 'pagsamba',
    eventTitle: '',
    pagsasanayDate: '',
    pagtupadDate: '',
    group: 'babae',
    events: generateEventsFromCoverage(coverage),
    formation: null,
    voiceCapacities: defaultCapacities(voices),
    assignments: [],
    schedules: [],
    dutyRoles: [],
    destinadoName: '',
  }
}

export function createDraftFromSuguan(
  suguan: Suguan,
  voices: VoicePosition[],
): SuguanDraft {
  return {
    type: suguan.type ?? 'regular',
    docFormat: suguan.docFormat
      ? { ...DEFAULT_DOC_FORMAT, ...suguan.docFormat }
      : { ...DEFAULT_DOC_FORMAT },
    coverage:
      suguan.coverage ??
      (suguan.type === 'regular'
        ? inferCoverageFromEvents(suguan.events ?? [])
        : null),
    date: suguan.date || todayPHT(),
    time: suguan.time || '09:00',
    serviceTypeId: suguan.serviceTypeId || 'pagsamba',
    eventTitle: suguan.eventTitle ?? '',
    pagsasanayDate: suguan.pagsasanayDate ?? '',
    pagtupadDate: suguan.pagtupadDate ?? '',
    group: suguan.group ?? 'babae',
    events: suguan.events ?? [],
    formation: suguan.formation ?? null,
    voiceCapacities: suguan.voiceCapacities ?? defaultCapacities(voices),
    assignments: suguan.assignments ?? [],
    schedules: (suguan.schedules ?? []).map((s) => ({
      ...s,
      assignments: (s.assignments ?? []).map((a) => ({ ...a })),
    })),
    dutyRoles: (suguan.dutyRoles ?? []).map((d) => ({ ...d })),
    destinadoName: suguan.destinadoName ?? '',
  }
}

/**
 * Copies every part of a previous Suguan (document setup, schedules, rosters,
 * duty roles, choir, service) and only resets the calendar so the new Suguan
 * can be dated freely.
 */
export function createCopyDraft(source: Suguan, voices: VoicePosition[]): SuguanDraft {
  const base = createDraftFromSuguan(source, voices)
  // The calendar is cleared rather than reset to today, so the copy starts from
  // the same blank state as a brand-new Suguan and the user chooses its dates.
  const coverage =
    base.coverage != null
      ? {
          ...base.coverage,
          startDate: '',
          pagtupadStartOverride: undefined,
          pagtupadEndOverride: undefined,
          oneWeekDate: undefined,
          oneWeekPagsasanayDate: undefined,
          oneWeekPagtupadDate: undefined,
          oneWeekPagtupadEndDate: undefined,
        }
      : null
  const events =
    base.type === 'regular' && coverage
      ? generateEventsFromCoverage(coverage)
      : []
  return {
    ...base,
    coverage,
    events,
    date: '',
    pagsasanayDate: '',
    pagtupadDate: '',
  }
}

export function mirrorAssignments(schedules: SuguanScheduleSection[]): SuguanAssignment[] {
  return schedules.flatMap((s) => s.assignments)
}

export function applySchedules(
  draft: SuguanDraft,
  schedules: SuguanScheduleSection[],
): SuguanDraft {
  return { ...draft, schedules, assignments: mirrorAssignments(schedules) }
}

export function totalAssigned(draft: SuguanDraft): number {
  if (draft.schedules.length > 0) return mirrorAssignments(draft.schedules).length
  return draft.assignments.length
}

export function buildPreviewSuguan(draft: SuguanDraft): Suguan {
  return {
    id: '__draft__',
    date: draft.date,
    time: draft.time,
    serviceTypeId: draft.serviceTypeId,
    type: draft.type,
    eventTitle: draft.type === 'special' ? draft.eventTitle : undefined,
    group: draft.group,
    docFormat: draft.docFormat,
    coverage: draft.coverage,
    pagsasanayDate: draft.pagsasanayDate,
    pagtupadDate: draft.pagtupadDate,
    formation: draft.formation,
    events: draft.type === 'regular' ? draft.events : [],
    voiceCapacities: draft.voiceCapacities,
    assignments: draft.assignments,
    schedules:
      draft.schedules.length > 0
        ? draft.schedules
        : [
            {
              id: '__draft_single__',
              scheduleLabel: draft.type === 'special' ? 'SPECIAL' : 'SUGUAN',
              scheduleDay: '',
              scheduleTime: '',
              assignments: draft.assignments,
            },
          ],
    dutyRoles: draft.dutyRoles,
    destinadoName: draft.destinadoName,
    createdAt: '',
    updatedAt: '',
  }
}

export function isStepComplete(draft: SuguanDraft, index: number): boolean {
  switch (index) {
    case 0:
      if (draft.type === 'special') {
        return Boolean(draft.date) && draft.eventTitle.trim().length > 0
      }
      return (
      draft.coverage != null &&
      Boolean(draft.serviceTypeId) &&
      // A blank Pagsasanay date plans no events, so the step is not finished
      // until the user has chosen one.
      draft.events.length > 0
    )
    case 1:
      return Boolean(draft.docFormat.paperSize && draft.docFormat.orientation)
    case 2:
      return true
    case 3:
      return totalAssigned(draft) > 0
    default:
      return true
  }
}

export function maxReachableStep(draft: SuguanDraft): number {
  let reach = 0
  while (reach < BUILDER_STEPS.length - 1 && isStepComplete(draft, reach)) reach++
  return reach
}

export function saveBlockers(draft: SuguanDraft): string[] {
  const blockers: string[] = []
  if (draft.type === 'regular') {
    if (!draft.coverage) blockers.push('Choose a Suguan coverage.')
    if (draft.coverage && !isDateKey(draft.coverage.startDate))
      blockers.push('Choose a Pagsasanay date.')
    if (draft.events.length === 0)
      blockers.push('No schedule events were generated for this coverage.')
    if (!draft.serviceTypeId) blockers.push('Choose a service type.')
    if (draft.schedules.length === 0) blockers.push('Add at least one worship schedule.')
  } else if (!draft.eventTitle.trim()) {
    blockers.push('Provide a name for the event.')
  }
  if (totalAssigned(draft) === 0) blockers.push('Assign at least one member.')
  return blockers
}
