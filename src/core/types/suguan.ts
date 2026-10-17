export interface VoicePosition {
  id: string
  name: string
  shortName: string
  gender: 'male' | 'female'
}

export interface DutyRole {
  id: string
  name: string
  abbreviation: string
}

export interface ServiceType {
  id: string
  name: string
}

export interface SuguanAssignment {
  memberId: string
  memberName: string
  voicePosition: string
  assignedAt: string
  displayName?: string
}

export interface SuguanDutyRole {
  memberId: string
  memberName: string
  dutyRoleId: string
}

export type SuguanGroup = 'babae' | 'lalaki' | 'mixed'

export type SuguanEventType = 'pagsasanay' | 'pagtupad'

export interface SuguanEvent {
  id: string
  type: SuguanEventType
  date: string
  endDate?: string
  label?: string
}

/**
 * The id of a worship schedule. The built-in times use the fixed keys below,
 * but users may add their own in Settings, so the type is open.
 */
export type WorshipScheduleKey = string

export interface SuguanScheduleSection {
  id: string
  scheduleKey?: WorshipScheduleKey
  scheduleLabel: string
  scheduleDay: string
  scheduleTime: string
  /**
   * The concrete calendar date this schedule falls on, present when the section
   * was auto-detected for a one-week coverage (each worship day resolved to the
   * calendar week around the training date). Recurring two-week sections leave
   * it unset and derive dates from the coverage events instead.
   */
  scheduleDate?: string
  description?: string
  assignments: SuguanAssignment[]
}

export type DocPaperSize = 'letter' | 'a4' | 'legal' | 'custom'
export type DocOrientation = 'portrait' | 'landscape'
export type DocMargins = 'normal' | 'narrow' | 'custom'
export type DocScaling = 'fit-width' | 'fit-page' | 'auto'
export type DocFontSize = 'small' | 'normal' | 'large' | 'custom'

export interface SuguanDocFormat {
  paperSize: DocPaperSize
  customWidthMm?: number
  customHeightMm?: number
  orientation: DocOrientation
  margins: DocMargins
  customMarginTopMm?: number
  customMarginBottomMm?: number
  customMarginLeftMm?: number
  customMarginRightMm?: number
  scaling: DocScaling
  fontSize: DocFontSize
  /**
   * Body font size in pt, used only when `fontSize` is `custom`. Every other
   * size (title, header, signature) is derived from the `normal` preset's
   * ratios so one number controls the whole sheet. Clamped by
   * `normalizeDocFormat` to CUSTOM_BODY_FONT_MIN..MAX.
   */
  customBodyFontSize?: number
}

export type SuguanCoverageTemplate = 'midweek-2w' | 'weekend-2w' | 'one-week'

export interface SuguanCoverage {
  template: SuguanCoverageTemplate
  /**
   * Pagsasanay (rehearsal) date, stored exactly as the user entered it.
   * Never auto-adjusted.
   */
  startDate: string
  oneWeekDate?: string
  oneWeekPagsasanayDate?: string
  oneWeekPagtupadDate?: string
  oneWeekPagtupadEndDate?: string
  /**
   * Manual Pagtupad override for 2-week templates. The Pagtupad covers a range
   * of worship days (midweek is Wednesday and Thursday; weekend is Saturday and
   * Sunday), so both ends are overridable. When a start is set it replaces the
   * suggested first week, and the second week is derived from it by adding
   * seven days. Leave both undefined to always use the suggestion derived from
   * the worship schedule.
   */
  pagtupadStartOverride?: string
  pagtupadEndOverride?: string
}

export interface ExtraOccasionDateColumn {
  enabled: boolean
  label: string
  date: string
}

export type ExtraOccasionOrganistaRole = 'organista' | 'reserve'

export interface ExtraOccasionOrganistaAssignment {
  memberId: string
  role: ExtraOccasionOrganistaRole
}

export interface ExtraOccasionSuguanConfig {
  /** The name typed into "Occasion name" ("Wedding", "Funeral"). Suguan History
   *  reads a saved record back as this label; blank means the generic "Extra
   *  Occasion Suguan" instead. */
  name?: string
  localeName: string
  pagsasanay: ExtraOccasionDateColumn
  pagtupad: ExtraOccasionDateColumn
  showFooterSignatories: boolean
  organistaAssignments: Record<string, ExtraOccasionOrganistaAssignment[]>
  /**
   * An officer's deliberate "keep this member on both occasions" decisions,
   * recorded from the member-assignment conflict dialog. A pair is
   * `memberId` + `otherSuguanId`; the decision stops the dialog re-opening for
   * that pair but never hides a genuine time-overlap warning.
   */
  straightDecisions?: ExtraOccasionStraightDecision[]
}

export interface ExtraOccasionStraightDecision {
  memberId: string
  otherSuguanId: string
  /** A display snapshot of the other occasion, so the record is understandable
   *  even after that occasion is renamed or deleted. */
  otherLabel: string
  at: string
}

export interface Suguan {
  id: string
  date: string
  time: string
  serviceTypeId: string
  group: SuguanGroup
  docFormat?: SuguanDocFormat | null
  coverage?: SuguanCoverage | null
  events: SuguanEvent[]
  pagsasanayDate?: string
  pagtupadDate?: string
  schedules: SuguanScheduleSection[]
  voiceCapacities: Record<string, number>
  assignments: SuguanAssignment[]
  dutyRoles: SuguanDutyRole[]
  destinadoName?: string
  extraOccasion?: ExtraOccasionSuguanConfig
  /**
   * The planning session (batch) this Extra Occasion belongs to. The inverse —
   * which occasions a batch contains — is derived by filtering `suguans` on this
   * field, so there is a single source of truth for membership. Absent for a
   * standalone Extra Occasion.
   */
  extraOccasionBatchId?: string
  copiedFromId?: string
  createdAt: string
  updatedAt: string
}