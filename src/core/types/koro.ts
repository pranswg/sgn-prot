import type { DocFontSize, SuguanGroup } from './suguan'

export interface KoroCell {
  memberId: string | null
  firstName: string
  voicePosition: string
}

export interface KoroRow {
  id: string
  cells: KoroCell[]
}

export interface KoroTable {
  id: string
  title: string
  /** This table's own service date (`YYYY-MM-DD`) and time; the weekday is derived from the date. */
  date: string
  time: string
  rows: KoroRow[]
}

export interface KoroDocument {
  id: string
  title: string
  date: string
  serviceDay?: string
  serviceTime?: string
  organistMemberId?: string
  exportFontSize?: Exclude<DocFontSize, 'custom'>
  group: SuguanGroup
  tables: KoroTable[]
  createdAt: string
  updatedAt: string
}
