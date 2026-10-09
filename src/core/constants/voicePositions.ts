import type { VoicePosition } from '@/core/types/suguan'

export function buildVoiceMap(voices: VoicePosition[]): Record<string, VoicePosition> {
  return Object.fromEntries(voices.map((v) => [v.id, v]))
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