import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account } from '@/core/types/auth'
import { useAuthStore } from './authStore.ts'
import { useMemberStore } from './memberStore.ts'

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
