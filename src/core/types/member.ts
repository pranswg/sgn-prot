export type Gender = 'male' | 'female'

/**
 * A member's category in the choir. The three organist-family categories —
 * `organista`, `tagapagturo`, and `assistant-tagapagturo` — are one category:
 * all of them count as Organists for the Organist Suguan and the Choir
 * Suguan's organista duty role. The legacy `provisional` value was migrated to
 * `regular` in store version 4.
 */
export type MembershipType =
  | 'regular'
  | 'organista'
  | 'tagapagturo'
  | 'assistant-tagapagturo'

export type ChoirPosition =
  | 'oic'
  | 'kalihim-ng-mang-aawit'
  | 'pangulong-mang-aawit'
  | 'organista'
  | 'assistant-tagapagturo'

export interface Member {
  id: string
  firstName: string
  middleName?: string
  suffix?: string
  lastName: string
  gender: Gender
  voicePosition: string
  membershipType: MembershipType
  isActive: boolean
  dateAdded: string
  positions: ChoirPosition[]
  notes?: string
}

export interface Trainee {
  id: string
  firstName: string
  lastName: string
  gender: Gender
  voicePosition: string
  status: 'active' | 'inactive' | 'promoted' | 'removed'
  dateAdded: string
  promotedToMemberId?: string
  notes?: string
}

export interface MemberInput {
  firstName: string
  middleName?: string
  suffix?: string
  lastName: string
  gender: Gender
  voicePosition: string
  membershipType: MembershipType
  isActive: boolean
  dateAdded: string
  positions?: ChoirPosition[]
  notes?: string
}

export interface TraineeInput {
  firstName: string
  lastName: string
  gender: Gender
  voicePosition: string
  status: 'active' | 'inactive'
  dateAdded: string
  notes?: string
}