import assert from 'node:assert/strict'
import test from 'node:test'
import type { Account, Permission } from '@/core/types/auth'
import {
  canAccessPage,
  DEFAULT_ROLE_PERMISSIONS,
  effectivePermissions,
  hasPermission,
} from './rbac.ts'

const viewer: Account = {
  id: 'viewer',
  username: 'viewer',
  fullName: 'View User',
  role: 'viewer',
  passwordHash: '',
  passwordSalt: '',
  createdAt: '',
}

test('default roles receive their intended permission boundaries', () => {
  assert.equal(hasPermission(viewer, 'view-master-list', {}), true)
  assert.equal(hasPermission(viewer, 'edit-members', {}), false)
  assert.equal(
    hasPermission({ ...viewer, role: 'suguan-manager' }, 'export-documents', {}),
    true,
  )
  assert.equal(
    hasPermission({ ...viewer, role: 'suguan-manager' }, 'manage-users', {}),
    false,
  )
  assert.equal(
    effectivePermissions({ ...viewer, role: 'admin' }, {}).length,
    DEFAULT_ROLE_PERMISSIONS.admin.length,
  )
})

test('custom permissions override role defaults while Admin access stays full', () => {
  const customized: Account = {
    ...viewer,
    customPermissions: ['edit-members'] as Permission[],
  }
  assert.equal(hasPermission(customized, 'edit-members', {}), true)
  assert.equal(hasPermission(customized, 'view-master-list', {}), false)
  assert.equal(hasPermission({ ...customized, customPermissions: ['manage-users'] }, 'manage-users', {}), false)
  assert.equal(
    hasPermission(
      { ...customized, role: 'admin' },
      'manage-users',
      {},
    ),
    true,
  )
})

test('page access follows the permission matrix and Settings stays Admin-only', () => {
  const roles = {}
  assert.equal(canAccessPage('master-list', viewer, roles), true)
  assert.equal(canAccessPage('suguan-builder', viewer, roles), false)
  assert.equal(canAccessPage('settings', viewer, roles), false)
  assert.equal(
    canAccessPage('settings', { ...viewer, role: 'admin' }, roles),
    true,
  )
})
