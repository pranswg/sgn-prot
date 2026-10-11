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
import { deleteRow, upsertRow } from '@/api/db'
import { persist as persistWrite } from '@/lib/writeThrough'
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

/**
 * Phase 4b write-through. Members and trainees are one server row each, so a
 * per-action helper upserts (or deletes) that row and restores the previous
 * slice if Supabase rejects the write. Backup `importData` and reset `clear`
 * stay local for now; the bulk bridge is Phase 7.
 */
type MemberStateSetter = (
  partial: Partial<Pick<MemberState, 'members' | 'trainees' | 'lastUpdatedAt'>>,
) => void

function writeMember(
  set: MemberStateSetter,
  previous: Member[],
  member: Member,
  failure: string,
) {
  persistWrite({
    write: upsertRow('members', member.id, member),
    rollback: () => set({ members: previous, lastUpdatedAt: updatedAt() }),
    failure,
  })
}

function deleteMemberRow(
  set: MemberStateSetter,
  previous: Member[],
  id: string,
  failure: string,
) {
  persistWrite({
    write: deleteRow('members', id),
    rollback: () => set({ members: previous, lastUpdatedAt: updatedAt() }),
    failure,
  })
}

function writeTrainee(
  set: MemberStateSetter,
  previous: Trainee[],
  trainee: Trainee,
  failure: string,
) {
  persistWrite({
    write: upsertRow('trainees', trainee.id, trainee),
    rollback: () => set({ trainees: previous, lastUpdatedAt: updatedAt() }),
    failure,
  })
}

function deleteTraineeRow(
  set: MemberStateSetter,
  previous: Trainee[],
  id: string,
  failure: string,
) {
  persistWrite({
    write: deleteRow('trainees', id),
    rollback: () => set({ trainees: previous, lastUpdatedAt: updatedAt() }),
    failure,
  })
}

export const useMemberStore = create<MemberState>()(
  persist(
    (set, get) => ({
      members: [],
      trainees: [],
      lastUpdatedAt: updatedAt(),

      addMember: (input) => {
        const previous = get().members
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
        writeMember(set, previous, member, 'Could not save the new member. It was not added.')
        return member
      },

      updateMember: (id, input) => {
        const previous = get().members
        const existing = previous.find((member) => member.id === id)
        if (!existing) return
        const next = { ...existing, ...input }
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? next : m)),
          lastUpdatedAt: updatedAt(),
        }))
        writeMember(set, previous, next, 'Could not save the member. Your change was reverted.')
      },

      deactivateMember: (id) => {
        const previous = get().members
        const existing = previous.find(
          (member) => member.id === id && member.isActive,
        )
        if (!existing) return
        const next = { ...existing, isActive: false }
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? next : m)),
          lastUpdatedAt: updatedAt(),
        }))
        writeMember(set, previous, next, 'Could not deactivate the member. Your change was reverted.')
      },

      reactivateMember: (id) => {
        const previous = get().members
        const existing = previous.find(
          (member) => member.id === id && !member.isActive,
        )
        if (!existing) return
        const next = { ...existing, isActive: true }
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? next : m)),
          lastUpdatedAt: updatedAt(),
        }))
        writeMember(set, previous, next, 'Could not reactivate the member. Your change was reverted.')
      },

      removeMember: (id) => {
        const previous = get().members
        if (!previous.some((member) => member.id === id)) return
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          lastUpdatedAt: updatedAt(),
        }))
        deleteMemberRow(set, previous, id, 'Could not delete the member. It was restored.')
      },

      transferMember: (actorId, id, input) => {
        const actor = activeActor(actorId)
        if (!actor) return { error: MANAGER_ERROR }
        const previous = get().members
        const member = previous.find((m) => m.id === id)
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
        const next = {
          ...member,
          isActive: false,
          history: [...(member.history ?? []), event],
        }
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? next : m)),
          lastUpdatedAt: updatedAt(),
        }))
        writeMember(set, previous, next, 'Could not record the transfer. Your change was reverted.')
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
        const previous = get().members
        const member = previous.find((m) => m.id === id)
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
        const next = {
          ...member,
          isActive: true,
          history: [...(member.history ?? []), event],
        }
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? next : m)),
          lastUpdatedAt: updatedAt(),
        }))
        writeMember(set, previous, next, 'Could not restore the member. Your change was reverted.')
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
        const previous = get().members
        const member = previous.find((m) => m.id === memberId)
        if (!member) return { error: 'Member not found.' }
        const history = member.history ?? []
        const event = history.find((e) => e.id === eventId)
        if (!event) return { error: 'History event not found.' }
        if (!isDateKey(patch.date)) {
          return { error: 'Choose a valid date.' }
        }
        const nextEvent: MemberHistoryEvent = {
          ...event,
          date: patch.date,
          reason: patch.reason,
          notes:
            patch.notes === undefined
              ? event.notes
              : patch.notes.trim() || undefined,
        }
        const next = {
          ...member,
          history: history.map((e) => (e.id === eventId ? nextEvent : e)),
        }
        set((s) => ({
          members: s.members.map((m) => (m.id === memberId ? next : m)),
          lastUpdatedAt: updatedAt(),
        }))
        writeMember(set, previous, next, 'Could not update the history. Your change was reverted.')
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
        const previous = get().members
        const member = previous.find((m) => m.id === memberId)
        if (!member) return { error: 'Member not found.' }
        const history = member.history ?? []
        if (!history.some((e) => e.id === eventId)) {
          return { error: 'History event not found.' }
        }
        const next = {
          ...member,
          history: history.filter((e) => e.id !== eventId),
        }
        set((s) => ({
          members: s.members.map((m) => (m.id === memberId ? next : m)),
          lastUpdatedAt: updatedAt(),
        }))
        writeMember(set, previous, next, 'Could not update the history. Your change was reverted.')
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
        const previous = get().trainees
        const trainee: Trainee = { ...input, id: nanoid() }
        set((s) => ({
          trainees: [...s.trainees, trainee],
          lastUpdatedAt: updatedAt(),
        }))
        writeTrainee(set, previous, trainee, 'Could not save the new trainee. It was not added.')
        return trainee
      },

      updateTrainee: (id, input) => {
        const previous = get().trainees
        const existing = previous.find((trainee) => trainee.id === id)
        if (!existing) return
        const next = { ...existing, ...input }
        set((s) => ({
          trainees: s.trainees.map((t) => (t.id === id ? next : t)),
          lastUpdatedAt: updatedAt(),
        }))
        writeTrainee(set, previous, next, 'Could not save the trainee. Your change was reverted.')
      },

      promoteTrainee: (id) => {
        const previousMembers = get().members
        const previousTrainees = get().trainees
        const trainee = previousTrainees.find((t) => t.id === id)
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
        const promoted: Trainee = {
          ...trainee,
          status: 'promoted',
          promotedToMemberId: member.id,
        }
        set((s) => ({
          members: [...s.members, member],
          trainees: s.trainees.map((t) => (t.id === id ? promoted : t)),
          lastUpdatedAt: updatedAt(),
        }))
        persistWrite({
          write: [
            upsertRow('members', member.id, member),
            upsertRow('trainees', promoted.id, promoted),
          ],
          rollback: () =>
            set({
              members: previousMembers,
              trainees: previousTrainees,
              lastUpdatedAt: updatedAt(),
            }),
          failure: 'Could not promote the trainee. Your change was reverted.',
        })
        return member
      },

      deactivateTrainee: (id) => {
        const previous = get().trainees
        const existing = previous.find(
          (trainee) => trainee.id === id && trainee.status === 'active',
        )
        if (!existing) return
        const next: Trainee = { ...existing, status: 'inactive' }
        set((s) => ({
          trainees: s.trainees.map((t) => (t.id === id ? next : t)),
          lastUpdatedAt: updatedAt(),
        }))
        writeTrainee(set, previous, next, 'Could not deactivate the trainee. Your change was reverted.')
      },

      removeTrainee: (id) => {
        const previous = get().trainees
        if (!previous.some((trainee) => trainee.id === id)) return
        set((s) => ({
          trainees: s.trainees.filter((t) => t.id !== id),
          lastUpdatedAt: updatedAt(),
        }))
        deleteTraineeRow(set, previous, id, 'Could not delete the trainee. It was restored.')
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

        const previousMembers = get().members
        const previousTrainees = get().trainees
        const newMembers: Member[] = members.map((input) => ({
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
        }))
        const newTrainees: Trainee[] = trainees.map((input) => ({
          ...input,
          id: nanoid(),
        }))

        set((state) => ({
          members: [...state.members, ...newMembers],
          trainees: [...state.trainees, ...newTrainees],
          lastUpdatedAt: updatedAt(),
        }))

        persistWrite({
          write: [
            ...newMembers.map((m) => upsertRow('members', m.id, m)),
            ...newTrainees.map((t) => upsertRow('trainees', t.id, t)),
          ],
          rollback: () =>
            set({
              members: previousMembers,
              trainees: previousTrainees,
              lastUpdatedAt: updatedAt(),
            }),
          failure: 'Could not import the Master List. Your change was reverted.',
        })

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