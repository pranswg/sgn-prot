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
import type { Choir } from '@/core/types/member'
import { CHOIR_LABELS } from './choirs'
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

export function extraOccasionExportDocumentName(occasionName: string): string {
  const name = occasionName.trim()
  return name ? `${name} Suguan` : 'Extra Occasion Suguan'
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
 * `{AWS|PNK} Master List` (no "Mixed Choir" — the directory is the full
 * roster).
 */
export function masterListExportGroupLabel(
  gender: 'all' | 'male' | 'female',
): string {
  if (gender === 'female') return 'Women Choir'
  if (gender === 'male') return 'Men Choir'
  return ''
}

/**
 * `AWS Master List`, `PNK Women Choir Master List`, … — the full human-readable
 * document name for a directory spreadsheet.
 *
 * The choir prefix is not decoration: both choirs export a Master List, and an
 * untagged file could not be told apart once it left the app.
 */
export function masterListExportDocumentName(
  gender: 'all' | 'male' | 'female',
  choir: Choir = 'aws',
): string {
  const group = masterListExportGroupLabel(gender)
  const base = group ? `${group} Master List` : 'Master List'
  return `${CHOIR_LABELS[choir]} ${base}`
}