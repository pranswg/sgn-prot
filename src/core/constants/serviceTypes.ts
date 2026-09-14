import type { ServiceType, VoicePosition } from '@/core/types/suguan'

export const DEFAULT_SERVICE_TYPES: ServiceType[] = [
  { id: 'huwebes-am', name: 'Huwebes AM' },
  { id: 'huwebes-pm', name: 'Huwebes PM' },
  { id: 'linggo-am', name: 'Linggo AM' },
  { id: 'linggo-pm', name: 'Linggo PM' },
  { id: 'pamamahayag', name: 'Pamamahayag' },
  { id: 'tanging-pagsamba', name: 'Tanging Pagsamba' },
]

export function defaultCapacities(voices: VoicePosition[]): Record<string, number> {
  return Object.fromEntries(
    voices.map((v) => [v.id, v.gender === 'female' ? 4 : 3]),
  )
}