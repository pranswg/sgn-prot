import type { VoicePosition } from '@/core/types/suguan'

export const DEFAULT_VOICE_POSITIONS: VoicePosition[] = [
  { id: 'soprano-1', name: 'Soprano 1', shortName: 'S1', gender: 'female' },
  { id: 'soprano-2', name: 'Soprano 2', shortName: 'S2', gender: 'female' },
  { id: 'alto', name: 'Alto', shortName: 'A', gender: 'female' },
  { id: 'tenor', name: 'Tenor', shortName: 'T', gender: 'male' },
  { id: 'bass', name: 'Bass', shortName: 'B', gender: 'male' },
]

export const DEFAULT_VOICE_MAP: Record<string, VoicePosition> = Object.fromEntries(
  DEFAULT_VOICE_POSITIONS.map((v) => [v.id, v]),
)

export function buildVoiceMap(voices: VoicePosition[]): Record<string, VoicePosition> {
  return Object.fromEntries(voices.map((v) => [v.id, v]))
}

export function getVoicePosition(id: string, voices: VoicePosition[] = DEFAULT_VOICE_POSITIONS): VoicePosition {
  const map = buildVoiceMap(voices)
  return map[id] ?? voices[0]
}

export function getVoiceName(id: string, voices: VoicePosition[] = DEFAULT_VOICE_POSITIONS): string {
  const map = buildVoiceMap(voices)
  return map[id]?.name ?? id
}

export function voicePositionsForGender(
  gender: 'male' | 'female',
  voices: VoicePosition[] = DEFAULT_VOICE_POSITIONS,
): VoicePosition[] {
  return voices.filter((v) => v.gender === gender)
}