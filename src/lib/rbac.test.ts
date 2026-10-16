import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account, Permission } from '@/core/types/auth'
import {
  canAccessPage,
  DEFAULT_ROLE_PERMISSIONS,
  effectivePermissions,
  hasPermission,
} from './rbac.ts'

const staff: Account = {
  id: 'staff',
  username: 'staff',
  fullName: 'Staff User',
  role: 'custom-staff',
  passwordHash: '',
  passwordSalt: '',
  createdAt: '',
}

test('Admin is the only predefined role and unknown roles receive no permissions', () => {
  assert.deepEqual(Object.keys(DEFAULT_ROLE_PERMISSIONS), ['admin'])
  assert.equal(hasPermission(staff, 'view-master-list', {}), false)
  assert.equal(hasPermission(staff, 'edit-members', {}), false)
  assert.equal(
    effectivePermissions({ ...staff, role: 'admin' }, {}).length,
    DEFAULT_ROLE_PERMISSIONS.admin.length,
  )
})

test('explicit account permissions override role permissions and every permission is grantable', () => {
  const customized: Account = {
    ...staff,
    customPermissions: ['edit-members'] as Permission[],
  }
  assert.equal(hasPermission(customized, 'edit-members', {}), true)
  assert.equal(hasPermission(customized, 'view-master-list', {}), false)
  // No permission is reserved for Admin any more; the administrator decides who
  // holds each one.
  assert.equal(
    hasPermission(
      { ...customized, customPermissions: ['manage-users'] },
      'manage-users',
      {},
    ),
    true,
  )
  assert.equal(
    hasPermission({ ...customized, role: 'admin' }, 'manage-users', {}),
    true,
  )
})

test('Admin-created role permissions resolve dynamically and Admin still holds all', () => {
  const account: Account = { ...staff, role: 'custom-auditor' }
  const permissions = {
    'custom-auditor': ['view-dashboard', 'view-audit-logs'] as Permission[],
  }
  assert.deepEqual(effectivePermissions(account, permissions), [
    'view-dashboard',
    'view-audit-logs',
  ])
  assert.equal(hasPermission(account, 'view-dashboard', permissions), true)
  assert.equal(hasPermission(account, 'view-master-list', permissions), false)
  assert.equal(
    effectivePermissions({ ...account, role: 'admin' }, permissions).length,
    DEFAULT_ROLE_PERMISSIONS.admin.length,
  )
})

test('page access follows the permission matrix', () => {
  const roles = { 'custom-staff': ['view-master-list'] as Permission[] }
  assert.equal(canAccessPage('master-list', staff, roles), true)
  assert.equal(canAccessPage('suguan-builder', staff, roles), false)
  assert.equal(canAccessPage('settings', staff, roles), false)
  assert.equal(canAccessPage('administration', staff, roles), false)
  assert.equal(canAccessPage('koro-maker', staff, roles), false)

  const delegate: Account = {
    ...staff,
    customPermissions: ['change-settings', 'manage-users', 'koro-maker'],
  }
  assert.equal(canAccessPage('settings', delegate, {}), true)
  assert.equal(canAccessPage('administration', delegate, {}), true)
  assert.equal(canAccessPage('koro-maker', delegate, {}), true)

  // Any single Administration permission opens the screen.
  assert.equal(
    canAccessPage(
      'administration',
      { ...staff, customPermissions: ['view-audit-logs'] },
      {},
    ),
    true,
  )
  // The dedicated permission is additive: Edit Members still opens Koro Maker.
  assert.equal(
    canAccessPage(
      'koro-maker',
      { ...staff, customPermissions: ['edit-members'] },
      {},
    ),
    true,
  )
  // Admin holds everything.
  assert.equal(canAccessPage('settings', { ...staff, role: 'admin' }, roles), true)
  assert.equal(
    canAccessPage('administration', { ...staff, role: 'admin' }, roles),
    true,
  )
})
