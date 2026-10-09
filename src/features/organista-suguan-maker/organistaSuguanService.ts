import { nanoid } from 'nanoid'
import type { OrganistaSuguanService } from '@/core/types/organistaSuguan'
import type { Member } from '@/core/types/member'
import type {
  WorshipSchedule,
  WorshipScheduleCategories,
} from '@/core/constants/worshipSchedules'
import { worshipDayName } from '@/core/constants/worshipSchedules'
import { POSITION_LABELS } from '@/core/constants/choirPositions'
import {
  isOrganistMembership,
  MEMBERSHIP_LABELS,
} from '@/core/constants/memberMembership'
import {
  getVoiceName,
  UNASSIGNED_VOICE_LABEL,
} from '@/core/constants/voicePositions'
import type { VoicePosition } from '@/core/types/suguan'

export type WorshipScheduleCategory = 'midweek' | 'weekend'

export const CATEGORY_LABELS: Record<WorshipScheduleCategory, string> = {
  midweek: 'Midweek Worship',
  weekend: 'Weekend Worship',
}

export function categoryLabel(category: WorshipScheduleCategory): string {
  return CATEGORY_LABELS[category]
}

/** The written heading for a service, e.g. "Miyerkules 7:00 PM". */
export function buildServiceHeading(
  dayName: string,
  scheduleTime: string,
): string {
  return `${dayName} ${scheduleTime}`
}

/**
 * Snapshot a chosen worship schedule into a new service card. The schedule's
 * day, time and category are captured here, so an unsaved card keeps the
 * schedule it was picked with, and a saved record keeps it forever.
 */
export function createServiceFromSchedule(
  schedule: WorshipSchedule,
  category: WorshipScheduleCategory,
): OrganistaSuguanService {
  const dayName = worshipDayName(schedule.weekday)
  return {
    id: nanoid(),
    scheduleId: schedule.id,
    dayName,
    scheduleTime: schedule.scheduleTime,
    categoryLabel: categoryLabel(category),
    heading: buildServiceHeading(dayName, schedule.scheduleTime),
    organist: '',
    reserve: '',
  }
}

/**
 * The default service list for a new Organist Suguan: one card per currently
 * configured, enabled worship schedule, midweek before weekend. Empty when the
 * admin has disabled or removed every schedule.
 */
export function servicesFromCategories(
  categories: WorshipScheduleCategories,
): OrganistaSuguanService[] {
  return [
    ...categories.midweek.map((s) => createServiceFromSchedule(s, 'midweek')),
    ...categories.weekend.map((s) => createServiceFromSchedule(s, 'weekend')),
  ]
}

/**
 * The privilege a member qualifies under on the Organist Suguan: their
 * membership label for the three organist-family memberships, or the stored
 * Organista / Assistant Tagapagturo position for legacy members. Empty for
 * members who should not appear at all.
 */
export function organistPrivilegeLabel(
  member: Pick<Member, 'membershipType' | 'positions'>,
): string {
  if (isOrganistMembership(member.membershipType)) {
    return MEMBERSHIP_LABELS[member.membershipType]
  }
  const stored = (member.positions ?? []).find(
    (p) => p === 'organista' || p === 'assistant-tagapagturo',
  )
  return stored ? (POSITION_LABELS[stored] ?? stored) : ''
}

/**
 * The sub-line under a member's name in the pickers: voice position (when one
 * is assigned) and the privilege label, e.g. "Soprano 1 · Organista".
 */
export function memberSubtitle(
  member: Pick<Member, 'membershipType' | 'positions' | 'voicePosition'>,
  voices: VoicePosition[] = [],
): string {
  const parts: string[] = []
  if (member.voicePosition) {
    const voice = getVoiceName(member.voicePosition, voices)
    if (voice && voice !== UNASSIGNED_VOICE_LABEL) parts.push(voice)
  }
  const privilege = organistPrivilegeLabel(member)
  if (privilege) parts.push(privilege)
  return parts.join(' · ')
}