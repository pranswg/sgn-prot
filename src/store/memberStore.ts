import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { Member, MemberInput, Trainee, TraineeInput } from '@/core/types/member'
import { seedMembers, seedTrainees } from '@/lib/seedData'

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
  resetDemoData: () => void
  importData: (members: Member[], trainees: Trainee[]) => void
  clear: () => void
}

export const useMemberStore = create<MemberState>()(
  persist(
    (set, get) => ({
      members: seedMembers(),
      trainees: seedTrainees(),

      addMember: (input) => {
        const member: Member = { ...input, id: nanoid() }
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

      resetDemoData: () => {
        set({ members: seedMembers(), trainees: seedTrainees() })
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
      version: 2,
    },
  ),
)