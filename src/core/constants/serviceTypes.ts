import type { VoicePosition } from '@/core/types/suguan'

export function defaultCapacities(voices: VoicePosition[]): Record<string, number> {
  return Object.fromEntries(
    voices.map((v) => [v.id, v.gender === 'female' ? 4 : 3]),
  )
}