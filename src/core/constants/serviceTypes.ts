import type { ServiceType, VoicePosition } from '@/core/types/suguan'

export const DEFAULT_SERVICE_TYPES: ServiceType[] = [
  { id: 'pagsamba', name: 'Pagsamba' },
  { id: 'paghahanda-sa-taunang-pasalamat', name: 'Paghahanda sa Taunang Pasalamat' },
  { id: 'paghahanda-sa-banal-na-hapunan', name: 'Paghahanda sa Banal na Hapunan' },
  { id: 'tanging-pagtitipon', name: 'Tanging Pagtitipon' },
  { id: 'pamamahayag', name: 'Pamamahayag' },
  { id: 'bautismo', name: 'Bautismo' },
  { id: 'kasal', name: 'Kasal' },
  { id: 'tanging-pagsamba', name: 'Tanging Pagsamba' },
  { id: 'pasalamat', name: 'Pasalamat' },
  { id: 'banal-na-hapunan', name: 'Banal na Hapunan' },
]

export function defaultCapacities(voices: VoicePosition[]): Record<string, number> {
  return Object.fromEntries(
    voices.map((v) => [v.id, v.gender === 'female' ? 4 : 3]),
  )
}