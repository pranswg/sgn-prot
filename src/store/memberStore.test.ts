import assert from 'node:assert/strict'
import test from 'node:test'
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

test('Master List import requires the current active Admin at the store boundary', async () => {
  useAuthStore.getState().clear()
  useMemberStore.getState().clear()
  const adminResult = await useAuthStore.getState().register({
    username: 'admin.import',
    fullName: 'Import Admin',
    password: 'import2026',
    confirmPassword: 'import2026',
  })
  assert.equal('account' in adminResult, true)
  if (!('account' in adminResult)) return
  const roleResult = useAuthStore.getState().createManagedRole(
    adminResult.account.id,
    {
      label: 'Import Test Role',
      description: '',
      permissions: ['view-dashboard'],
    },
  )
  assert.equal('role' in roleResult, true)
  if (!('role' in roleResult)) return

  const userResult = await useAuthStore.getState().createManagedAccount(
    adminResult.account.id,
    {
      firstName: 'Staff',
      lastName: 'User',
      email: '',
      username: 'staff.import',
      password: 'staff2026',
      role: roleResult.role.id,
      customPermissions: null,
    },
  )
  assert.equal('account' in userResult, true)
  if (!('account' in userResult)) return

  useAuthStore.getState().signOut()
  const signInResult = await useAuthStore
    .getState()
    .signIn('staff.import', 'staff2026')
  assert.equal('account' in signInResult, true)
  if (!('account' in signInResult)) return

  const denied = useMemberStore
    .getState()
    .importMasterList(signInResult.account.id, [memberInput], [])
  assert.equal('error' in denied, true)
  assert.equal(useMemberStore.getState().members.length, 0)

  useAuthStore.getState().signOut()
  const adminSignIn = await useAuthStore
    .getState()
    .signIn('admin.import', 'import2026')
  assert.equal('account' in adminSignIn, true)
  if (!('account' in adminSignIn)) return

  useMemberStore.setState({ lastUpdatedAt: '2000-01-01T00:00:00.000Z' })
  const imported = useMemberStore
    .getState()
    .importMasterList(adminSignIn.account.id, [memberInput], [])
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
