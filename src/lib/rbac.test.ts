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

test('explicit account permissions override role permissions while Admin stays full', () => {
  const customized: Account = {
    ...staff,
    customPermissions: ['edit-members'] as Permission[],
  }
  assert.equal(hasPermission(customized, 'edit-members', {}), true)
  assert.equal(hasPermission(customized, 'view-master-list', {}), false)
  assert.equal(
    hasPermission(
      { ...customized, customPermissions: ['manage-users'] },
      'manage-users',
      {},
    ),
    true,
  )
  assert.equal(
    hasPermission(
      { ...customized, role: 'admin' },
      'manage-users',
      {},
    ),
    true,
  )
})

test('Admin-created role permissions resolve dynamically, including admin-tier ones', () => {
  const account: Account = { ...staff, role: 'custom-auditor' }
  const permissions = {
    'custom-auditor': ['view-dashboard', 'view-audit-logs'] as Permission[],
  }
  assert.deepEqual(effectivePermissions(account, permissions), [
    'view-dashboard',
    'view-audit-logs',
  ])
  assert.equal(hasPermission(account, 'view-dashboard', permissions), true)
  assert.equal(hasPermission(account, 'view-audit-logs', permissions), true)
  assert.equal(hasPermission(account, 'view-master-list', permissions), false)
})

test('page access follows the permission matrix; System pages open with their permission', () => {
  const roles = { 'custom-staff': ['view-master-list'] as Permission[] }
  assert.equal(canAccessPage('master-list', staff, roles), true)
  assert.equal(canAccessPage('suguan-builder', staff, roles), false)
  assert.equal(canAccessPage('settings', staff, roles), false)
  assert.equal(canAccessPage('administration', staff, roles), false)

  const systemRoles = {
    'custom-staff': ['change-settings', 'view-audit-logs'] as Permission[],
  }
  assert.equal(canAccessPage('settings', staff, systemRoles), true)
  assert.equal(canAccessPage('administration', staff, systemRoles), true)
  assert.equal(
    canAccessPage('settings', { ...staff, role: 'admin' }, roles),
    true,
  )
})
