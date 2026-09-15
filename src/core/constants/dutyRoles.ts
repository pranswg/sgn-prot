import type { DutyRole } from '@/core/types/suguan'

export const DEFAULT_DUTY_ROLES: DutyRole[] = [
  { id: 'oic', name: 'OIC of the Group', abbreviation: 'OIC' },
  { id: 'pangulong-mang-aawit', name: 'Pangulong Mang-aawit', abbreviation: 'PM' },
  { id: 'kalihim', name: 'Kalihim ng Mang-aawit', abbreviation: 'KM' },
  { id: 'organista', name: 'Organista', abbreviation: 'ORG' },
  { id: 'organista-reserve', name: 'Reserve Organist', abbreviation: 'R-ORG' },
]

export const DUTY_ROLES_MAP = Object.fromEntries(
  DEFAULT_DUTY_ROLES.map((r) => [r.id, r]),
)

export const REGULAR_WORSHIP_DUTY_ROLES = [
  'oic',
  'pangulong-mang-aawit',
  'kalihim',
  'organista',
  'organista-reserve',
]