/**
 * The two choirs the app manages.
 *
 * AWS (Adult Worship Service) is the original pool every list belonged to;
 * PNK (Pagsamba ng Kabataan) is a second, sealed pool with its own Master List,
 * trainees and history. Both live in the same member store with a `choir` field
 * rather than in a second store, so write-through, backup, restore, import and
 * the permission checks stay one code path (see the PNK plan).
 *
 * `choir` is optional on stored records: everything saved before store version
 * 8 predates the field, and `choirOf()` reads that as AWS.
 */
import type { Choir, Member, Trainee } from '@/core/types/member'

export const CHOIRS: readonly Choir[] = ['aws', 'pnk']

export const CHOIR_LABELS: Record<Choir, string> = {
  aws: 'AWS',
  pnk: 'PNK',
}

/** Spelled out only where there is room for it (Settings, empty states). */
export const CHOIR_NAMES: Record<Choir, string> = {
  aws: 'Adult Worship Service',
  pnk: 'Pagsamba ng Kabataan',
}

/** Every record's choir, with legacy records read as AWS. */
export function choirOf(person: { choir?: Choir } | null | undefined): Choir {
  return person?.choir === 'pnk' ? 'pnk' : 'aws'
}

export function isPnk(person: { choir?: Choir } | null | undefined): boolean {
  return choirOf(person) === 'pnk'
}

/**
 * The one place a page narrows the roster to its own choir. Every list, count,
 * export and picker goes through these rather than filtering inline, so a new
 * screen cannot quietly show both choirs.
 */
export function membersOf(
  members: readonly Member[],
  choir: Choir,
): Member[] {
  return members.filter((member) => choirOf(member) === choir)
}

export function traineesOf(
  trainees: readonly Trainee[],
  choir: Choir,
): Trainee[] {
  return trainees.filter((trainee) => choirOf(trainee) === choir)
}

/**
 * PNK has no voice sections: every member is a Soprano 2. Its pages therefore
 * hide the voice filters, the voice column, and the form's voice picker, and
 * store this id instead — resolved from the configured voices so renamed
 * positions still match.
 */
export function pnkVoicePositionId(
  voices: readonly { id: string; name: string }[],
): string {
  const sopranoTwo = voices.find((voice) =>
    /^soprano\s*2$/i.test(voice.name.trim()),
  )
  const soprano = voices.find((voice) => /^soprano(?:\s*1)?$/i.test(voice.name.trim()))
  return sopranoTwo?.id ?? soprano?.id ?? voices[0]?.id ?? 'soprano-2'
}
