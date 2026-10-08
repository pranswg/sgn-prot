/**
 * One filename convention for every export-compatible feature in the app.
 *
 *   {YYYYMMDD}_{hh-mmAMPM} - {Document Name}.{extension}
 *
 * e.g. `20261008_07-00PM - Women Choir Suguan.pdf`
 *
 * The timestamp half is Philippine time on purpose (like every date in the
 * app) and the document name is sanitised so the generated file never trips
 * an operating-system filename rule. Every export that downloads a file builds
 * its name through `exportFileName` — never a hand-rolled stamp — so a new
 * export follows the convention by construction.
 */
import type { SuguanGroup } from '@/core/types/suguan'
import { filenameTimestampPHT } from './phDate'

/** Characters Windows and other platforms reject inside a filename. */
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]+/g

/**
 * Keeps the human-readable document name but strips the characters a file
 * system would reject (`<>:"/\|?*`). Consecutive collapsed spaces avoid
 * doubled gaps around a removed character.
 */
export function sanitizeExportName(name: string): string {
  return name.replace(UNSAFE_FILENAME_CHARS, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Builds a fully-formed export filename:
 * `{timestamp} - {Document Name}.{ext}`.
 *
 * `timestamp` defaults to the PHT stamp captured when the name is built, so a
 * preview dialog can build the name up front and re-use the same value when
 * the export actually downloads (the saved file then matches what the user
 * confirmed).
 */
export function exportFileName(
  documentName: string,
  ext: string,
  timestamp = filenameTimestampPHT(),
): string {
  const extension = ext.replace(/^\./, '').toLowerCase()
  return `${timestamp} - ${sanitizeExportName(documentName)}.${extension}`
}

/**
 * The gender word used in Suguan document names, e.g. `Women Choir` for the
 * singing sheet's group. Reads the same `babae` / `lalaki` / `mixed` values
 * the rest of the app maps Chromatically to sheet accents.
 */
export function suguanExportGroupLabel(group: SuguanGroup): string {
  if (group === 'lalaki') return 'Men Choir'
  if (group === 'mixed') return 'Mixed Choir'
  return 'Women Choir'
}

/**
 * The gender word for a Master List spreadsheet that exports one gender; an
 * "everyone" export returns an empty label so the name becomes plain
 * `- Master List.xlsx` (no "Mixed Choir" — the directory is the full roster).
 */
export function masterListExportGroupLabel(
  gender: 'all' | 'male' | 'female',
): string {
  if (gender === 'female') return 'Women Choir'
  if (gender === 'male') return 'Men Choir'
  return ''
}

/**
 * `Master List`, `Women Choir Master List`, or `Men Choir Master List` — the
 * full human-readable document name for a directory spreadsheet.
 */
export function masterListExportDocumentName(
  gender: 'all' | 'male' | 'female',
): string {
  const group = masterListExportGroupLabel(gender)
  return group ? `${group} Master List` : 'Master List'
}