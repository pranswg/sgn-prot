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
