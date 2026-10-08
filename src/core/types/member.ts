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

/** Why a member left the choir. Recorded on a `transferred-out` event. */
export type TransferReason =
  | 'transferred-locale'
  | 'temporarily-inactive'
  | 'other'

/** The kinds of membership milestone a member can pass through. */
export type MemberHistoryType = 'joined' | 'transferred-out' | 'returned'

/**
 * One milestone in a member's membership journey. Everyone starts with a
 * `joined` event; a transfer-out appends `transferred-out`, and coming back to
 * the choir appends `returned` on the SAME profile rather than creating a new
 * record. Events are appended, never rewritten, so the timeline is the archive.
 */
export interface MemberHistoryEvent {
  id: string
  type: MemberHistoryType
  /** Calendar date `YYYY-MM-DD` the event happened. */
  date: string
  /** The voice the member held at this point in time. */
  voicePosition?: string
  /** Why a member transferred out. */
  reason?: TransferReason
  notes?: string
  /** Display name of whoever recorded the event. */
  actorName?: string
  /** Unix instant the event was recorded, ISO 8601. */
  createdAt: string
}

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
  assignedDutyRoleIds?: string[]
  notes?: string
  /**
   * Ordered membership milestones, oldest first. Absent on members persisted
   * before store version 6; treat missing as `[]`.
   */
  history?: MemberHistoryEvent[]
}

export interface Trainee {
  id: string
  firstName: string
  middleName?: string
  suffix?: string
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
  assignedDutyRoleIds?: string[]
  notes?: string
}

export interface TraineeInput {
  firstName: string
  middleName?: string
  suffix?: string
  lastName: string
  gender: Gender
  voicePosition: string
  status: 'active' | 'inactive'
  dateAdded: string
  notes?: string
}