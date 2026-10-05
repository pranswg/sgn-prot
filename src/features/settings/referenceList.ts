/**
 * Pure helpers shared by the three reference lists in Settings.
 *
 * Kept out of the components so the rules that decide whether a save is legal
 * can be tested without a DOM, and so the desktop card and the mobile sheet
 * cannot drift into different rules.
 */

/** One editable field on a reference list item. */
export interface ReferenceField {
  /** Store key, e.g. 'name' or 'abbreviation'. */
  key: string
  label: string
  /** Ignored when `options` is set. */
  placeholder?: string
  /** When present the field renders as a choice instead of a text input. */
  options?: { value: string; label: string }[]
  /** Optional width hint, e.g. 'w-24' or 'w-28'. */
  className?: string
}

/** The editable fields of one item, keyed by field key. */
export type ReferenceValues = Record<string, string>

/** Reads the editable fields off a stored item, ready for a form. */
export function valuesFrom<T extends object>(
  item: T,
  fields: ReferenceField[],
): ReferenceValues {
  // Stored items are interfaces, which carry no index signature of their own.
  const source = item as unknown as Record<string, unknown>
  const values: ReferenceValues = {}
  for (const field of fields) {
    const raw = source[field.key]
    values[field.key] = typeof raw === 'string' ? raw : ''
  }
  return values
}

/**
 * Why a name cannot be saved, or `null` when it can.
 *
 * Names are the identity a user sees in pickers, schedules, and exports, so a
 * blank name and a second entry with the same name are both rejected. The
 * comparison ignores case and surrounding space, and the entry being edited is
 * excluded so renaming a row to its own name stays legal.
 */
export function referenceProblem(
  name: string,
  existing: { id: string; label: string }[],
  editingId: string | null,
): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Enter a name.'

  const clash = existing.some(
    (entry) =>
      entry.id !== editingId &&
      entry.label.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  return clash ? 'This name is already in the list.' : null
}

/** Duty roles fall back to a three-letter uppercase abbreviation. */
export function deriveAbbreviation(name: string): string {
  return name.trim().slice(0, 3).toUpperCase()
}

export function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function plural(noun: string): string {
  // "voice position" -> "voice positions"; irregulars are not needed here.
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`
  return `${noun}s`
}
