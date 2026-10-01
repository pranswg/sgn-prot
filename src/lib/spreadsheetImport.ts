/**
 * Reads a Master List spreadsheet export back into roster candidates.
 *
 * The export buttons in Master List write CSV or XLSX with a fixed set of
 * headers (see `membersToRows` / `traineesToRows` in `export.ts`). This module
 * is the inverse: it maps those headers back onto `RosterCandidate` objects so
 * the same Import Roster review screen can accept a spreadsheet as well as a
 * PDF.
 *
 * It is deliberately tolerant. Headers are matched case-insensitively and
 * without caring about punctuation, and any header can be missing: a file with
 * only first name, last name, and gender still imports, with defaults filled
 * in. Values that cannot be understood fall back to a safe default rather than
 * discarding the row.
 */

import Papa from 'papaparse'
import { nanoid } from 'nanoid'
import type {
  ChoirPosition,
  Member,
  MembershipType,
  Trainee,
} from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import {
  CHOIR_POSITIONS,
  POSITION_LABELS,
  POSITION_SHORT_LABELS,
} from '@/core/constants/choirPositions'
import { normalizeNameKey, type RosterCandidate } from './rosterImport'
import { isDateKey } from './phDate'

/** The member export columns, used to document the accepted format. */
export const MEMBER_EXPORT_HEADERS = [
  'First Name',
  'Last Name',
  'Gender',
  'Voice Position',
  'Positions / Privileges',
  'Membership Type',
  'Status',
  'Date Added',
  'Notes',
] as const

/** The trainee export columns, which omit positions and membership type. */
export const TRAINEE_EXPORT_HEADERS = [
  'First Name',
  'Last Name',
  'Gender',
  'Voice Position',
  'Status',
  'Date Added',
  'Notes',
] as const

export interface SpreadsheetParseResult {
  candidates: RosterCandidate[]
  /** Row count before blank rows were dropped, for messaging. */
  rowCount: number
}

/** Header aliases, so hand-edited or older exports still map cleanly. */
const FIRST_NAME_KEYS = ['firstname', 'first', 'givenname', 'given']
const LAST_NAME_KEYS = ['lastname', 'last', 'surname', 'familyname', 'family']
const COMBINED_NAME_KEYS = ['name', 'fullname', 'membername']
const GENDER_KEYS = ['gender', 'sex']
const VOICE_KEYS = ['voiceposition', 'voice', 'section', 'voicesection']
const POSITIONS_KEYS = [
  'positionsprivileges',
  'positions',
  'privileges',
  'roles',
  'position',
]
const MEMBERSHIP_KEYS = ['membershiptype', 'membership']
const STATUS_KEYS = ['status', 'active']
const DATE_ADDED_KEYS = ['dateadded', 'datejoined', 'date', 'joined']
const NOTES_KEYS = ['notes', 'note', 'remarks', 'comments']

/** Normalizes a header for comparison: lowercase, alphanumeric only. */
function headerKey(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Finds the header row, which is not always the first row: a spreadsheet may
 * have a title, a blank line, or a stray note above the columns.
 */
function findHeaderRow(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 10)
  for (let index = 0; index < limit; index++) {
    const cells = matrix[index].map((cell) => cellToString(cell))
    const keys = cells.map(headerKey)
    const hasFirst = keys.some((k) => FIRST_NAME_KEYS.includes(k))
    const hasLast = keys.some((k) => LAST_NAME_KEYS.includes(k))
    if (hasFirst && hasLast) return index
    // A single "Name" column also identifies a roster sheet.
    if (keys.some((k) => COMBINED_NAME_KEYS.includes(k))) return index
  }
  return -1
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${month}-${day}`
  }
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  // ExcelJS can hand back rich text or hyperlink objects.
  if (typeof value === 'object' && 'richText' in value) {
    const rich = (value as { richText: { text: string }[] }).richText
    return rich.map((part) => part.text).join('')
  }
  if (typeof value === 'object' && 'text' in value) {
    return String((value as { text: unknown }).text ?? '')
  }
  if (typeof value === 'object' && 'result' in value) {
    return cellToString((value as { result: unknown }).result)
  }
  return String(value)
}

function indexHeaders(headerCells: string[]): Map<string, number> {
  const map = new Map<string, number>()
  headerCells.forEach((cell, index) => {
    const key = headerKey(cell)
    if (key && !map.has(key)) map.set(key, index)
  })
  return map
}

function pick(
  row: unknown[],
  headers: Map<string, number>,
  aliases: string[],
): string {
  for (const alias of aliases) {
    const index = headers.get(alias)
    if (index !== undefined) {
      const value = cellToString(row[index]).trim()
      if (value) return value
    }
  }
  return ''
}

function parseGender(value: string): 'male' | 'female' | '' {
  const key = value.toLowerCase().trim()
  if (key.startsWith('m')) return 'male'
  if (key.startsWith('f')) return 'female'
  return ''
}

/**
 * Resolves a voice section by id, full name, or short name (S1, S2, A, T, B),
 * since all three appear across the app.
 */
function resolveVoiceId(
  value: string,
  voices: VoicePosition[],
  gender: 'male' | 'female' | '',
): string {
  const key = value.toLowerCase().replace(/\s+/g, ' ')
  if (!key) return ''

  const byId = voices.find((v) => v.id.toLowerCase() === key)
  if (byId) return byId.id

  const byName = voices.find((v) => v.name.toLowerCase() === key)
  if (byName) return byName.id

  const byShort = voices.find(
    (v) => v.shortName?.toLowerCase() === key || v.shortName?.toLowerCase() === key.replace(/\s/g, ''),
  )
  if (byShort) return byShort.id

  // Fall back to a loose match, e.g. "Soprano I" for "Soprano 1".
  const loose = voices.find(
    (v) => v.name.toLowerCase().replace(/\s+/g, '') === key.replace(/\s+/g, ''),
  )
  if (loose) return loose.id

  // Unknown label: fall back to the first section matching the gender so the
  // member still lands in a valid section instead of being dropped.
  if (gender) {
    return voices.find((v) => v.gender === gender)?.id ?? voices[0]?.id ?? ''
  }
  return voices[0]?.id ?? ''
}

/**
 * Reverses `positionSummary`, which joins labels with ", ". Labels are matched
 * against both the long and short forms, and "—" means no positions.
 */
function resolvePositions(value: string): ChoirPosition[] {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === '–') return []

  const parts = trimmed
    .split(/[,;|]/)
    .map((part) => part.trim())
    .filter(Boolean)

  const found: ChoirPosition[] = []
  for (const part of parts) {
    const key = part.toLowerCase().replace(/\s+/g, '')
    const match = CHOIR_POSITIONS.find((p) => {
      const long = POSITION_LABELS[p.id].toLowerCase().replace(/\s+/g, '')
      const short = POSITION_SHORT_LABELS[p.id]
        .toLowerCase()
        .replace(/\s+/g, '')
      return key === long || key === short || key === p.id.replace(/-/g, '')
    })
    if (match && !found.includes(match.id)) found.push(match.id)
  }
  return found
}

function resolveMembershipType(value: string): MembershipType {
  return value.toLowerCase().startsWith('prov') ? 'provisional' : 'regular'
}

/**
 * Member exports write "Active"/"Inactive". Trainee exports write the raw
 * status, which can also be "promoted" or "removed"; both are inactive as far
 * as a member row is concerned.
 */
function resolveActive(value: string): boolean {
  const key = value.toLowerCase()
  if (!key) return true
  if (key.startsWith('inact') || key.startsWith('remov') || key.startsWith('left')) {
    return false
  }
  return true
}

function resolveDateAdded(value: string): string | undefined {
  const trimmed: string = value.trim()
  if (!trimmed) return undefined
  if (isDateKey(trimmed)) return trimmed
  // Tolerate a full ISO timestamp by taking the date part only. The cast keeps
  // the type predicate from narrowing `trimmed` to `never` on the false branch.
  const datePart = (trimmed as string).slice(0, 10)
  return isDateKey(datePart) ? datePart : undefined
}

/**
 * A sheet is treated as trainees when it has no membership-type or
 * positions column, which is exactly how `traineesToRows` differs from
 * `membersToRows`. A sheet carrying either column is a member export.
 */
function looksLikeMemberExport(headers: Map<string, number>): boolean {
  if ([...headers.keys()].some((k) => MEMBERSHIP_KEYS.includes(k))) return true
  if ([...headers.keys()].some((k) => POSITIONS_KEYS.includes(k))) return true
  return false
}

function sectionLabelFor(
  isTrainee: boolean,
  voices: VoicePosition[],
  voiceId: string,
): string {
  if (isTrainee) return 'Imported trainees'
  const voice = voices.find((v) => v.id === voiceId)
  return voice?.name ?? 'Imported members'
}

/**
 * Maps a header row plus data rows onto candidates. Exported so the same
 * mapping is used by the CSV and XLSX readers and is directly testable.
 */
export function rowsToCandidates(
  matrix: unknown[][],
  voices: VoicePosition[],
  members: Member[],
  trainees: Trainee[],
): SpreadsheetParseResult {
  const headerIndex = findHeaderRow(matrix)
  if (headerIndex < 0) {
    return { candidates: [], rowCount: matrix.length }
  }

  const headers = indexHeaders(matrix[headerIndex].map(cellToString))
  const isMemberSheet = looksLikeMemberExport(headers)

  const existing = new Set<string>()
  for (const m of members) existing.add(normalizeNameKey(m.lastName, m.firstName))
  for (const t of trainees) {
    const key = normalizeNameKey(t.lastName, t.firstName)
    if (!existing.has(key)) existing.add(key)
  }

  const seen = new Set<string>()
  const candidates: RosterCandidate[] = []
  let rowCount = 0

  for (let index = headerIndex + 1; index < matrix.length; index++) {
    const row = matrix[index]
    if (!row || row.every((cell) => cellToString(cell).trim() === '')) continue

    const firstName = pick(row, headers, FIRST_NAME_KEYS)
    const lastName = pick(row, headers, LAST_NAME_KEYS)
    const combined = pick(row, headers, COMBINED_NAME_KEYS)

    let resolvedFirst = firstName
    let resolvedLast = lastName
    if (!resolvedFirst && !resolvedLast) {
      if (!combined) continue
      // "Last, First" is the roster convention; otherwise the last token is
      // treated as the last name.
      if (combined.includes(',')) {
        const [before, after] = combined.split(',', 2)
        resolvedLast = before.trim()
        resolvedFirst = after.trim()
      } else {
        const tokens = combined.split(/\s+/).filter(Boolean)
        if (tokens.length < 2) continue
        resolvedFirst = tokens[0]
        resolvedLast = tokens.slice(1).join(' ')
      }
    }
    if (!resolvedLast || !resolvedFirst) continue
    rowCount++

    const gender = parseGender(pick(row, headers, GENDER_KEYS))
    const voiceValue = pick(row, headers, VOICE_KEYS)
    const voicePosition = resolveVoiceId(voiceValue, voices, gender)

    const key = normalizeNameKey(resolvedLast, resolvedFirst)
    const duplicate = existing.has(key) || seen.has(key)
    seen.add(key)

    const statusValue = pick(row, headers, STATUS_KEYS)
    const isActive = resolveActive(statusValue)
    const notes = pick(row, headers, NOTES_KEYS)

    candidates.push({
      id: nanoid(),
      section: sectionLabelFor(!isMemberSheet, voices, voicePosition),
      isTrainee: !isMemberSheet,
      firstName: resolvedFirst,
      lastName: resolvedLast,
      // A trainee row's Status can be "promoted", which implies male/female is
      // unknown; default to female as the roster PDF path already does.
      gender: gender || 'female',
      voicePosition,
      isActive,
      notes,
      duplicate,
      selected: !duplicate,
      membershipType: isMemberSheet
        ? resolveMembershipType(pick(row, headers, MEMBERSHIP_KEYS))
        : undefined,
      positions: isMemberSheet
        ? resolvePositions(pick(row, headers, POSITIONS_KEYS))
        : undefined,
      dateAdded: resolveDateAdded(pick(row, headers, DATE_ADDED_KEYS)),
    })
  }

  return { candidates, rowCount }
}

export function isSpreadsheetFile(file: File): boolean {
  return /\.(csv|xlsx|xlsm|xls)$/i.test(file.name)
}

/** Parses CSV text. Uses Papa so quoted commas and newlines are handled. */
export function parseCsvText(text: string): string[][] {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
  })
  return (result.data as string[][]).map((row) => row.map((cell) => cell ?? ''))
}

/** Reads the first worksheet of an XLSX/XLSM workbook into a cell matrix. */
export async function readWorkbookMatrix(file: File): Promise<unknown[][]> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const matrix: unknown[][] = []
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: unknown[] = []
    const count = row.cellCount
    for (let index = 1; index <= count; index++) {
      values.push(row.getCell(index).value)
    }
    matrix.push(values)
  })
  return matrix
}

/**
 * Entry point for spreadsheets, mirroring `extractRosterFromPdf`. The caller
 * passes the file through unchanged, so PDF keeps its own reader.
 */
export async function extractRosterFromSpreadsheet(
  file: File,
  voices: VoicePosition[],
  members: Member[],
  trainees: Trainee[],
): Promise<SpreadsheetParseResult> {
  const matrix = /\.csv$/i.test(file.name)
    ? parseCsvText(await file.text())
    : await readWorkbookMatrix(file)

  return rowsToCandidates(matrix, voices, members, trainees)
}
