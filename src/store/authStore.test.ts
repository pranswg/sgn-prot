import assert from 'node:assert/strict'
import test from 'node:test'
import { useAdminStore } from './adminStore.ts'
import { useAuthStore } from './authStore.ts'

test('only first-run setup or an active Admin can create system accounts', async () => {
  useAuthStore.getState().clear()
  const initial = await useAuthStore.getState().register({
    username: 'admin.user',
    fullName: 'Admin User',
    password: 'choir2026',
    confirmPassword: 'choir2026',
  })
  assert.equal('account' in initial, true)
  if (!('account' in initial)) return
  assert.equal(initial.account.role, 'admin')

  const accountInput = {
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'maria@example.org',
    username: 'maria.santos',
    password: 'maria2026',
    role: 'suguan-manager' as const,
    customPermissions: null,
  }
  const created = await useAuthStore
    .getState()
    .createManagedAccount(initial.account.id, accountInput)
  assert.equal('account' in created, true)
  if (!('account' in created)) return
  assert.equal(created.account.fullName, 'Maria Santos')
  assert.equal(created.account.status, 'active')

  const publicRegistration = await useAuthStore.getState().register({
    username: 'another.user',
    fullName: 'Another User',
    password: 'another2026',
    confirmPassword: 'another2026',
  })
  assert.equal('problems' in publicRegistration, true)

  useAuthStore.getState().signOut()
  const signedIn = await useAuthStore
    .getState()
    .signIn('maria.santos', 'maria2026')
  assert.equal('account' in signedIn, true)
  if (!('account' in signedIn)) return
  const denied = await useAuthStore
    .getState()
    .createManagedAccount(signedIn.account.id, {
      ...accountInput,
      username: 'not.allowed',
    })
  assert.equal('problems' in denied, true)
  assert.equal(useAuthStore.getState().accounts.length, 2)
  assert.equal(useAdminStore.getState().auditLogs.length >= 2, true)
})

test('disabled accounts cannot sign in and failed attempts are recorded', async () => {
  useAuthStore.getState().clear()
  const admin = await useAuthStore.getState().register({
    username: 'admin.user',
    fullName: 'Admin User',
    password: 'choir2026',
    confirmPassword: 'choir2026',
  })
  assert.equal('account' in admin, true)
  if (!('account' in admin)) return
  const user = await useAuthStore.getState().createManagedAccount(admin.account.id, {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: '',
    username: 'juan.staff',
    password: 'juan2026',
    role: 'viewer',
    customPermissions: null,
  })
  assert.equal('account' in user, true)
  if (!('account' in user)) return
  const disabled = useAuthStore
    .getState()
    .updateManagedAccount(admin.account.id, user.account.id, {
      status: 'disabled',
      statusReason: 'Inactive staff member',
    })
  assert.equal('account' in disabled, true)
  useAuthStore.getState().signOut()
  const result = await useAuthStore.getState().signIn('juan.staff', 'juan2026')
  assert.equal('problems' in result, true)
  assert.equal(
    useAdminStore
      .getState()
      .loginHistory.some((entry) => entry.username === 'juan.staff' && entry.status === 'failed'),
    true,
  )
})

test('role permissions and session termination require an active Admin', async () => {
  useAuthStore.getState().clear()
  const admin = await useAuthStore.getState().register({
    username: 'admin.user',
    fullName: 'Admin User',
    password: 'choir2026',
    confirmPassword: 'choir2026',
  })
  assert.equal('account' in admin, true)
  if (!('account' in admin)) return

  const user = await useAuthStore.getState().createManagedAccount(admin.account.id, {
    firstName: 'Maria',
    lastName: 'Santos',
    email: '',
    username: 'maria.viewer',
    password: 'maria2026',
    role: 'viewer',
    customPermissions: null,
  })
  assert.equal('account' in user, true)
  if (!('account' in user)) return

  const roleUpdate = useAuthStore
    .getState()
    .updateManagedRolePermissions(admin.account.id, 'suguan-manager', [
      'view-dashboard',
      'create-suguan',
    ])
  assert.equal('permissions' in roleUpdate, true)
  assert.equal(
    useAdminStore.getState().auditLogs[0]?.module,
    'Roles & Permissions',
  )
  assert.equal(
    'problems' in
      useAuthStore
        .getState()
        .updateManagedRolePermissions(admin.account.id, 'admin', []),
    true,
  )

  const viewerLogin = await useAuthStore
    .getState()
    .signIn('maria.viewer', 'maria2026')
  assert.equal('account' in viewerLogin, true)
  if (!('account' in viewerLogin)) return
  const viewerSessionId = useAuthStore.getState().activeSessionId
  assert.ok(viewerSessionId)
  assert.equal(
    'problems' in
      useAuthStore
        .getState()
        .updateManagedRolePermissions(user.account.id, 'suguan-manager', []),
    true,
  )
  assert.equal(
    'problems' in
      useAuthStore
        .getState()
        .terminateManagedSession(user.account.id, viewerSessionId),
    true,
  )

  await useAuthStore.getState().signIn('admin.user', 'choir2026')
  const terminated = useAuthStore
    .getState()
    .terminateManagedSession(admin.account.id, viewerSessionId)
  assert.equal('session' in terminated, true)
  assert.equal(
    useAdminStore
      .getState()
      .activeSessions.some((session) => session.id === viewerSessionId),
    false,
  )
  assert.equal(
    useAdminStore.getState().auditLogs[0]?.action,
    'Terminated Active Session',
  )
})
