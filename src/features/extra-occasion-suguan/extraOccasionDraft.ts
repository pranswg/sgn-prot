import { nanoid } from 'nanoid'
import type {
  ExtraOccasionDateColumn,
  ExtraOccasionOrganistaAssignment,
  ExtraOccasionStraightDecision,
  ExtraOccasionSuguanConfig,
  Suguan,
  SuguanAssignment,
  SuguanScheduleSection,
  VoicePosition,
} from '@/core/types/suguan'
import {
  buildPreviewSuguan,
  createDraftFromSuguan,
  createEmptyDraft,
  type SuguanDraft,
} from '@/features/suguan-builder/builderState'
import { formatTime } from '@/lib/format'
import { isDateKey } from '@/lib/phDate'
import type { SuguanConfigInput } from '@/store/suguanStore'

/**
 * The editable state of one Extra Occasion. The single maker holds exactly one
 * of these; the Multiple planner holds a list. Both render the same
 * `ExtraOccasionOccasionForm`, so there is one config implementation.
 */
export interface ExtraOccasionOccasionState {
  /** A planner-only label ("Wedding"); blank falls back to the service type. */
  name: string
  draft: SuguanDraft
  churchName: string
  pagsasanay: ExtraOccasionDateColumn
  pagtupad: ExtraOccasionDateColumn
  showFooterSignatories: boolean
  organistaAssignments: Record<string, ExtraOccasionOrganistaAssignment[]>
  straightDecisions: ExtraOccasionStraightDecision[]
}

interface ServiceTypeLike {
  id: string
  name: string
}

/**
 * An Extra Occasion renders a single sheet section, so its draft always carries
 * exactly one schedule. That section's label is the chosen service type and its
 * time is the custom occasion time. This collapses any assignments saved under
 * the previous multi-schedule shape so no roster is lost on edit.
 */
export function mergeSectionAssignments(
  sections: SuguanScheduleSection[],
): SuguanAssignment[] {
  const seen = new Set<string>()
  const merged: SuguanAssignment[] = []
  for (const section of sections) {
    for (const assignment of section.assignments) {
      const key = `${assignment.memberId}|${assignment.voicePosition}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(assignment)
    }
  }
  return merged
}

export function singleOccasionSection(
  assignments: SuguanAssignment[],
  label: string,
  time: string,
  id: string = nanoid(),
): SuguanScheduleSection[] {
  return [
    {
      id,
      scheduleLabel: label,
      scheduleDay: '',
      scheduleTime: time,
      assignments,
    },
  ]
}

export function defaultPagsasanay(): ExtraOccasionDateColumn {
  return { enabled: true, label: 'Pagsasanay', date: '' }
}

export function defaultPagtupad(): ExtraOccasionDateColumn {
  return { enabled: true, label: 'Pagtupad', date: '' }
}

function serviceTypeName(id: string, serviceTypes: ServiceTypeLike[]): string {
  return serviceTypes.find((type) => type.id === id)?.name ?? ''
}

/** A brand-new, blank occasion for the current reference lists. */
export function emptyOccasionState(
  voices: VoicePosition[],
  serviceTypes: ServiceTypeLike[],
  localeName: string,
): ExtraOccasionOccasionState {
  const initial = createEmptyDraft(voices)
  return {
    name: '',
    draft: {
      ...initial,
      coverage: null,
      date: '',
      time: '',
      events: [],
      schedules: singleOccasionSection(
        [],
        serviceTypeName(initial.serviceTypeId, serviceTypes),
        '',
      ),
    },
    churchName: localeName,
    pagsasanay: defaultPagsasanay(),
    pagtupad: defaultPagtupad(),
    showFooterSignatories: true,
    organistaAssignments: {},
    straightDecisions: [],
  }
}

/** Rehydrate an occasion from a saved Extra Occasion record. */
export function occasionStateFromSuguan(
  record: Suguan,
  voices: VoicePosition[],
  serviceTypes: ServiceTypeLike[],
): ExtraOccasionOccasionState {
  const base = createDraftFromSuguan(record, voices)
  const time = record.time ?? ''
  return {
    name: record.extraOccasion?.name ?? '',
    draft: {
      ...base,
      coverage: null,
      date: record.date,
      time,
      events: [],
      schedules: singleOccasionSection(
        mergeSectionAssignments(base.schedules),
        serviceTypeName(base.serviceTypeId, serviceTypes),
        time ? formatTime(time) : '',
        base.schedules[0]?.id,
      ),
    },
    churchName: record.extraOccasion?.localeName ?? '',
    pagsasanay: record.extraOccasion?.pagsasanay ?? defaultPagsasanay(),
    pagtupad: record.extraOccasion?.pagtupad ?? defaultPagtupad(),
    showFooterSignatories: record.extraOccasion?.showFooterSignatories ?? true,
    organistaAssignments: record.extraOccasion?.organistaAssignments ?? {},
    straightDecisions: record.extraOccasion?.straightDecisions ?? [],
  }
}

/** The preview Suguan both renderers and exports consume. */
export function buildOccasionPreview(state: ExtraOccasionOccasionState): Suguan {
  return buildPreviewSuguan(state.draft)
}

/** The persisted Extra Occasion config for a save. */
export function occasionToConfig(
  state: ExtraOccasionOccasionState,
): ExtraOccasionSuguanConfig {
  return {
    name: state.name.trim() || undefined,
    localeName: state.churchName,
    pagsasanay: state.pagsasanay,
    pagtupad: state.pagtupad,
    showFooterSignatories: state.showFooterSignatories,
    organistaAssignments: state.organistaAssignments,
    straightDecisions:
      state.straightDecisions.length > 0 ? state.straightDecisions : undefined,
  }
}

/**
 * The canonical date stored on the Suguan row: the Pagsasanay date when it is
 * enabled, otherwise the Pagtupad date, otherwise blank.
 */
export function occasionDate(state: ExtraOccasionOccasionState): string {
  if (state.pagsasanay.enabled) return state.pagsasanay.date
  if (state.pagtupad.enabled) return state.pagtupad.date
  return ''
}

export type OccasionSuguanInput = Omit<
  SuguanConfigInput,
  'extraOccasion' | 'extraOccasionBatchId'
>

/**
 * The shared `createSuguan`/`updateSuguan` payload for one occasion. Preview
 * fields (schedules, capacities, assignments, duties) come from the same
 * `buildPreviewSuguan` the renderers use, so the saved record and the printed
 * sheet never diverge. The caller adds `extraOccasion` and the batch id.
 */
export function occasionSuguanInput(
  state: ExtraOccasionOccasionState,
): OccasionSuguanInput {
  const preview = buildOccasionPreview(state)
  return {
    date: occasionDate(state),
    time: state.draft.time,
    serviceTypeId: preview.serviceTypeId,
    group: preview.group,
    docFormat: preview.docFormat ?? undefined,
    coverage: null,
    events: [],
    pagsasanayDate: state.pagsasanay.enabled ? state.pagsasanay.date : '',
    pagtupadDate: state.pagtupad.enabled ? state.pagtupad.date : '',
    schedules: preview.schedules,
    voiceCapacities: preview.voiceCapacities,
    assignments: preview.assignments,
    dutyRoles: preview.dutyRoles,
    destinadoName: preview.destinadoName,
  }
}

/** The sheet's own title for this occasion: the plan name, else the service. */
export function occasionLabel(state: ExtraOccasionOccasionState): string {
  const named = state.name.trim()
  if (named) return named
  const scheduleLabel = state.draft.schedules[0]?.scheduleLabel?.trim()
  return scheduleLabel ?? ''
}

/** Removes every trace of a member from the occasion's rosters. */
export function removeMemberFromOccasion(
  state: ExtraOccasionOccasionState,
  memberId: string,
): ExtraOccasionOccasionState {
  return {
    ...state,
    draft: {
      ...state.draft,
      schedules: state.draft.schedules.map((section) => ({
        ...section,
        assignments: section.assignments.filter((a) => a.memberId !== memberId),
      })),
      assignments: state.draft.assignments.filter((a) => a.memberId !== memberId),
    },
    organistaAssignments: Object.fromEntries(
      Object.entries(state.organistaAssignments).map(([key, rows]) => [
        key,
        rows.filter((row) => row.memberId !== memberId),
      ]),
    ),
  }
}

/** Retitles the single sheet section and refreshes the service type. */
export function applyServiceType(
  state: ExtraOccasionOccasionState,
  id: string,
  serviceTypes: ServiceTypeLike[],
): ExtraOccasionOccasionState {
  const name = serviceTypeName(id, serviceTypes)
  return {
    ...state,
    draft: {
      ...state.draft,
      serviceTypeId: id,
      schedules: state.draft.schedules.map((section) => ({
        ...section,
        scheduleLabel: name,
      })),
    },
  }
}

/** Mirrors the custom time onto the single sheet section. */
export function applyTime(
  state: ExtraOccasionOccasionState,
  value: string,
): ExtraOccasionOccasionState {
  return {
    ...state,
    draft: {
      ...state.draft,
      time: value,
      schedules: state.draft.schedules.map((section) => ({
        ...section,
        scheduleTime: value ? formatTime(value) : '',
      })),
    },
  }
}

/**
 * The shared save/export gate. Returns the first blocking problem, or null when
 * the occasion is complete enough to save or print.
 */
export function validateOccasion(state: ExtraOccasionOccasionState): string | null {
  if (!state.draft.serviceTypeId) return 'Choose a service type first.'
  if (
    state.pagsasanay.enabled &&
    (!isDateKey(state.pagsasanay.date) || !state.pagsasanay.label.trim())
  ) {
    return 'Enter a valid date and label for the Pagsasanay column.'
  }
  if (
    state.pagtupad.enabled &&
    (!isDateKey(state.pagtupad.date) || !state.pagtupad.label.trim())
  ) {
    return 'Enter a valid date and label for the Pagtupad column.'
  }
  return null
}

