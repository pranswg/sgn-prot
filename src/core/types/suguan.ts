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
}

export interface SuguanDutyRole {
  memberId: string
  memberName: string
  dutyRoleId: string
}

export type SuguanGroup = 'babae' | 'lalaki' | 'mixed'

export type SuguanEventType = 'pagsasanay' | 'pagtupad'

export type SuguanType = 'regular' | 'special'

export interface SuguanEvent {
  id: string
  type: SuguanEventType
  date: string
  endDate?: string
}

export interface SuguanFormationCell {
  memberId: string
  memberName: string
  voicePosition: string
  voiceName: string
}

export interface SuguanFormation {
  rows: number
  cols: number
  cells: (SuguanFormationCell | null)[]
}

export type WorshipScheduleKey =
  | 'sabado-6pm'
  | 'linggo-6am'
  | 'linggo-10am'
  | 'miyerkules-7pm'
  | 'huwebes-6am'
  | 'huwebes-7pm'

export interface SuguanScheduleSection {
  id: string
  scheduleKey?: WorshipScheduleKey
  scheduleLabel: string
  scheduleDay: string
  scheduleTime: string
  assignments: SuguanAssignment[]
}

export type DocPaperSize = 'letter' | 'a4' | 'legal' | 'custom'
export type DocOrientation = 'portrait' | 'landscape'
export type DocMargins = 'normal' | 'narrow' | 'custom'
export type DocScaling = 'fit-width' | 'fit-page' | 'auto'
export type DocFontSize = 'small' | 'normal' | 'large'

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

export interface Suguan {
  id: string
  date: string
  time: string
  serviceTypeId: string
  type: SuguanType
  eventTitle?: string
  group: SuguanGroup
  docFormat?: SuguanDocFormat | null
  coverage?: SuguanCoverage | null
  events: SuguanEvent[]
  pagsasanayDate?: string
  pagtupadDate?: string
  schedules: SuguanScheduleSection[]
  formation?: SuguanFormation | null
  voiceCapacities: Record<string, number>
  assignments: SuguanAssignment[]
  dutyRoles: SuguanDutyRole[]
  destinadoName?: string
  createdAt: string
  updatedAt: string
}