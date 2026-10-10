import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account } from '@/core/types/auth'
import { useAdminStore } from './adminStore.ts'
import { useAuthStore } from './authStore.ts'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc_1',
    username: 'admin',
    fullName: 'Admin User',
    role: 'admin',
    status: 'active',
    createdAt: '2026-10-08T00:00:00.000Z',
    ...overrides,
  }
}

const newAccountInput = {
  firstName: 'Maria',
  lastName: 'Santos',
  email: 'maria@example.org',
  username: 'maria.santos',
  password: 'maria2026',
  role: 'staff',
  customPermissions: null,
}

test('currentAccount returns the active signed-in account and nothing otherwise', () => {
  useAuthStore.getState().clear()
  assert.equal(useAuthStore.getState().currentAccount(), null)

  const admin = account()
  useAuthStore.setState({ accounts: [admin], currentAccountId: admin.id })
  assert.equal(useAuthStore.getState().currentAccount()?.id, admin.id)

  // A non-active status reads as signed out even if the id is still set.
  useAuthStore.setState({
    accounts: [account({ status: 'disabled' })],
    currentAccountId: 'acc_1',
  })
  assert.equal(useAuthStore.getState().currentAccount(), null)

  useAuthStore.getState().clear()
  assert.deepEqual(useAuthStore.getState().accounts, [])
  assert.equal(useAuthStore.getState().currentAccountId, null)
})

test('admin account and role mutations are deferred to the server write path', async () => {
  useAuthStore.getState().clear()
  const admin = account()
  useAuthStore.setState({ accounts: [admin], currentAccountId: admin.id })
  const state = useAuthStore.getState()

  assert.ok('problems' in (await state.createManagedAccount(admin.id, newAccountInput)))
  assert.ok(
    'problems' in state.updateManagedAccount(admin.id, admin.id, { status: 'disabled' }),
  )
  assert.ok('problems' in (await state.resetManagedPassword(admin.id, admin.id, 'abcd1234')))
  assert.ok(
    'problems' in
      state.createManagedRole(admin.id, {
        label: 'Staff',
        description: '',
        permissions: [],
      }),
  )
  assert.ok(
    'problems' in
      state.updateManagedRole(admin.id, 'custom-1', { label: 'Staff', description: '' }),
  )
  assert.ok('problems' in state.deleteManagedRole(admin.id, 'custom-1'))
  assert.ok('problems' in state.updateManagedRolePermissions(admin.id, 'staff', []))
  assert.ok('problems' in state.terminateManagedSession(admin.id, 'session-1'))
})

test('changing a password requires being signed in as that account', async () => {
  useAuthStore.getState().clear()
  const result = await useAuthStore.getState().changeOwnPassword('missing', 'validpass1')
  assert.ok('problems' in result)
  // No audit entry is written on a rejected change.
  assert.equal(useAdminStore.getState().auditLogs.length, 0)
})
