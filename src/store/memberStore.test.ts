import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account } from '@/core/types/auth'
import { useAuthStore } from './authStore.ts'
import { useMemberStore } from './memberStore.ts'
import { membersOf } from '@/lib/choirs.ts'

const memberInput = {
  firstName: 'Maria',
  lastName: 'Santos',
  gender: 'female' as const,
  voicePosition: 'soprano-1',
  membershipType: 'regular' as const,
  isActive: true,
  dateAdded: '2026-10-08',
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    username: 'admin.import',
    fullName: 'Import Admin',
    role: 'admin',
    status: 'active',
    createdAt: '2026-10-08T00:00:00.000Z',
    ...overrides,
  }
}

test('Master List import requires the current active Admin at the store boundary', () => {
  useAuthStore.getState().clear()
  useMemberStore.getState().clear()

  const admin = account()
  const staff = account({
    id: 'acc_2',
    username: 'staff.import',
    fullName: 'Staff User',
    role: 'custom-import',
  })
  useAuthStore.setState({ accounts: [admin, staff], currentAccountId: staff.id })

  const denied = useMemberStore
    .getState()
    .importMasterList(staff.id, [memberInput], [])
  assert.equal('error' in denied, true)
  assert.equal(useMemberStore.getState().members.length, 0)

  useAuthStore.setState({ currentAccountId: admin.id })
  useMemberStore.setState({ lastUpdatedAt: '2000-01-01T00:00:00.000Z' })
  const imported = useMemberStore
    .getState()
    .importMasterList(admin.id, [memberInput], [])
  assert.deepEqual(imported, { importedMembers: 1, importedTrainees: 0 })
  assert.equal(useMemberStore.getState().members[0]?.firstName, 'Maria')
  assert.notEqual(
    useMemberStore.getState().lastUpdatedAt,
    '2000-01-01T00:00:00.000Z',
  )

  useAuthStore.getState().clear()
  useMemberStore.getState().clear()
})

test('Master List restoreData replaces the list and clear empties it', () => {
  useMemberStore.getState().clear()

  useMemberStore.getState().restoreData(
    [{ id: 'm_restored', ...memberInput, positions: [], history: [] }] as never,
    [{ id: 't_restored', firstName: 'Ana', lastName: 'Reyes' }] as never,
  )
  const restored = useMemberStore.getState()
  assert.equal(restored.members.length, 1)
  assert.equal(restored.members[0]?.id, 'm_restored')
  assert.equal(restored.trainees.length, 1)
  assert.equal(restored.trainees[0]?.id, 't_restored')

  useMemberStore.getState().clear()
  const cleared = useMemberStore.getState()
  assert.equal(cleared.members.length, 0)
  assert.equal(cleared.trainees.length, 0)
})

test('Master List mutations refresh the last-updated timestamp', () => {
  useMemberStore.getState().clear()
  useMemberStore.setState({ lastUpdatedAt: '2000-01-01T00:00:00.000Z' })
  const member = useMemberStore.getState().addMember(memberInput)
  assert.notEqual(
    useMemberStore.getState().lastUpdatedAt,
    '2000-01-01T00:00:00.000Z',
  )

  useMemberStore.setState({ lastUpdatedAt: '2000-01-01T00:00:00.000Z' })
  useMemberStore.getState().updateMember(member.id, { voicePosition: 'alto' })
  assert.notEqual(
    useMemberStore.getState().lastUpdatedAt,
    '2000-01-01T00:00:00.000Z',
  )

  useMemberStore.setState({ lastUpdatedAt: '2000-01-01T00:00:00.000Z' })
  useMemberStore.getState().deactivateMember(member.id)
  assert.notEqual(
    useMemberStore.getState().lastUpdatedAt,
    '2000-01-01T00:00:00.000Z',
  )
  useMemberStore.getState().clear()
})

test('the two choirs are separate lists: a PNK member never joins AWS', () => {
  useMemberStore.getState().clear()

  const aws = useMemberStore.getState().addMember(memberInput)
  const pnk = useMemberStore.getState().addMember({
    ...memberInput,
    firstName: 'Bituin',
    choir: 'pnk',
  })

  // A member added without a choir is AWS, so the existing screens keep working.
  assert.equal(aws.choir, 'aws')
  assert.equal(pnk.choir, 'pnk')
  assert.deepEqual(
    membersOf(useMemberStore.getState().members, 'aws').map((m) => m.id),
    [aws.id],
  )
  assert.deepEqual(
    membersOf(useMemberStore.getState().members, 'pnk').map((m) => m.id),
    [pnk.id],
  )

  useMemberStore.getState().clear()
})

test('promoting a PNK trainee keeps them in the PNK list', () => {
  useMemberStore.getState().clear()

  const trainee = useMemberStore.getState().addTrainee({
    firstName: 'Liwayway',
    lastName: 'Cruz',
    gender: 'female',
    voicePosition: 'alto',
    status: 'active',
    dateAdded: '2026-10-01',
    choir: 'pnk',
  })
  const promoted = useMemberStore.getState().promoteTrainee(trainee.id)

  assert.equal(promoted?.choir, 'pnk')
  assert.equal(
    membersOf(useMemberStore.getState().members, 'aws').length,
    0,
    'promotion must not add anyone to the AWS roster',
  )
  assert.equal(membersOf(useMemberStore.getState().members, 'pnk').length, 1)

  useMemberStore.getState().clear()
})

test('restoring a backup stamps legacy rows as AWS', () => {
  useMemberStore.getState().clear()

  useMemberStore
    .getState()
    .restoreData(
      [{ id: 'm_legacy', ...memberInput, positions: [], history: [] }] as never,
      [{ id: 't_legacy', firstName: 'Ana', lastName: 'Reyes' }] as never,
    )

  const restored = useMemberStore.getState()
  assert.equal(restored.members[0]?.choir, 'aws')
  assert.equal(restored.trainees[0]?.choir, 'aws')

  useMemberStore.getState().clear()
})
