export type Gender = 'male' | 'female'

export type MembershipType = 'regular' | 'provisional'

export type ChoirPosition =
  | 'oic'
  | 'kalihim-ng-mang-aawit'
  | 'pangulong-mang-aawit'
  | 'organista'
  | 'assistant-tagapagturo'

export interface Member {
  id: string
  firstName: string
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