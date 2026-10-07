import type { Member, ChoirPosition } from '@/core/types/member'
import { isOrganistMembership } from '@/core/constants/memberMembership'

export const CHOIR_POSITIONS: { id: ChoirPosition; label: string }[] = [
  { id: 'oic', label: 'OIC' },
  { id: 'kalihim-ng-mang-aawit', label: 'Kalihim ng Mang-aawit' },
  { id: 'pangulong-mang-aawit', label: 'Pangulong Mang-aawit' },
  { id: 'organista', label: 'Organista' },
  { id: 'assistant-tagapagturo', label: 'Assistant Tagapagturo' },
]

export const POSITION_LABELS: Record<ChoirPosition, string> = Object.fromEntries(
  CHOIR_POSITIONS.map((p) => [p.id, p.label]),
) as Record<ChoirPosition, string>

export const POSITION_SHORT_LABELS: Record<ChoirPosition, string> = {
  oic: 'OIC',
  'kalihim-ng-mang-aawit': 'Kalihim',
  'pangulong-mang-aawit': 'Pangulong',
  organista: 'Organista',
  'assistant-tagapagturo': 'Asst. Tagapagturo',
}

export const DUTY_ROLE_REQUIRED_POSITIONS: Record<string, ChoirPosition[]> = {
  oic: ['oic'],
  'pangulong-mang-aawit': ['pangulong-mang-aawit'],
  kalihim: ['kalihim-ng-mang-aawit'],
  organista: ['organista', 'assistant-tagapagturo'],
  'organista-reserve': ['organista', 'assistant-tagapagturo'],
}

export function memberCanHoldDutyRole(
  member: Pick<Member, 'positions' | 'membershipType'>,
  roleId: string,
): boolean {
  const required = DUTY_ROLE_REQUIRED_POSITIONS[roleId]
  if (!required) return true
  // The Organista and Assistant Tagapagturo memberships (plus the 
  // Tagapagturo, which the form folds into the same category) are treated as
  // holding the organista position, so they may be assigned the organista
  // duty role without a separately stored privilege.
  if (
    (roleId === 'organista' || roleId === 'organista-reserve') &&
    isOrganistMembership(member.membershipType)
  ) {
    return true
  }
  return (member.positions ?? []).some((p) => required.includes(p))
}

export function positionSummary(positions: ChoirPosition[] | undefined): string {
  if (!positions || positions.length === 0) return '—'
  return positions.map((p) => POSITION_LABELS[p]).join(', ')
}
