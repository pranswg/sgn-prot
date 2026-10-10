import assert from 'node:assert/strict'
import test from 'node:test'
import {
  emailToUsername,
  nameParts,
  profileToAccount,
  toAccountStatus,
  usernameToEmail,
} from './authIdentity.ts'

test('usernameToEmail maps a username to its synthetic auth address', () => {
  assert.equal(usernameToEmail('admin'), 'admin@choir.local')
  assert.equal(usernameToEmail('  Maria.Santos '), 'maria.santos@choir.local')
})

test('emailToUsername is the inverse for synthetic addresses', () => {
  assert.equal(emailToUsername('admin@choir.local'), 'admin')
  assert.equal(emailToUsername('maria.santos@choir.local'), 'maria.santos')
  assert.equal(emailToUsername(null), '')
  assert.equal(emailToUsername(undefined), '')
})

test('toAccountStatus falls back to active on unknown values', () => {
  assert.equal(toAccountStatus('suspended'), 'suspended')
  assert.equal(toAccountStatus('pending-activation'), 'pending-activation')
  assert.equal(toAccountStatus('nonsense'), 'active')
  assert.equal(toAccountStatus(null), 'active')
})

test('nameParts prefers explicit first/last names', () => {
  assert.deepEqual(
    nameParts({ fullName: 'Ignored', firstName: 'Maria', lastName: 'Santos' }),
    { firstName: 'Maria', lastName: 'Santos' },
  )
  assert.deepEqual(nameParts({ fullName: 'Maria Santos' }), {
    firstName: 'Maria',
    lastName: 'Santos',
  })
  assert.deepEqual(nameParts({ fullName: 'Cher' }), {
    firstName: 'Cher',
    lastName: '',
  })
  assert.deepEqual(nameParts({ fullName: 'Maria Clara Santos' }), {
    firstName: 'Maria Clara',
    lastName: 'Santos',
  })
})

test('profileToAccount maps a Supabase profile row to the Account shape', () => {
  const account = profileToAccount({
    id: 'uuid-1',
    username: 'admin',
    full_name: 'Choir Administrator',
    email: 'admin@choir.local',
    role: 'admin',
    custom_permissions: null,
    status: 'active',
    must_change_password: false,
    created_at: '2026-10-08T00:00:00.000Z',
  })
  assert.equal(account.id, 'uuid-1')
  assert.equal(account.username, 'admin')
  assert.equal(account.fullName, 'Choir Administrator')
  assert.equal(account.firstName, 'Choir')
  assert.equal(account.lastName, 'Administrator')
  assert.equal(account.role, 'admin')
  assert.equal(account.status, 'active')
  assert.equal(account.mustChangePassword, false)
  assert.equal(account.customPermissions, null)
  // The profiles row never carries a password digest.
  assert.equal(account.passwordHash, undefined)
})
