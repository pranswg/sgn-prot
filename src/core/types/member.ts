export type Gender = 'male' | 'female'

export type MembershipType = 'regular' | 'provisional'

export interface Member {
  id: string
  firstName: string
  lastName: string
  gender: Gender
  voicePosition: string
  membershipType: MembershipType
  isActive: boolean
  dateAdded: string
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