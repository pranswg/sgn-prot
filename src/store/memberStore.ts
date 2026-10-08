import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Member, MemberInput, MembershipType, Trainee, TraineeInput } from '@/core/types/member'
import { useAuthStore } from '@/store/authStore'

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

interface MemberState {
  members: Member[]
  trainees: Trainee[]
  lastUpdatedAt: string
  addMember: (input: MemberInput) => Member
  updateMember: (id: string, input: Partial<MemberInput>) => void
  deactivateMember: (id: string) => void
  reactivateMember: (id: string) => void
  removeMember: (id: string) => void
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
        set({ members, trainees, lastUpdatedAt: updatedAt() })
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
      version: 5,
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
          })),
          trainees: state.trainees ?? [],
        }
      },
    },
  ),
)