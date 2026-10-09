import assert from 'node:assert/strict'
import test from 'node:test'
import { useAdminStore } from './adminStore.ts'
import { useAuthStore } from './authStore.ts'

function createTestRole(adminId: string, label: string): string {
  const result = useAuthStore.getState().createManagedRole(adminId, {
    label,
    description: `Test role: ${label}`,
    permissions: ['view-dashboard'],
  })
  assert.ok('role' in result)
  if (!('role' in result)) throw new Error('Test role creation failed.')
  return result.role.id
}

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
  const staffRole = createTestRole(initial.account.id, 'Schedule Staff')

  const accountInput = {
    firstName: 'Maria',
    lastName: 'Santos',
    email: 'maria@example.org',
    username: 'maria.santos',
    password: 'maria2026',
    role: staffRole,
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
  const staffRole = createTestRole(admin.account.id, 'Session Staff')
  const user = await useAuthStore.getState().createManagedAccount(admin.account.id, {
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: '',
    username: 'juan.staff',
    password: 'juan2026',
    role: staffRole,
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
  const staffRole = createTestRole(admin.account.id, 'Permission Staff')

  const user = await useAuthStore.getState().createManagedAccount(admin.account.id, {
    firstName: 'Maria',
    lastName: 'Santos',
    email: '',
    username: 'maria.viewer',
    password: 'maria2026',
    role: staffRole,
    customPermissions: null,
  })
  assert.equal('account' in user, true)
  if (!('account' in user)) return

  const roleUpdate = useAuthStore
    .getState()
    .updateManagedRolePermissions(admin.account.id, staffRole, [
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
        .updateManagedRolePermissions(user.account.id, staffRole, []),
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

test('Admin-created roles can be assigned and cannot be removed while in use', async () => {
  useAuthStore.getState().clear()
  const adminResult = await useAuthStore.getState().register({
    username: 'role.admin',
    fullName: 'Role Admin',
    password: 'admin2026',
    confirmPassword: 'admin2026',
  })
  assert.ok('account' in adminResult)
  if (!('account' in adminResult)) return

  const createdRole = useAuthStore.getState().createManagedRole(adminResult.account.id, {
    label: 'Schedule Editor',
    description: 'Creates and edits choir schedules.',
    permissions: ['view-suguan', 'create-suguan', 'edit-suguan'],
  })
  assert.ok('role' in createdRole)
  if (!('role' in createdRole)) return
  assert.equal(
    useAdminStore.getState().rolePermissions[createdRole.role.id]?.includes('create-suguan'),
    true,
  )

  const user = await useAuthStore.getState().createManagedAccount(adminResult.account.id, {
    firstName: 'Ana',
    lastName: 'Reyes',
    email: '',
    username: 'ana.reyes',
    password: 'temporary2026',
    role: createdRole.role.id,
    customPermissions: null,
  })
  assert.ok('account' in user)
  if (!('account' in user)) return
  assert.equal(user.account.mustChangePassword, true)

  const blockedDelete = useAuthStore
    .getState()
    .deleteManagedRole(adminResult.account.id, createdRole.role.id)
  assert.ok('problems' in blockedDelete)
  const replacementRole = createTestRole(
    adminResult.account.id,
    'Attendance Staff',
  )
  const reassigned = useAuthStore
    .getState()
    .updateManagedAccount(adminResult.account.id, user.account.id, {
      role: replacementRole,
    })
  assert.ok('account' in reassigned)
  const deleted = useAuthStore
    .getState()
    .deleteManagedRole(adminResult.account.id, createdRole.role.id)
  assert.ok('roleId' in deleted)

  const customRole = useAuthStore.getState().createManagedRole(
    adminResult.account.id,
    {
      label: 'Temporary Role',
      description: '',
      permissions: [],
    },
  )
  assert.ok('role' in customRole)
  if (!('role' in customRole)) return
  const customRoleDeleted = useAuthStore
    .getState()
    .deleteManagedRole(adminResult.account.id, customRole.role.id)
  assert.ok('roleId' in customRoleDeleted)
  const protectedAdmin = useAuthStore
    .getState()
    .deleteManagedRole(adminResult.account.id, 'admin')
  assert.ok('problems' in protectedAdmin)
  const deletedRoleAccount = await useAuthStore.getState().createManagedAccount(
    adminResult.account.id,
    {
      firstName: 'Ava',
      lastName: 'Staff',
      email: '',
      username: 'ava.staff',
      password: 'temporary2026',
      role: customRole.role.id,
      customPermissions: null,
    },
  )
  assert.ok('problems' in deletedRoleAccount)
})

test('temporary passwords require and complete a first-sign-in password change', async () => {
  useAuthStore.getState().clear()
  const admin = await useAuthStore.getState().register({
    username: 'password.admin',
    fullName: 'Password Admin',
    password: 'admin2026',
    confirmPassword: 'admin2026',
  })
  assert.ok('account' in admin)
  if (!('account' in admin)) return
  const staffRole = createTestRole(admin.account.id, 'Password Reset Staff')
  const user = await useAuthStore.getState().createManagedAccount(admin.account.id, {
    firstName: 'Lia',
    lastName: 'Cruz',
    email: '',
    username: 'lia.cruz',
    password: 'temporary2026',
    role: staffRole,
    customPermissions: null,
  })
  assert.ok('account' in user)
  if (!('account' in user)) return
  useAuthStore.getState().signOut()
  const login = await useAuthStore.getState().signIn('lia.cruz', 'temporary2026')
  assert.ok('account' in login)
  if (!('account' in login)) return
  assert.equal(login.account.mustChangePassword, true)

  const changed = await useAuthStore.getState().changeOwnPassword(
    user.account.id,
    'newpassword2026',
  )
  assert.ok('account' in changed)
  if (!('account' in changed)) return
  assert.equal(changed.account.mustChangePassword, false)
  useAuthStore.getState().signOut()
  assert.ok('problems' in await useAuthStore.getState().signIn('lia.cruz', 'temporary2026'))
  assert.ok('account' in await useAuthStore.getState().signIn('lia.cruz', 'newpassword2026'))
  useAuthStore.getState().signOut()
  const adminLogin = await useAuthStore.getState().signIn('password.admin', 'admin2026')
  assert.ok('account' in adminLogin)
  if (!('account' in adminLogin)) return
  const permanentReset = await useAuthStore.getState().resetManagedPassword(
    adminLogin.account.id,
    user.account.id,
    'permanent2026',
    false,
  )
  assert.ok('account' in permanentReset)
  if (!('account' in permanentReset)) return
  assert.equal(permanentReset.account.mustChangePassword, false)
  const temporaryReset = await useAuthStore.getState().resetManagedPassword(
    adminLogin.account.id,
    user.account.id,
    'again2026',
    true,
  )
  assert.ok('account' in temporaryReset)
  if (!('account' in temporaryReset)) return
  assert.equal(temporaryReset.account.mustChangePassword, true)
})
