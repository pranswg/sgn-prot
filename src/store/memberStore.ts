import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type {
  Member,
  MemberHistoryEvent,
  MemberInput,
  MembershipType,
  Trainee,
  TraineeInput,
  TransferReason,
} from '@/core/types/member'
import { useAuthStore } from '@/store/authStore'
import { useAdminStore } from '@/store/adminStore'
import { isDateKey, toDateKeyFromInstant } from '@/lib/phDate'
import { transferReasonLabel } from '@/lib/memberHistory'

function updatedAt(): string {
  return new Date().toISOString()
}

/** (as of v4) Membership types are the four categories; anything else is legacy. */
function migrateMembership(value: unknown): MembershipType {
  return value === 'organista' ||
    value === 'tagapagturo' ||
    value === 'assistant-tagapagturo'
    ? value
    : 'regular'
}

/**
 * A `joined` event for a brand-new profile. `dateAdded` is normally a PHT
 * instant (`...+08:00`), so the calendar date is extracted in PHT rather than
 * relying on the string being a plain `YYYY-MM-DD`.
 */
function joinedEventFor(
  dateAdded: string,
  voicePosition: string,
  actorName?: string,
): MemberHistoryEvent {
  const date = isDateKey(dateAdded)
    ? dateAdded
    : toDateKeyFromInstant(new Date(dateAdded))
  return {
    id: nanoid(),
    type: 'joined',
    date,
    voicePosition,
    actorName,
    createdAt: updatedAt(),
  }
}

/** Validates and normalises a persisted `history` array without re-seeding. */
function normalizePersistedHistory(
  value: unknown,
): MemberHistoryEvent[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(
    (entry): entry is MemberHistoryEvent =>
      !!entry &&
      typeof entry === 'object' &&
      (entry as MemberHistoryEvent).type !== undefined &&
      isDateKey((entry as MemberHistoryEvent).date),
  ).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : nanoid(),
    type: entry.type,
    date: entry.date,
    voicePosition: entry.voicePosition,
    reason: entry.reason,
    notes: entry.notes,
    actorName: entry.actorName,
    createdAt:
      typeof entry.createdAt === 'string' ? entry.createdAt : updatedAt(),
  }))
}

/**
 * (as of v6) Every member profile carries its membership history, oldest
 * first. New profiles start with a `joined` event; migration back-fills that
 * event only when the profile has no history at all.
 */
function normalizeMemberHistory(member: Member): MemberHistoryEvent[] {
  const persisted = normalizePersistedHistory(member.history)
  if (persisted) return persisted
  if (isDateKey(member.dateAdded)) {
    return [joinedEventFor(member.dateAdded, member.voicePosition)]
  }
  return []
}

/** The signed-in account, when the actor is currently active. */
function activeActor(actorId: string) {
  const auth = useAuthStore.getState()
  const actor = auth.accounts.find((account) => account.id === actorId)
  if (
    actorId !== auth.currentAccountId ||
    actor?.role !== 'admin' ||
    (actor.status ?? 'active') !== 'active'
  ) {
    return null
  }
  return actor
}

const MANAGER_ERROR = 'Only an active Admin can manage membership history.'

interface MemberActionError {
  error: string
}

interface MemberState {
  members: Member[]
  trainees: Trainee[]
  lastUpdatedAt: string
  addMember: (input: MemberInput) => Member
  updateMember: (id: string, input: Partial<MemberInput>) => void
  deactivateMember: (id: string) => void
  reactivateMember: (id: string) => void
  removeMember: (id: string) => void
  transferMember: (
    actorId: string,
    id: string,
    input: { date: string; reason: TransferReason; notes?: string },
  ) => { member?: Member; error?: string }
  restoreMember: (
    actorId: string,
    id: string,
    input: { date: string; notes?: string },
  ) => { member?: Member; error?: string }
  updateHistoryEvent: (
    actorId: string,
    memberId: string,
    eventId: string,
    patch: { date: string; reason?: TransferReason; notes?: string },
  ) => MemberActionError | null
  removeHistoryEvent: (
    actorId: string,
    memberId: string,
    eventId: string,
  ) => MemberActionError | null
  addTrainee: (input: TraineeInput) => Trainee
  updateTrainee: (id: string, input: Partial<TraineeInput>) => void
  promoteTrainee: (id: string) => Member | null
  deactivateTrainee: (id: string) => void
  removeTrainee: (id: string) => void
  importData: (members: Member[], trainees: Trainee[]) => void
  importMasterList: (
    actorId: string,
    members: MemberInput[],
    trainees: TraineeInput[],
  ) =>
    | { importedMembers: number; importedTrainees: number }
    | { error: string }
  clear: () => void
}

export const useMemberStore = create<MemberState>()(
  persist(
    (set, get) => ({
      members: [],
      trainees: [],
      lastUpdatedAt: updatedAt(),

      addMember: (input) => {
        const member: Member = {
          ...input,
          positions: input.positions ?? [],
          history: [joinedEventFor(input.dateAdded, input.voicePosition)],
          id: nanoid(),
        }
        set((s) => ({
          members: [...s.members, member],
          lastUpdatedAt: updatedAt(),
        }))
        return member
      },

      updateMember: (id, input) => {
        if (!get().members.some((member) => member.id === id)) return
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, ...input } : m)),
          lastUpdatedAt: updatedAt(),
        }))
      },

      deactivateMember: (id) => {
        if (
          !get().members.some((member) => member.id === id && member.isActive)
        ) {
          return
        }
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, isActive: false } : m)),
          lastUpdatedAt: updatedAt(),
        }))
      },

      reactivateMember: (id) => {
        if (
          !get().members.some((member) => member.id === id && !member.isActive)
        ) {
          return
        }
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, isActive: true } : m)),
          lastUpdatedAt: updatedAt(),
        }))
      },

      removeMember: (id) => {
        if (!get().members.some((member) => member.id === id)) return
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          lastUpdatedAt: updatedAt(),
        }))
      },

      transferMember: (actorId, id, input) => {
        const actor = activeActor(actorId)
        if (!actor) return { error: MANAGER_ERROR }
        const member = get().members.find((m) => m.id === id)
        if (!member) return { error: 'Member not found.' }
        if (!member.isActive) {
          return { error: 'This member is already transferred out.' }
        }
        if (!isDateKey(input.date)) {
          return { error: 'Choose a valid transfer date.' }
        }
        const event: MemberHistoryEvent = {
          id: nanoid(),
          type: 'transferred-out',
          date: input.date,
          reason: input.reason,
          notes: input.notes?.trim() || undefined,
          voicePosition: member.voicePosition,
          actorName: actor.fullName,
          createdAt: updatedAt(),
        }
        set((s) => ({
          members: s.members.map((m) =>
            m.id === id
              ? {
                  ...m,
                  isActive: false,
                  history: [...(m.history ?? []), event],
                }
              : m,
          ),
          lastUpdatedAt: updatedAt(),
        }))
        useAdminStore.getState().addAuditLog({
          actorId,
          actorName: actor.fullName,
          actorUsername: actor.username,
          action: 'Member transferred out',
          module: 'Choir Management',
          affectedUserId: member.id,
          affectedUserName: `${member.firstName} ${member.lastName}`.trim(),
          details: `Reason: ${transferReasonLabel(input.reason)}. Date: ${input.date}.`,
        })
        return { member: { ...member, isActive: false } }
      },

      restoreMember: (actorId, id, input) => {
        const actor = activeActor(actorId)
        if (!actor) return { error: MANAGER_ERROR }
        const member = get().members.find((m) => m.id === id)
        if (!member) return { error: 'Member not found.' }
        if (member.isActive) {
          return { error: 'This member is already on the Master List.' }
        }
        if (!isDateKey(input.date)) {
          return { error: 'Choose a valid return date.' }
        }
        const event: MemberHistoryEvent = {
          id: nanoid(),
          type: 'returned',
          date: input.date,
          voicePosition: member.voicePosition,
          notes: input.notes?.trim() || undefined,
          actorName: actor.fullName,
          createdAt: updatedAt(),
        }
        set((s) => ({
          members: s.members.map((m) =>
            m.id === id
              ? {
                  ...m,
                  isActive: true,
                  history: [...(m.history ?? []), event],
                }
              : m,
          ),
          lastUpdatedAt: updatedAt(),
        }))
        useAdminStore.getState().addAuditLog({
          actorId,
          actorName: actor.fullName,
          actorUsername: actor.username,
          action: 'Member restored',
          module: 'Choir Management',
          affectedUserId: member.id,
          affectedUserName: `${member.firstName} ${member.lastName}`.trim(),
          details: `Restored from transfer. Date: ${input.date}.`,
        })
        return { member: { ...member, isActive: true } }
      },

      updateHistoryEvent: (actorId, memberId, eventId, patch) => {
        const actor = activeActor(actorId)
        if (!actor) return { error: MANAGER_ERROR }
        const member = get().members.find((m) => m.id === memberId)
        if (!member) return { error: 'Member not found.' }
        const history = member.history ?? []
        const event = history.find((e) => e.id === eventId)
        if (!event) return { error: 'History event not found.' }
        if (!isDateKey(patch.date)) {
          return { error: 'Choose a valid date.' }
        }
        const next: MemberHistoryEvent = {
          ...event,
          date: patch.date,
          reason: patch.reason,
          notes:
            patch.notes === undefined
              ? event.notes
              : patch.notes.trim() || undefined,
        }
        set((s) => ({
          members: s.members.map((m) =>
            m.id === memberId
              ? {
                  ...m,
                  history: history.map((e) => (e.id === eventId ? next : e)),
                }
              : m,
          ),
          lastUpdatedAt: updatedAt(),
        }))
        useAdminStore.getState().addAuditLog({
          actorId,
          actorName: actor.fullName,
          actorUsername: actor.username,
          action: 'Membership history updated',
          module: 'Choir Management',
          affectedUserId: member.id,
          affectedUserName: `${member.firstName} ${member.lastName}`.trim(),
          details: `Edited a ${event.type} event.`,
        })
        return null
      },

      removeHistoryEvent: (actorId, memberId, eventId) => {
        const actor = activeActor(actorId)
        if (!actor) return { error: MANAGER_ERROR }
        const member = get().members.find((m) => m.id === memberId)
        if (!member) return { error: 'Member not found.' }
        const history = member.history ?? []
        if (!history.some((e) => e.id === eventId)) {
          return { error: 'History event not found.' }
        }
        set((s) => ({
          members: s.members.map((m) =>
            m.id === memberId
              ? { ...m, history: history.filter((e) => e.id !== eventId) }
              : m,
          ),
          lastUpdatedAt: updatedAt(),
        }))
        useAdminStore.getState().addAuditLog({
          actorId,
          actorName: actor.fullName,
          actorUsername: actor.username,
          action: 'Membership history updated',
          module: 'Choir Management',
          affectedUserId: member.id,
          affectedUserName: `${member.firstName} ${member.lastName}`.trim(),
          details: 'Removed a history event.',
        })
        return null
      },

      addTrainee: (input) => {
        const trainee: Trainee = { ...input, id: nanoid() }
        set((s) => ({
          trainees: [...s.trainees, trainee],
          lastUpdatedAt: updatedAt(),
        }))
        return trainee
      },

      updateTrainee: (id, input) => {
        if (!get().trainees.some((trainee) => trainee.id === id)) return
        set((s) => ({
          trainees: s.trainees.map((t) => (t.id === id ? { ...t, ...input } : t)),
          lastUpdatedAt: updatedAt(),
        }))
      },

      promoteTrainee: (id) => {
        const trainee = get().trainees.find((t) => t.id === id)
        if (!trainee) return null
        const member: Member = {
          id: nanoid(),
          firstName: trainee.firstName,
          middleName: trainee.middleName,
          suffix: trainee.suffix,
          lastName: trainee.lastName,
          gender: trainee.gender,
          voicePosition: trainee.voicePosition,
          membershipType: 'regular',
          isActive: true,
          dateAdded: trainee.dateAdded,
          positions: [],
          notes: trainee.notes,
          history: [joinedEventFor(trainee.dateAdded, trainee.voicePosition)],
        }
        set((s) => ({
          members: [...s.members, member],
          trainees: s.trainees.map((t) =>
            t.id === id ? { ...t, status: 'promoted', promotedToMemberId: member.id } : t,
          ),
          lastUpdatedAt: updatedAt(),
        }))
        return member
      },

      deactivateTrainee: (id) => {
        if (
          !get().trainees.some(
            (trainee) => trainee.id === id && trainee.status === 'active',
          )
        ) {
          return
        }
        set((s) => ({
          trainees: s.trainees.map((t) =>
            t.id === id ? { ...t, status: 'inactive' } : t,
          ),
          lastUpdatedAt: updatedAt(),
        }))
      },

      removeTrainee: (id) => {
        if (!get().trainees.some((trainee) => trainee.id === id)) return
        set((s) => ({
          trainees: s.trainees.filter((t) => t.id !== id),
          lastUpdatedAt: updatedAt(),
        }))
      },

      importData: (members, trainees) => {
        set({
          members: members.map((m) => ({
            ...m,
            history: normalizeMemberHistory(m as Member),
          })),
          trainees,
          lastUpdatedAt: updatedAt(),
        })
      },

      importMasterList: (actorId, members, trainees) => {
        const auth = useAuthStore.getState()
        const actor = auth.accounts.find((account) => account.id === actorId)
        if (
          actorId !== auth.currentAccountId ||
          actor?.role !== 'admin' ||
          (actor.status ?? 'active') !== 'active'
        ) {
          return { error: 'Only an active Admin can import the Master List.' }
        }
        if (members.length === 0 && trainees.length === 0) {
          return { error: 'Select at least one member or trainee to import.' }
        }

        set((state) => ({
          members: [
            ...state.members,
            ...members.map((input) => ({
              ...input,
              positions: input.positions ?? [],
              history: [
                joinedEventFor(
                  input.dateAdded,
                  input.voicePosition,
                  actor.fullName,
                ),
              ],
              id: nanoid(),
            })),
          ],
          trainees: [
            ...state.trainees,
            ...trainees.map((input) => ({ ...input, id: nanoid() })),
          ],
          lastUpdatedAt: updatedAt(),
        }))
        return {
          importedMembers: members.length,
          importedTrainees: trainees.length,
        }
      },

      clear: () => {
        set({ members: [], trainees: [], lastUpdatedAt: updatedAt() })
      },
    }),
    {
      name: 'choir-members',
      version: 6,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          members?: Member[]
          trainees?: Trainee[]
          lastUpdatedAt?: string
        }
        return {
          ...state,
          lastUpdatedAt: state.lastUpdatedAt ?? updatedAt(),
          members: (state.members ?? []).map((m) => ({
            ...m,
            // Version 4 removed the 'provisional' membership in favour of the
            // four membership categories; former trainee-members fold into
            // Mang-aawit.
            membershipType: migrateMembership(m.membershipType),
            positions: m.positions ?? [],
            // Version 6 back-fills membership history for older profiles.
            history: normalizeMemberHistory(m),
          })),
          trainees: state.trainees ?? [],
        }
      },
    },
  ),
)