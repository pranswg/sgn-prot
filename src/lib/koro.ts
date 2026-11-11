import { nanoid } from 'nanoid'
import type { KoroCell, KoroDocument, KoroRow, KoroTable } from '@/core/types/koro'
import type { Member } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import type { Suguan, SuguanAssignment } from '@/core/types/suguan'
import { todayPHT, weekdayOf } from '@/lib/phDate'

export const KORO_DEFAULT_COLUMNS = 15

/**
 * New tables seat singers three tiers, back to front: the 3rd (highest) row 10,
 * the 2nd row 10, and the 1st (front) row 14.
 */
export const KORO_DEFAULT_ROW_COLUMNS: number[] = [10, 10, 14]
const FILIPINO_WEEKDAYS = [
  'LINGGO',
  'LUNES',
  'MARTES',
  'MIYERKULES',
  'HUWEBES',
  'BIYERNES',
  'SABADO',
]

export function koroDayLabel(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ''
  return FILIPINO_WEEKDAYS[weekdayOf(date)] ?? ''
}

export const KORO_VOICE_COLORS: Record<string, string> = {
  'soprano-1': '#fff2cc',
  'soprano-2': '#fce4d6',
  alto: '#c6e0b4',
  tenor: '#C2E1FA',
  bass: '#C2E1FA',
}

const EXTRA_VOICE_COLORS = ['#d9eaf7', '#e4dfec', '#f4cccc', '#d9ead3']

export function koroVoiceColor(
  voicePosition: string,
  voices: VoicePosition[] = [],
): string {
  const knownColor = KORO_VOICE_COLORS[voicePosition]
  if (knownColor) return knownColor
  const index = voices.findIndex((voice) => voice.id === voicePosition)
  return index < 0 ? '#ffffff' : EXTRA_VOICE_COLORS[index % EXTRA_VOICE_COLORS.length]
}

export function createKoroCell(): KoroCell {
  return { memberId: null, firstName: '', voicePosition: '' }
}

export function createKoroRow(columns = KORO_DEFAULT_COLUMNS): KoroRow {
  return {
    id: nanoid(),
    cells: Array.from({ length: columns }, createKoroCell),
  }
}

export function createKoroTable(
  title = 'PRINCIPAL CHOIR GROUP',
  rowColumns: number[] = KORO_DEFAULT_ROW_COLUMNS,
): KoroTable {
  return {
    id: nanoid(),
    title,
    rows: rowColumns.map((count) => createKoroRow(count)),
  }
}

/**
 * Table transforms. The maker's grid only ever adds or removes a seat or a
 * tier, so these keep that arithmetic in one testable place instead of three
 * nested `map`s in the page.
 */
export function addKoroSeat(table: KoroTable, rowId: string): KoroTable {
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.id === rowId ? { ...row, cells: [...row.cells, createKoroCell()] } : row,
    ),
  }
}

export function removeKoroSeat(table: KoroTable, rowId: string): KoroTable {
  return {
    ...table,
    rows: table.rows.map((row) =>
      row.id === rowId && row.cells.length > 1
        ? { ...row, cells: row.cells.slice(0, -1) }
        : row,
    ),
  }
}

export function removeKoroRow(table: KoroTable, rowId: string): KoroTable {
  if (table.rows.length <= 1) return table
  return { ...table, rows: table.rows.filter((row) => row.id !== rowId) }
}

/** A deep copy under a new id, for repeating a past formation. */
export function duplicateKoroDocument(document: KoroDocument): KoroDocument {
  const now = new Date().toISOString()
  return {
    ...document,
    id: nanoid(),
    title: `${document.title.trim() || 'Special Occasion Koro'} (copy)`,
    tables: document.tables.map((table) => ({
      ...table,
      id: nanoid(),
      rows: table.rows.map((row) => ({
        ...row,
        id: nanoid(),
        cells: row.cells.map((cell) => ({ ...cell })),
      })),
    })),
    createdAt: now,
    updatedAt: now,
  }
}

export interface KoroSeatRef {
  rowIndex: number
  columnIndex: number
}

/** Exchange two seats' occupants; their voice arrangement travels with them. */
export function swapKoroSeats(
  table: KoroTable,
  left: KoroSeatRef,
  right: KoroSeatRef,
): KoroTable {
  const rows = table.rows.map((row) => ({ ...row, cells: [...row.cells] }))
  const first = rows[left.rowIndex]?.cells?.[left.columnIndex]
  const second = rows[right.rowIndex]?.cells?.[right.columnIndex]
  if (!first || !second) return table
  rows[left.rowIndex].cells[left.columnIndex] = second
  rows[right.rowIndex].cells[right.columnIndex] = first
  return { ...table, rows }
}

/**
 * Seat candidates left to right, row by row, into the empty seats only. Anyone
 * already placed anywhere in the document is skipped, so a fill can never seat
 * the same singer twice.
 */
export function fillKoroTable(
  table: KoroTable,
  candidates: Member[],
  placedIds: Set<string>,
): KoroTable {
  const taken = new Set(placedIds)
  const queue = candidates.filter((member) => !taken.has(member.id))
  let next = 0
  const rows = table.rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell) => {
      if (cell.memberId && cell.firstName.trim()) return cell
      const member = queue[next]
      if (!member) return cell
      next += 1
      taken.add(member.id)
      return {
        memberId: member.id,
        firstName: member.firstName,
        voicePosition: member.voicePosition,
      }
    }),
  }))
  return { ...table, rows }
}

/** Fill every table in the document in reading order, without double-booking. */
export function fillKoroDocument(
  document: KoroDocument,
  candidates: Member[],
): KoroDocument {
  const placed = new Set<string>()
  for (const table of document.tables) {
    for (const row of table.rows) {
      for (const cell of row.cells) {
        if (cell.memberId && cell.firstName.trim()) placed.add(cell.memberId)
      }
    }
  }
  const tables = document.tables.map((table) => {
    const filled = fillKoroTable(table, candidates, placed)
    for (const row of filled.rows) {
      for (const cell of row.cells) {
        if (cell.memberId && cell.firstName.trim()) placed.add(cell.memberId)
      }
    }
    return filled
  })
  return { ...document, tables }
}

/** New tiers match the widest existing tier, so a table keeps its formation. */
export function addKoroRow(table: KoroTable): KoroTable {
  const columns = Math.max(
    KORO_DEFAULT_COLUMNS,
    ...table.rows.map((row) => row.cells.length),
  )
  return { ...table, rows: [...table.rows, createKoroRow(columns)] }
}

export function createKoroDocument(): KoroDocument {
  const now = new Date().toISOString()
  const date = todayPHT()
  return {
    id: nanoid(),
    title: 'Special Occasion Koro',
    date,
    serviceDay: koroDayLabel(date),
    serviceTime: '6:00AM',
    organistMemberId: '',
    exportFontSize: 'large',
    group: 'mixed',
    tables: [createKoroTable()],
    createdAt: now,
    updatedAt: now,
  }
}

function koroMemberName(member: Member | undefined, cell: KoroCell): string {
  if (member) {
    const last = member.lastName.trim()
    const first = member.firstName.trim()
    if (last) return `${last}, ${first}`
    if (first) return first
  }
  return cell.firstName.trim()
}

export function assignmentsFromKoro(
  document: KoroDocument,
  members: Member[],
): SuguanAssignment[] {
  const memberById = new Map(members.map((member) => [member.id, member]))
  const assignedAt = new Date().toISOString()
  return document.tables.flatMap((table) =>
    table.rows.flatMap((row) =>
      row.cells.flatMap((cell) => {
        if (!cell.memberId || !cell.firstName.trim()) return []
        const member = memberById.get(cell.memberId)
        return [{
          memberId: cell.memberId,
          memberName: koroMemberName(member, cell),
          voicePosition: cell.voicePosition || member?.voicePosition || '',
          assignedAt,
        }]
      }),
    ),
  )
}

export interface KoroSuguanVoiceSection {
  voicePosition: string
  label: string
  members: string[]
}

export function buildKoroSuguanVoiceSections(
  document: KoroDocument,
  members: Member[],
  voices: VoicePosition[],
): KoroSuguanVoiceSection[] {
  const memberById = new Map(members.map((member) => [member.id, member]))
  const namesByVoice = new Map<string, string[]>()

  for (const table of document.tables) {
    for (const row of table.rows) {
      for (const cell of row.cells) {
        if (!cell.memberId || !cell.firstName.trim()) continue
        const voicePosition =
          cell.voicePosition || memberById.get(cell.memberId)?.voicePosition || ''
        if (!voicePosition) continue
        const names = namesByVoice.get(voicePosition) ?? []
        const member = memberById.get(cell.memberId)
        names.push(koroMemberName(member, cell))
        namesByVoice.set(voicePosition, names)
      }
    }
  }

  const isSoprano = (voice: VoicePosition) =>
    /soprano/i.test(`${voice.id} ${voice.name}`)
  const sopranoVoices = voices.filter(isSoprano)
  const sopranoMembers = sopranoVoices.flatMap(
    (voice) => namesByVoice.get(voice.id) ?? [],
  )
  const sections: KoroSuguanVoiceSection[] = [
    ...(sopranoMembers.length > 0
      ? [{
          voicePosition: 'soprano',
          label: 'SOPRANO',
          members: sopranoMembers,
        }]
      : []),
    ...voices
      .filter((voice) => !isSoprano(voice))
      .map((voice) => ({
        voicePosition: voice.id,
        label: voice.name.toUpperCase(),
        members: namesByVoice.get(voice.id) ?? [],
      }))
      .filter((section) => section.members.length > 0),
  ]
  const order = (label: string) =>
    ({ SOPRANO: 0, ALTO: 1, BASS: 2, TENOR: 3 })[label] ?? 4
  return sections.sort(
    (left, right) => order(left.label) - order(right.label),
  )
}

export function balanceKoroVoiceSections(
  sections: KoroSuguanVoiceSection[],
): [KoroSuguanVoiceSection[], KoroSuguanVoiceSection[]] {
  const columns: [KoroSuguanVoiceSection[], KoroSuguanVoiceSection[]] = [[], []]
  const heights = [0, 0]
  for (const section of sections) {
    const column = heights[0] <= heights[1] ? 0 : 1
    columns[column].push(section)
    heights[column] += section.members.length + 1
  }
  return columns
}

export function suguanFromKoro(
  document: KoroDocument,
  members: Member[],
): Suguan {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const now = new Date().toISOString()
  const schedules = document.tables.map((table) => ({
    id: table.id,
    scheduleLabel: table.title.trim() || 'KORO',
    scheduleDay: '',
    scheduleTime: '',
    assignments: table.rows.flatMap((row) =>
      row.cells.flatMap((cell) => {
        if (!cell.memberId || !cell.firstName.trim()) return []
        const member = membersById.get(cell.memberId)
        return [{
          memberId: cell.memberId,
          memberName: koroMemberName(member, cell),
          voicePosition: cell.voicePosition || member?.voicePosition || '',
          assignedAt: now,
        }]
      }),
    ),
  }))
  const assignments = schedules.flatMap((schedule) => schedule.assignments)
  return {
    id: document.id,
    date: document.date,
    time: '',
    serviceTypeId: 'special-occasion',
    group: document.group,
    docFormat: {
      paperSize: 'legal',
      orientation: 'portrait',
      margins: 'normal',
      scaling: 'auto',
      fontSize: 'normal',
    },
    events: [{ id: nanoid(), type: 'pagtupad', date: document.date }],
    schedules,
    voiceCapacities: {},
    assignments,
    dutyRoles: [],
    createdAt: document.createdAt,
    updatedAt: now,
  }
}
