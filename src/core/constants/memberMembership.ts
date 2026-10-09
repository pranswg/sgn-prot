import type { ChoirPosition, Member, MembershipType } from '@/core/types/member'
import type { VoicePosition } from '@/core/types/suguan'
import { getVoiceName } from '@/core/constants/voicePositions'

/**
 * The membership categories the member forms offer. Order here is the order
 * shown in the dropdown. There is deliberately no Trainee option: people in
 * training live in their own list, not on the Master List.
 */
export const MEMBERSHIP_OPTIONS: { value: MembershipType; label: string }[] = [
  { value: 'regular', label: 'Mang-aawit' },
  { value: 'organista', label: 'Organista' },
  { value: 'tagapagturo', label: 'Tagapagturo ng Awit' },
  { value: 'assistant-tagapagturo', label: 'Assistant Tagapagturo ng Awit' },
]

export const MEMBERSHIP_LABELS: Record<MembershipType, string> =
  Object.fromEntries(MEMBERSHIP_OPTIONS.map((o) => [o.value, o.label])) as Record<
    MembershipType,
    string
  >

/** Compact names for tight spaces such as the directory table's Membership cell. */
export const MEMBERSHIP_SHORT_LABELS: Record<MembershipType, string> = {
  regular: 'Mang-aawit',
  organista: 'Organista',
  tagapagturo: 'Tagapagturo',
  'assistant-tagapagturo': 'Asst. Tagapagturo',
}

/**
 * The three organist-family memberships are one category: Organista,
 * Tagapagturo, and Assistant Tagapagturo all count for the Organist Suguan and
 * for the Choir Suguan's organista duty role. Only `regular` is outside it.
 */
export function isOrganistMembership(type: MembershipType): boolean {
  return type === 'organista' || type === 'tagapagturo' || type === 'assistant-tagapagturo'
}

/**
 * True when the member should appear on the Organist Suguan's member list:
 * either a contemporary membership category, or a legacy member who holds the
 * stored Organista / Assistant Tagapagturo position.
 */
export function memberIsOrganist(
  member: Pick<Member, 'membershipType' | 'positions'>,
): boolean {
  return (
    isOrganistMembership(member.membershipType) ||
    (member.positions ?? []).some(
      (p) => p === 'organista' || p === 'assistant-tagapagturo',
    )
  )
}

/**
 * The positions a member effectively holds. The organist category is derived
 * into the canonical `organista` position so consumers that still read stored
 * positions (directory filters, counts, exports, duty-role eligibility) see an
 * Organista-category member everywhere the old privileges list did.
 */
export function memberEffectivePositions(
  member: Pick<Member, 'membershipType' | 'positions'>,
): ChoirPosition[] {
  const base = member.positions ?? []
  if (!isOrganistMembership(member.membershipType)) return base
  return base.includes('organista') ? base : [...base, 'organista']
}

/**
 * The single "Position" a member shows in the directory: organist-family
 * members display their membership label (their voice is flexible), everyone
 * else displays their voice name.
 */
export function memberPositionLabel(
  member: Pick<Member, 'membershipType' | 'voicePosition'>,
  voices: VoicePosition[] = [],
): string {
  return isOrganistMembership(member.membershipType)
    ? MEMBERSHIP_SHORT_LABELS[member.membershipType]
    : getVoiceName(member.voicePosition, voices)
}