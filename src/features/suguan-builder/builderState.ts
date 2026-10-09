import { nanoid } from 'nanoid'
import type {
  Suguan,
  SuguanAssignment,
  SuguanCoverage,
  SuguanDocFormat,
  SuguanDutyRole,
  SuguanEvent,
  SuguanGroup,
  SuguanScheduleSection,
  VoicePosition,
} from '@/core/types/suguan'
import { defaultCapacities } from '@/core/constants/serviceTypes'
import { CHOIR_SUGUAN_EXCLUDED_DUTY_ROLE_IDS } from '@/core/constants/dutyRoles'
import { firstDateKey, isDateKey } from '@/lib/phDate'
import { worshipWeekSchedules } from '@/lib/suguanDates'
import { useSettingsStore } from '@/store/settingsStore'
import {
  DEFAULT_SCHEDULE_CATEGORIES,
  allSchedulesOf,
  type WorshipScheduleCategories,
} from '@/core/constants/worshipSchedules'
import {
  DEFAULT_DOC_FORMAT,
  generateEventsFromCoverage,
  inferCoverageFromEvents,
  todayPHT,
} from '@/lib/suguanUtils'

export interface SuguanDraft {
  docFormat: SuguanDocFormat
  coverage: SuguanCoverage | null
  date: string
  time: string
  serviceTypeId: string
  pagsasanayDate: string
  pagtupadDate: string
  group: SuguanGroup
  events: SuguanEvent[]
  voiceCapacities: Record<string, number>
  assignments: SuguanAssignment[]
  schedules: SuguanScheduleSection[]
  dutyRoles: SuguanDutyRole[]
  destinadoName: string
  copiedFromId?: string | null
}

export type BuilderStepId =
  | 'coverage-document'
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
    id: 'coverage-document',
    title: 'Coverage & Document',
    short: 'Coverage & Doc',
    description: 'Set the service coverage and document layout.',
  },
  {
    id: 'schedules',
    title: 'Schedules',
    short: 'Schedules',
    description: 'Choose worship schedules to include.',
  },
  {
    id: 'assignments',
    title: 'Assignments',
    short: 'Assign',
    description: 'Assign members and special duties.',
  },
  {
    id: 'preview',
    title: 'Preview',
    short: 'Preview',
    description: 'Review the Suguan sheet before saving.',
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

/**
 * The service type a brand-new Suguan starts with: the configured default when
 * it still exists in the list, falling back to the first service type (which is
 * what a pre-default install used to start with) and then none.
 */
export function preferredServiceTypeId(): string {
  const state = useSettingsStore.getState()
  const services = state.allServiceTypes()
  if (
    state.defaultServiceTypeId &&
    services.some((t) => t.id === state.defaultServiceTypeId)
  ) {
    return state.defaultServiceTypeId
  }
  return services[0]?.id ?? ''
}

export function createEmptyDraft(
  voices: VoicePosition[],
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): SuguanDraft {
  const coverage = defaultCoverage()
  return {
    docFormat: { ...DEFAULT_DOC_FORMAT },
    coverage,
    date: coverage.startDate,
    time: '19:00',
    serviceTypeId: preferredServiceTypeId(),
    pagsasanayDate: '',
    pagtupadDate: '',
    group: 'babae',
    events: generateEventsFromCoverage(coverage, categories),
    voiceCapacities: defaultCapacities(voices),
    assignments: [],
    schedules: [],
    dutyRoles: [],
    destinadoName: '',
  }
}

/** The auto-detected worship schedules for a one-week coverage: every configured
 * schedule of the calendar week around the training date, resolved to its
 * concrete date. Assignments from a previous section with the same schedule key
 * (e.g. after the training date changed but the midweek slots did not) are
 * carried over, so retyping a date does not wipe a roster.
 *
 * @returns `[]` for any non-one-week coverage, or for one-week with no training
 * date entered yet — a blank Pagsasanay date is a normal pre-input state.
 */
export function weekScheduleSections(
  coverage: SuguanCoverage | null,
  previous: SuguanScheduleSection[],
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): SuguanScheduleSection[] {
  if (coverage?.template !== 'one-week') return []
  const trainingDate = firstDateKey(
    isDateKey(coverage.startDate) ? coverage.startDate : '',
    coverage.oneWeekPagsasanayDate,
    coverage.oneWeekDate,
  )
  if (!isDateKey(trainingDate)) return []
  const previousByKey = new Map<string, SuguanScheduleSection>()
  for (const section of previous) {
    if (section.scheduleKey) previousByKey.set(section.scheduleKey, section)
  }

  return worshipWeekSchedules(trainingDate, allSchedulesOf(categories)).map(
    ({ schedule, date }) => {
      const prior = previousByKey.get(schedule.id)
      return {
        id: prior?.id ?? nanoid(),
        scheduleKey: schedule.id,
        scheduleLabel: schedule.label,
        scheduleDay: schedule.scheduleDay,
        scheduleTime: schedule.scheduleTime,
        scheduleDate: date,
        assignments: prior?.assignments ?? [],
      }
    },
  )
}

export function createDraftFromSuguan(
  suguan: Suguan,
  voices: VoicePosition[],
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): SuguanDraft {
  return {
    docFormat: suguan.docFormat
      ? { ...DEFAULT_DOC_FORMAT, ...suguan.docFormat }
      : { ...DEFAULT_DOC_FORMAT },
    coverage:
      suguan.coverage ??
      inferCoverageFromEvents(suguan.events ?? [], categories),
    date: suguan.date || todayPHT(),
    time: suguan.time || '09:00',
    serviceTypeId: suguan.serviceTypeId || preferredServiceTypeId(),
    pagsasanayDate: suguan.pagsasanayDate ?? '',
    pagtupadDate: suguan.pagtupadDate ?? '',
    group: suguan.group ?? 'babae',
    events: suguan.events ?? [],
    voiceCapacities: suguan.voiceCapacities ?? defaultCapacities(voices),
    assignments: suguan.assignments ?? [],
    schedules: (suguan.schedules ?? []).map((s) => ({
      ...s,
      assignments: (s.assignments ?? []).map((a) => ({ ...a })),
    })),
    // Organist duties belong to the Organist Suguan, so any stored on a saved
    // record are dropped here — both the edit path and createCopyDraft flow
    // through this function, keeping the count badge, conflicts, and re-saves
    // consistent without rewriting history.
    dutyRoles: (suguan.dutyRoles ?? [])
      .filter((d) => !CHOIR_SUGUAN_EXCLUDED_DUTY_ROLE_IDS.has(d.dutyRoleId))
      .map((d) => ({ ...d })),
    destinadoName: suguan.destinadoName ?? '',
    copiedFromId: suguan.copiedFromId,
  }
}

/**
 * Copies every part of a previous Suguan (document setup, schedules, rosters,
 * duty roles, choir, service) and only resets the calendar so the new Suguan
 * can be dated freely.
 */
export function createCopyDraft(
  source: Suguan,
  voices: VoicePosition[],
  categories: WorshipScheduleCategories = DEFAULT_SCHEDULE_CATEGORIES,
): SuguanDraft {
  const base = createDraftFromSuguan(source, voices, categories)
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
  const events = coverage ? generateEventsFromCoverage(coverage, categories) : []
  return {
    ...base,
    coverage,
    events,
    date: '',
    pagsasanayDate: '',
    pagtupadDate: '',
    copiedFromId: source.id,
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
    group: draft.group,
    docFormat: draft.docFormat,
    coverage: draft.coverage,
    pagsasanayDate: draft.pagsasanayDate,
    pagtupadDate: draft.pagtupadDate,
    events: draft.events,
    voiceCapacities: draft.voiceCapacities,
    assignments: draft.assignments,
    schedules:
      draft.schedules.length > 0
        ? draft.schedules
        : [
            {
              id: '__draft_single__',
              scheduleLabel: 'SUGUAN',
              scheduleDay: '',
              scheduleTime: '',
              assignments: draft.assignments,
            },
          ],
    dutyRoles: draft.dutyRoles,
    destinadoName: draft.destinadoName,
    copiedFromId: draft.copiedFromId ?? undefined,
    createdAt: '',
    updatedAt: '',
  }
}

export function isStepComplete(draft: SuguanDraft, index: number): boolean {
  switch (index) {
    case 0:
      return (
        draft.coverage != null &&
        Boolean(draft.serviceTypeId) &&
        Boolean(draft.date) &&
        Boolean(draft.time) &&
        Boolean(draft.group) &&
        Boolean(draft.docFormat)
      )
    case 1:
      return draft.schedules.length > 0
    case 2:
      return totalAssigned(draft) > 0
    case 3:
      return true
    default:
      return false
  }
}

export function maxReachableStep(draft: SuguanDraft): number {
  let reach = 0
  while (reach < BUILDER_STEPS.length - 1 && isStepComplete(draft, reach)) reach++
  return reach
}

export function saveBlockers(draft: SuguanDraft): string[] {
  const blockers: string[] = []
  if (!draft.coverage) blockers.push('Choose a Suguan coverage.')
  if (draft.coverage && !isDateKey(draft.coverage.startDate))
    blockers.push('Choose a Pagsasanay date.')
  if (draft.events.length === 0)
    blockers.push('No schedule events were generated for this coverage.')
  if (!draft.serviceTypeId) blockers.push('Choose a service type.')
  if (draft.schedules.length === 0) blockers.push('Add at least one worship schedule.')
  if (totalAssigned(draft) === 0) blockers.push('Assign at least one member.')
  return blockers
}
