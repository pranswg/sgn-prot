import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Member, MemberInput, MembershipType, Trainee, TraineeInput } from '@/core/types/member'

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
  clear: () => void
}

export const useMemberStore = create<MemberState>()(
  persist(
    (set, get) => ({
      members: [],
      trainees: [],

      addMember: (input) => {
        const member: Member = {
          ...input,
          positions: input.positions ?? [],
          id: nanoid(),
        }
        set((s) => ({ members: [...s.members, member] }))
        return member
      },

      updateMember: (id, input) => {
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, ...input } : m)),
        }))
      },

      deactivateMember: (id) => {
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, isActive: false } : m)),
        }))
      },

      reactivateMember: (id) => {
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, isActive: true } : m)),
        }))
      },

      removeMember: (id) => {
        set((s) => ({ members: s.members.filter((m) => m.id !== id) }))
      },

      addTrainee: (input) => {
        const trainee: Trainee = { ...input, id: nanoid() }
        set((s) => ({ trainees: [...s.trainees, trainee] }))
        return trainee
      },

      updateTrainee: (id, input) => {
        set((s) => ({
          trainees: s.trainees.map((t) => (t.id === id ? { ...t, ...input } : t)),
        }))
      },

      promoteTrainee: (id) => {
        const trainee = get().trainees.find((t) => t.id === id)
        if (!trainee) return null
        const member: Member = {
          id: nanoid(),
          firstName: trainee.firstName,
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
        }))
        return member
      },

      deactivateTrainee: (id) => {
        set((s) => ({
          trainees: s.trainees.map((t) =>
            t.id === id ? { ...t, status: 'inactive' } : t,
          ),
        }))
      },

      removeTrainee: (id) => {
        set((s) => ({ trainees: s.trainees.filter((t) => t.id !== id) }))
      },

      importData: (members, trainees) => {
        set({ members, trainees })
      },

      clear: () => {
        set({ members: [], trainees: [] })
      },
    }),
    {
      name: 'choir-members',
      version: 4,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as {
          members?: Member[]
          trainees?: Trainee[]
        }
        return {
          ...state,
          members: (state.members ?? []).map((m) => ({
            ...m,
            // Version 4 removed the 'provisional' membership in favour of the
            // four membership categories; former trainee-members fold into
            // Regular Mang-aawit.
            membershipType: migrateMembership(m.membershipType),
            positions: m.positions ?? [],
          })),
          trainees: state.trainees ?? [],
        }
      },
    },
  ),
)