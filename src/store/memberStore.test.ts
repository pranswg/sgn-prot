import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account } from '@/core/types/auth.ts'
import { useAuthStore } from './authStore.ts'
import { useMemberStore } from './memberStore.ts'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'admin-1',
    username: 'admin.import',
    fullName: 'Import Admin',
    role: 'admin',
    status: 'active',
    createdAt: '2026-10-08T00:00:00.000Z',
    ...overrides,
  }
}

const memberInput = {
  firstName: 'Maria',
  lastName: 'Santos',
  gender: 'female' as const,
  voicePosition: 'soprano-1',
  membershipType: 'regular' as const,
  isActive: true,
  dateAdded: '2026-10-08',
}

test('Master List import requires the current active Admin at the store boundary', () => {
  useAuthStore.getState().clear()
  useMemberStore.getState().clear()

  const admin = account()
  useAuthStore.setState({ accounts: [admin], currentAccountId: null })
  const signedOut = useMemberStore
    .getState()
    .importMasterList(admin.id, [memberInput], [])
  assert.equal('error' in signedOut, true)
  assert.equal(useMemberStore.getState().members.length, 0)

  const staff = account({ id: 'staff-1', username: 'staff.import', role: 'staff' })
  useAuthStore.setState({ accounts: [admin, staff], currentAccountId: staff.id })
  const denied = useMemberStore
    .getState()
    .importMasterList(staff.id, [memberInput], [])
  assert.equal('error' in denied, true)
  assert.equal(useMemberStore.getState().members.length, 0)

  useAuthStore.setState({ currentAccountId: admin.id })
  const imported = useMemberStore
    .getState()
    .importMasterList(admin.id, [memberInput], [])
  assert.deepEqual(imported, { importedMembers: 1, importedTrainees: 0 })
  assert.equal(useMemberStore.getState().members[0]?.firstName, 'Maria')

  useAuthStore.getState().clear()
  useMemberStore.getState().clear()
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
