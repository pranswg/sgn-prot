export interface VoicePosition {
  id: string
  name: string
  shortName: string
  gender: 'male' | 'female'
}

export interface DutyRole {
  id: string
  name: string
  abbreviation: string
}

export interface ServiceType {
  id: string
  name: string
}

export interface SuguanAssignment {
  memberId: string
  memberName: string
  voicePosition: string
  assignedAt: string
}

export interface SuguanDutyRole {
  memberId: string
  memberName: string
  dutyRoleId: string
}

export interface Suguan {
  id: string
  date: string
  time: string
  serviceTypeId: string
  location?: string
  notes?: string
  voiceCapacities: Record<string, number>
  assignments: SuguanAssignment[]
  dutyRoles: SuguanDutyRole[]
  createdAt: string
  updatedAt: string
}