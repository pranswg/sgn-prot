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
 * The voices PNK may sing, in picker order. Settings owns the ids, names and
 * colours, so these are matched against the configured list by name.
 */
export const PNK_VOICE_NAMES = ['Soprano 1', 'Soprano 2', 'Alto'] as const

function normalizeVoiceName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The configured voices PNK offers: Soprano 1, Soprano 2 and Alto, in that
 * order. A voice the administrator renamed is simply absent; nothing here is
 * hard-coded to a settings-generated id.
 */
export function pnkVoiceOptions<T extends { name: string }>(
  voices: readonly T[],
): T[] {
  return PNK_VOICE_NAMES.flatMap((name) => {
    const key = normalizeVoiceName(name)
    const match = voices.find((voice) => normalizeVoiceName(voice.name) === key)
    return match ? [match] : []
  })
}

/**
 * PNK's default voice: the configured Soprano 2, falling back to a configured
 * soprano and finally the standard id, so renamed positions still resolve.
 */
export function pnkVoicePositionId(
  voices: readonly { id: string; name: string }[],
): string {
  const sopranoTwoKey = normalizeVoiceName(PNK_VOICE_NAMES[1])
  const sopranoTwo = voices.find(
    (voice) => normalizeVoiceName(voice.name) === sopranoTwoKey,
  )
  const soprano = voices.find((voice) =>
    /^soprano(?:\s*1)?$/i.test(voice.name.trim()),
  )
  return sopranoTwo?.id ?? soprano?.id ?? voices[0]?.id ?? 'soprano-2'
}
