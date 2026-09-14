import type { Member } from '@/core/types/member'
import type { Suguan } from '@/core/types/suguan'
import { getVoicePosition, getVoiceName } from '@/core/constants/voicePositions'
import { useSettingsStore } from '@/store/settingsStore'

function currentVoices() {
  return useSettingsStore.getState().allVoices()
}

export type ConflictSeverity = 'error' | 'warning'

export interface Conflict {
  type: string
  severity: ConflictSeverity
  message: string
  memberId?: string
  voicePosition?: string
}

export interface ConflictDetectionInput {
  suguan: Suguan
  members: Member[]
  allSuguan: Suguan[]
}

export function detectConflicts(input: ConflictDetectionInput): Conflict[] {
  const { suguan, members, allSuguan } = input
  const conflicts: Conflict[] = []
  const memberById = new Map(members.map((m) => [m.id, m]))

  for (const assignment of suguan.assignments) {
    const member = memberById.get(assignment.memberId)
    const voice = getVoicePosition(assignment.voicePosition, currentVoices())

    if (!member) {
      conflicts.push({
        type: 'missing-member',
        severity: 'error',
        message: `Member "${assignment.memberName}" no longer exists in the Master List.`,
        memberId: assignment.memberId,
        voicePosition: assignment.voicePosition,
      })
      continue
    }

    if (!member.isActive) {
      conflicts.push({
        type: 'inactive-member',
        severity: 'error',
        message: `${member.firstName} ${member.lastName} is inactive and should not be assigned.`,
        memberId: member.id,
        voicePosition: assignment.voicePosition,
      })
    }

    if (voice.gender !== member.gender) {
      conflicts.push({
        type: 'gender-mismatch',
        severity: 'error',
        message: `${member.firstName} ${member.lastName} (${member.gender}) cannot be assigned to ${getVoiceName(assignment.voicePosition, currentVoices())}.`,
        memberId: member.id,
        voicePosition: assignment.voicePosition,
      })
    }

    if (member.voicePosition !== assignment.voicePosition) {
      conflicts.push({
        type: 'voice-mismatch',
        severity: 'error',
        message: `${member.firstName} ${member.lastName}'s voice position is ${getVoiceName(member.voicePosition, currentVoices())}, not ${getVoiceName(assignment.voicePosition, currentVoices())}.`,
        memberId: member.id,
        voicePosition: assignment.voicePosition,
      })
    }
  }

  const seen = new Map<string, number>()
  for (const assignment of suguan.assignments) {
    const count = seen.get(assignment.memberId) ?? 0
    seen.set(assignment.memberId, count + 1)
  }
  for (const [memberId, count] of seen) {
    if (count > 1) {
      const member = memberById.get(memberId)
      const name = member ? `${member.firstName} ${member.lastName}` : memberId
      conflicts.push({
        type: 'duplicate-assignment',
        severity: 'error',
        message: `${name} is assigned more than once in this Suguan.`,
        memberId,
      })
    }
  }

  const dutyMemberIds = suguan.dutyRoles.map((d) => d.memberId)
  const dutySeen = new Map<string, number>()
  for (const memberId of dutyMemberIds) {
    dutySeen.set(memberId, (dutySeen.get(memberId) ?? 0) + 1)
  }
  for (const [memberId, count] of dutySeen) {
    if (count > 1) {
      const member = memberById.get(memberId)
      const name = member ? `${member.firstName} ${member.lastName}` : memberId
      conflicts.push({
        type: 'duplicate-duty',
        severity: 'error',
        message: `${name} holds more than one special duty role in this Suguan.`,
        memberId,
      })
    }
  }

  const sameMillis = new Date(`${suguan.date}T${suguan.time || '00:00'}`).getTime()
  const otherSuguan = allSuguan.filter((s) => s.id !== suguan.id)
  const assignedMembers = new Set(suguan.assignments.map((a) => a.memberId))
  const dutyMembers = new Set(suguan.dutyRoles.map((d) => d.memberId))
  const allCurrentMembers = new Set([...assignedMembers, ...dutyMembers])

  for (const other of otherSuguan) {
    const otherMillis = new Date(`${other.date}T${other.time || '00:00'}`).getTime()
    if (otherMillis !== sameMillis) continue
    for (const a of other.assignments) {
      if (allCurrentMembers.has(a.memberId)) {
        const member = memberById.get(a.memberId)
        const name = member ? `${member.firstName} ${member.lastName}` : a.memberId
        conflicts.push({
          type: 'double-booking',
          severity: 'error',
          message: `${name} is also assigned to another Suguan on the same date/time (${other.serviceTypeId}).`,
          memberId: a.memberId,
        })
      }
    }
  }

  for (const voiceId of Object.keys(suguan.voiceCapacities)) {
    const capacity = suguan.voiceCapacities[voiceId]
    const count = suguan.assignments.filter(
      (a) => a.voicePosition === voiceId,
    ).length
    if (count < capacity && capacity > 0) {
      conflicts.push({
        type: 'under-capacity',
        severity: 'warning',
        message: `${getVoiceName(voiceId, currentVoices())} has ${count}/${capacity} members assigned.`,
        voicePosition: voiceId,
      })
    }
  }

  return conflicts
}

export function hasBlockingConflicts(conflicts: Conflict[]): boolean {
  return conflicts.some((c) => c.severity === 'error')
}