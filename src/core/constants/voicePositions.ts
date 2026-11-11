import type { VoicePosition } from '@/core/types/suguan'

export function buildVoiceMap(voices: VoicePosition[]): Record<string, VoicePosition> {
  return Object.fromEntries(voices.map((v) => [v.id, v]))
}

/**
 * The printed abbreviation for a voice. The standard choir voices shrink to a
 * letter and a number (Soprano 1 → S1, Alto → A), which is what the Suguan
 * sheets, the Koro legend and the voice chips use. Any other name keeps the
 * first-two-letters rule, and a numbered name takes its initial plus the
 * number (Soprano 3 → S3).
 */
export function voiceShortName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const standard: Record<string, string> = {
    'soprano 1': 'S1',
    'soprano 2': 'S2',
    alto: 'A',
    tenor: 'T',
    bass: 'B',
  }
  const known = standard[normalized.toLowerCase()]
  if (known) return known
  const numbered = /^([\p{L}]+)\s*(\d+)$/u.exec(normalized)
  if (numbered) return `${numbered[1][0]}${numbered[2]}`.toUpperCase()
  return normalized.slice(0, 2).toUpperCase()
}

/**
 * Rewrites every voice's stored abbreviation through `voiceShortName`. The
 * abbreviation is always derived here (the Settings form has no field for it),
 * so this repairs lists saved under the older two-letter rule.
 */
export function withVoiceShortNames<T extends VoicePosition>(voices: T[]): T[] {
  return voices.map((voice) => ({
    ...voice,
    shortName: voiceShortName(voice.name),
  }))
}

/** Sentinel voice id for a trainee with no target voice yet. */
export const UNASSIGNED_VOICE_ID = 'unassigned'
export const UNASSIGNED_VOICE_LABEL = 'No voice assigned yet'

export function getVoicePosition(id: string, voices: VoicePosition[] = []): VoicePosition | undefined {
  const map = buildVoiceMap(voices)
  return map[id]
}

export function getVoiceName(id: string, voices: VoicePosition[] = []): string {
  if (id === UNASSIGNED_VOICE_ID) return UNASSIGNED_VOICE_LABEL
  const map = buildVoiceMap(voices)
  return map[id]?.name ?? id
}

export function voicePositionsForGender(
  gender: 'male' | 'female',
  voices: VoicePosition[] = [],
): VoicePosition[] {
  return voices.filter((v) => v.gender === gender)
}