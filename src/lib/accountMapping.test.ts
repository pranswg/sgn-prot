import assert from 'node:assert/strict'
import test from 'node:test'
import {
  describeUserAgent,
  emailToUsername,
  groupRolePermissions,
  profileToAccount,
  usernameToEmail,
} from './accountMapping.ts'

test('usernameToEmail produces the synthetic internal address', () => {
  assert.equal(usernameToEmail('Maria.Santos'), 'maria.santos@choir.internal')
  assert.equal(emailToUsername('maria.santos@choir.internal'), 'maria.santos')
  assert.equal(emailToUsername('real@example.org'), 'real@example.org')
})

test('describeUserAgent labels common browsers and platforms', () => {
  const chrome = describeUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  )
  assert.equal(chrome.platform, 'Windows')
  assert.equal(chrome.device, 'Chrome / Windows')
  assert.equal(describeUserAgent('').device, 'Browser / Unknown device')
})

test('groupRolePermissions groups rows by role id', () => {
  const grouped = groupRolePermissions([
    { role_id: 'staff', permission: 'view-dashboard' },
    { role_id: 'staff', permission: 'view-suguan' },
    { role_id: 'admin', permission: 'manage-users' },
  ])
  assert.deepEqual(grouped.staff, ['view-dashboard', 'view-suguan'])
  assert.deepEqual(grouped.admin, ['manage-users'])
})

test('profileToAccount maps a profiles row onto an Account', () => {
  const account = profileToAccount({
    id: 'user-1',
    username: 'maria.santos',
    full_name: 'Maria Santos',
    first_name: 'Maria',
    last_name: 'Santos',
    email: '',
    role_id: 'staff',
    status: 'active',
    custom_permissions: ['view-dashboard'],
    must_change_password: true,
    status_reason: null,
    created_at: '2026-10-08T00:00:00.000Z',
    last_login_at: null,
  })
  assert.equal(account.role, 'staff')
  assert.equal(account.customPermissions?.[0], 'view-dashboard')
  assert.equal(account.mustChangePassword, true)
  assert.equal(account.lastLoginAt, undefined)
})
