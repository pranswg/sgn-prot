import { useState } from 'react'
import {
  Activity,
  Check,
  Clock3,
  KeyRound,
  Plus,
  Shield,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  Account,
  AccountRole,
  AccountStatus,
  Permission,
} from '@/core/types/auth'
import { initialsFor } from '@/lib/credentials'
import {
  ADMIN_ONLY_PERMISSIONS,
  ACCOUNT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
} from '@/lib/rbac'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore, type CreateManagedAccountInput } from '@/store/authStore'

type AdminSection = 'overview' | 'users' | 'roles' | 'audit' | 'logins' | 'sessions'

const EMPTY_NEW_USER: CreateManagedAccountInput = {
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  password: '',
  role: 'viewer',
  customPermissions: null,
}

const sectionItems: { id: AdminSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'User Management' },
  { id: 'roles', label: 'Roles & Permissions' },
  { id: 'audit', label: 'Audit Logs' },
  { id: 'logins', label: 'Login History' },
  { id: 'sessions', label: 'Active Sessions' },
]

function roleLabel(role: AccountRole) {
  return ACCOUNT_ROLES.find((item) => item.id === role)?.label ?? role
}

function statusLabel(status: AccountStatus | undefined) {
  switch (status ?? 'active') {
    case 'active':
      return 'Active'
    case 'disabled':
      return 'Disabled'
    case 'suspended':
      return 'Suspended'
    case 'pending-activation':
      return 'Pending Activation'
  }
}

function StatusBadge({ status }: { status: AccountStatus | undefined }) {
  const normalized = status ?? 'active'
  const classes =
    normalized === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : normalized === 'pending-activation'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : normalized === 'suspended'
          ? 'border-orange-200 bg-orange-50 text-orange-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {statusLabel(normalized)}
    </span>
  )
}

function dateTime(value: string | undefined) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date)
}

function PermissionChecks({
  value,
  onChange,
  disabled = false,
}: {
  value: Permission[]
  onChange: (next: Permission[]) => void
  disabled?: boolean
}) {
  const modules = [...new Set(PERMISSION_DEFINITIONS.map((permission) => permission.module))]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {modules.map((module) => (
        <fieldset key={module} className="min-w-0 rounded-lg border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {module}
          </legend>
          <div className="grid gap-2">
            {PERMISSION_DEFINITIONS.filter((permission) => permission.module === module).map(
              (permission) => (
                <label key={permission.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={
                      value.includes(permission.id) &&
                      !ADMIN_ONLY_PERMISSIONS.includes(permission.id)
                    }
                    disabled={
                      disabled ||
                      ADMIN_ONLY_PERMISSIONS.includes(permission.id)
                    }
                    onCheckedChange={(checked) =>
                      onChange(
                        checked
                          ? [...new Set([...value, permission.id])]
                          : value.filter((item) => item !== permission.id),
                      )
                    }
                  />
                  <span>{permission.label}</span>
                </label>
              ),
            )}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function CreateUserDialog({
  open,
  onOpenChange,
  actorId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actorId: string
}) {
  const createManagedAccount = useAuthStore((state) => state.createManagedAccount)
  const rolePermissions = useAdminStore((state) => state.rolePermissions)
  const [form, setForm] = useState(EMPTY_NEW_USER)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof CreateManagedAccountInput>(
    key: K,
    value: CreateManagedAccountInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const createAccount = async () => {
    setPending(true)
    setError('')
    try {
      const result = await createManagedAccount(actorId, form)
      if ('problems' in result) {
        setError(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success(`System account for ${result.account.fullName} created.`)
      setForm(EMPTY_NEW_USER)
      onOpenChange(false)
    } catch (cause) {
      console.error(cause)
      setError('Could not create the account. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const updateRole = (role: AccountRole) => {
    setForm({
      ...form,
      role,
      customPermissions: null,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setForm(EMPTY_NEW_USER)
          setError('')
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Create a staff system account. Choir members are managed separately.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <section className="grid gap-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
              PERSONAL INFORMATION
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="admin-new-first-name">First name</Label>
                <Input
                  id="admin-new-first-name"
                  value={form.firstName}
                  onChange={(event) => set('firstName', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-new-last-name">Last name</Label>
                <Input
                  id="admin-new-last-name"
                  value={form.lastName}
                  onChange={(event) => set('lastName', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="admin-new-email">Email</Label>
                <Input
                  id="admin-new-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => set('email', event.target.value)}
                />
              </div>
            </div>
          </section>
          <section className="grid gap-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
              ACCOUNT INFORMATION
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="admin-new-username">Username</Label>
                <Input
                  id="admin-new-username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={form.username}
                  onChange={(event) => set('username', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="admin-new-password">Temporary password</Label>
                <Input
                  id="admin-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => set('password', event.target.value)}
                />
              </div>
            </div>
          </section>
          <section className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:items-end">
              <div className="grid gap-1.5">
                <Label>Role assignment</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => updateRole(value as AccountRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_ROLES.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {ACCOUNT_ROLES.find((role) => role.id === form.role)?.description}
              </p>
            </div>
            <div className="grid gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                PERMISSIONS
              </h3>
              {form.role === 'admin' ? (
                <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                  Admin accounts always have full access. Their permissions cannot be restricted.
                </p>
              ) : (
                <PermissionChecks
                  value={
                    form.customPermissions ??
                    rolePermissions[form.role] ??
                    DEFAULT_ROLE_PERMISSIONS[form.role]
                  }
                  onChange={(permissions) => set('customPermissions', permissions)}
                />
              )}
            </div>
          </section>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void createAccount()} disabled={pending}>
            <Plus className="size-4" />
            {pending ? 'Creating…' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UserProfileDialog({
  account,
  onClose,
  actorId,
}: {
  account: Account | null
  onClose: () => void
  actorId: string
}) {
  const updateManagedAccount = useAuthStore((state) => state.updateManagedAccount)
  const resetManagedPassword = useAuthStore((state) => state.resetManagedPassword)
  const rolePermissions = useAdminStore((state) => state.rolePermissions)
  const [editing, setEditing] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [disableReason, setDisableReason] = useState('')
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'viewer' as AccountRole,
    status: 'active' as AccountStatus,
    statusReason: '',
  })

  const beginEdit = () => {
    if (!account) return
    setForm({
      firstName: account.firstName ?? account.fullName.split(/\s+/).slice(0, -1).join(' '),
      lastName: account.lastName ?? account.fullName.split(/\s+/).slice(-1)[0] ?? '',
      email: account.email ?? '',
      role: account.role,
      status: account.status ?? 'active',
      statusReason: account.statusReason ?? '',
    })
    setPermissions(
      account.customPermissions ??
        rolePermissions[account.role] ??
        DEFAULT_ROLE_PERMISSIONS[account.role],
    )
    setEditing(true)
  }

  const save = () => {
    if (!account) return
    const nextPermissions =
      form.role === 'admin' ? null : [...permissions]
    const result = updateManagedAccount(actorId, account.id, {
      ...form,
      customPermissions: nextPermissions,
    })
    if ('problems' in result) {
      toast.error(result.problems.map((problem) => problem.message).join(' '))
      return
    }
    toast.success('User account updated.')
    setEditing(false)
  }

  const resetPassword = async () => {
    if (!account) return
    setPasswordError('')
    try {
      const result = await resetManagedPassword(actorId, account.id, newPassword)
      if ('problems' in result) {
        setPasswordError(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success('Password reset. Share the temporary password securely.')
      setNewPassword('')
    } catch (cause) {
      console.error(cause)
      setPasswordError('Could not reset the password.')
    }
  }

  const changeStatus = (status: AccountStatus, reason = '') => {
    if (!account) return
    const result = updateManagedAccount(actorId, account.id, {
      status,
      statusReason: reason,
    })
    if ('problems' in result) {
      toast.error(result.problems.map((problem) => problem.message).join(' '))
      return
    }
    toast.success(`Account ${status === 'active' ? 'reactivated' : status}.`)
    onClose()
  }

  return (
    <>
      <Dialog
        open={!!account}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(false)
            onClose()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{account?.fullName}</DialogTitle>
            <DialogDescription>
              @{account?.username} · {account ? roleLabel(account.role) : ''}
            </DialogDescription>
          </DialogHeader>
          {account && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Account status</p>
                  <StatusBadge status={account.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {!editing && (
                    <Button size="sm" variant="outline" onClick={beginEdit}>
                      Edit Profile & Permissions
                    </Button>
                  )}
                  {account.status === 'active' ? (
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                      <Input
                        aria-label="Reason for disabling account"
                        placeholder="Reason for disabling"
                        value={disableReason}
                        onChange={(event) => setDisableReason(event.target.value)}
                        className="sm:w-52"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!disableReason.trim()}
                        onClick={() => {
                          changeStatus('disabled', disableReason.trim())
                          setDisableReason('')
                        }}
                      >
                        Disable Account
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeStatus('active')}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>First name</Label>
                      <Input
                        value={form.firstName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, firstName: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Last name</Label>
                      <Input
                        value={form.lastName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, lastName: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, email: event.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Role</Label>
                      <Select
                        value={form.role}
                        onValueChange={(role) =>
                          {
                            const nextRole = role as AccountRole
                            setForm((current) => ({
                              ...current,
                              role: nextRole,
                            }))
                            setPermissions(
                              rolePermissions[nextRole] ??
                                DEFAULT_ROLE_PERMISSIONS[nextRole],
                            )
                          }
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_ROLES.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(status) =>
                          setForm((current) => ({
                            ...current,
                            status: status as AccountStatus,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            [
                              'active',
                              'disabled',
                              'suspended',
                              'pending-activation',
                            ] as AccountStatus[]
                          ).map((status) => (
                            <SelectItem key={status} value={status}>
                              {statusLabel(status)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.status !== 'active' && (
                      <div className="grid gap-1.5 sm:col-span-2">
                        <Label>Reason for status change</Label>
                        <Input
                          value={form.statusReason}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              statusReason: event.target.value,
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                  {form.role === 'admin' ? (
                    <p className="rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                      Admin has full access and cannot have custom permission limits.
                    </p>
                  ) : (
                    <PermissionChecks
                      value={permissions}
                      onChange={setPermissions}
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={save}>Save Changes</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Role</p>
                      <p className="text-sm font-medium">{roleLabel(account.role)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{account.email || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Created</p>
                      <p className="text-sm font-medium">{dateTime(account.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Login</p>
                      <p className="text-sm font-medium">{dateTime(account.lastLoginAt)}</p>
                    </div>
                  </div>
                  <section className="grid gap-2">
                    <h3 className="text-sm font-semibold">Permissions</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(
                        account.role === 'admin'
                          ? DEFAULT_ROLE_PERMISSIONS.admin
                          : account.customPermissions ??
                            rolePermissions[account.role] ??
                            DEFAULT_ROLE_PERMISSIONS[account.role]
                      ).map((permission) => (
                        <p key={permission} className="flex items-center gap-2 text-sm">
                          <Check className="size-4 text-emerald-600" />
                          {PERMISSION_DEFINITIONS.find((item) => item.id === permission)?.label}
                        </p>
                      ))}
                    </div>
                  </section>
                  <section className="grid gap-2 rounded-lg border p-3">
                    <Label htmlFor="admin-reset-password">Reset Password</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id="admin-reset-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="New temporary password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                      <Button variant="outline" onClick={() => void resetPassword()}>
                        <KeyRound className="size-4" />
                        Reset Password
                      </Button>
                    </div>
                    {passwordError && (
                      <p role="alert" className="text-xs text-destructive">
                        {passwordError}
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Overview({
  users,
  actionsToday,
  onCreate,
  onRoles,
  onAudit,
}: {
  users: Account[]
  actionsToday: number
  onCreate: () => void
  onRoles: () => void
  onAudit: () => void
}) {
  const active = users.filter((user) => (user.status ?? 'active') === 'active').length
  const pending = users.filter((user) => user.status === 'pending-activation').length
  const cards = [
    { label: 'Total System Users', value: users.length, icon: Users, note: 'Staff accounts' },
    { label: 'Active Users', value: active, icon: UserRound, note: 'Can sign in' },
    { label: 'Pending Accounts', value: pending, icon: Clock3, note: 'Awaiting activation' },
    { label: 'Recent Admin Actions', value: actionsToday, icon: Activity, note: 'Actions today' },
  ]
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-xl border-slate-200 shadow-none">
            <CardContent className="flex items-start justify-between p-4">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.note}</p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <card.icon className="size-4" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-xl border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
          <CardDescription>Common system administration tasks.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={onCreate}>
            <Plus className="size-4" />
            Create User
          </Button>
          <Button variant="outline" onClick={onRoles}>
            <Shield className="size-4" />
            Manage Permissions
          </Button>
          <Button variant="outline" onClick={onAudit}>
            <Activity className="size-4" />
            View Audit Logs
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function AdminManagement({ actorId }: { actorId: string }) {
  const accounts = useAuthStore((state) => state.accounts)
  const updateManagedRolePermissions = useAuthStore(
    (state) => state.updateManagedRolePermissions,
  )
  const terminateManagedSession = useAuthStore(
    (state) => state.terminateManagedSession,
  )
  const auditLogs = useAdminStore((state) => state.auditLogs)
  const loginHistory = useAdminStore((state) => state.loginHistory)
  const activeSessions = useAdminStore((state) => state.activeSessions)
  const rolePermissions = useAdminStore((state) => state.rolePermissions)
  const [section, setSection] = useState<AdminSection>('overview')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredAccounts = accounts.filter((account) => {
    const search = query.trim().toLowerCase()
    const searchMatch =
      !search ||
      `${account.fullName} ${account.username} ${roleLabel(account.role)}`
        .toLowerCase()
        .includes(search)
    const roleMatch = roleFilter === 'all' || account.role === roleFilter
    const statusMatch =
      statusFilter === 'all' ||
      (account.status ?? 'active') === statusFilter
    return searchMatch && roleMatch && statusMatch
  })
  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? null
  const today = new Date().toDateString()
  const actionsToday = auditLogs.filter(
    (log) => new Date(log.createdAt).toDateString() === today,
  ).length

  const inspectUser = (account: Account) => {
    setSelectedAccountId(account.id)
  }

  const changeRolePermission = (
    role: AccountRole,
    permission: Permission,
    enabled: boolean,
  ) => {
    if (role === 'admin') return
    const before = rolePermissions[role] ?? DEFAULT_ROLE_PERMISSIONS[role]
    const after = enabled
      ? [...new Set([...before, permission])]
      : before.filter((item) => item !== permission)
    const result = updateManagedRolePermissions(actorId, role, after)
    if ('problems' in result) {
      toast.error(result.problems.map((problem) => problem.message).join(' '))
    }
  }

  const terminateSession = (id: string) => {
    const result = terminateManagedSession(actorId, id)
    if ('problems' in result) {
      toast.error(result.problems.map((problem) => problem.message).join(' '))
      return
    }
    toast.success(`Session for ${result.session.userName} ended.`)
  }

  const changeTab = (target: AdminSection) => setSection(target)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Administration"
        description="Manage system accounts, roles, permissions, and security activity."
      />
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <p className="font-medium">Browser-local administration</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
          Accounts, permissions, audit records, and sessions are stored only in
          this browser. This local-only app cannot verify remote IP addresses or
          revoke sessions on another device; server-side authentication is
          required for production security.
        </p>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {sectionItems.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={section === item.id ? 'page' : undefined}
            onClick={() => changeTab(item.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              section === item.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <Overview
          users={accounts}
          actionsToday={actionsToday}
          onCreate={() => setCreateOpen(true)}
          onRoles={() => changeTab('roles')}
          onAudit={() => changeTab('audit')}
        />
      )}

      {section === 'users' && (
        <div className="grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="admin-user-search">Search users</Label>
              <Input
                id="admin-user-search"
                placeholder="Search name, username, or role..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ACCOUNT_ROLES.map((role) => (
                    <SelectItem key={role.id} value={role.id}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {(
                    ['active', 'disabled', 'suspended', 'pending-activation'] as AccountStatus[]
                  ).map((status) => (
                    <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create User
            </Button>
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>Profile</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                        {initialsFor(account.fullName)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{account.fullName}</TableCell>
                    <TableCell className="text-slate-500">@{account.username}</TableCell>
                    <TableCell>{roleLabel(account.role)}</TableCell>
                    <TableCell><StatusBadge status={account.status} /></TableCell>
                    <TableCell className="text-slate-500">{dateTime(account.lastLoginAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => inspectUser(account)}>
                          View / Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={(account.status ?? 'active') === 'active' ? 'ghost' : 'outline'}
                          onClick={() => inspectUser(account)}
                          disabled={account.id === actorId}
                        >
                          Manage Access
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No system users match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {filteredAccounts.map((account) => (
              <Card key={account.id} className="rounded-xl border-slate-200 shadow-none">
                <CardContent className="grid gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                      {initialsFor(account.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{account.fullName}</p>
                      <p className="truncate text-sm text-muted-foreground">@{account.username}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {roleLabel(account.role)}
                        </span>
                        <StatusBadge status={account.status} />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last login: {dateTime(account.lastLoginAt)}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => inspectUser(account)}>
                      View / Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => inspectUser(account)}
                      disabled={account.id === actorId}
                    >
                      Manage Access
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredAccounts.length === 0 && (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No system users match these filters.
              </p>
            )}
          </div>
        </div>
      )}

      {section === 'roles' && (
        <div className="grid gap-4">
          <Card className="rounded-xl border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Roles & Permissions</CardTitle>
              <CardDescription>
                Set the default permissions inherited by each role. Admin always retains full access.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="min-w-56">Permission</TableHead>
                    {ACCOUNT_ROLES.map((role) => (
                      <TableHead key={role.id} className="min-w-36 text-center">
                        {role.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSION_DEFINITIONS.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell>
                        <p className="font-medium">{permission.label}</p>
                        <p className="text-xs text-muted-foreground">{permission.module}</p>
                      </TableCell>
                      {ACCOUNT_ROLES.map((role) => {
                        const granted = (
                          rolePermissions[role.id] ??
                          DEFAULT_ROLE_PERMISSIONS[role.id]
                        ).includes(permission.id)
                        return (
                          <TableCell key={role.id} className="text-center">
                            <Checkbox
                              aria-label={`${permission.label} for ${role.label}`}
                              checked={role.id === 'admin' || granted}
                              disabled={
                                role.id === 'admin' ||
                                ADMIN_ONLY_PERMISSIONS.includes(permission.id)
                              }
                              onCheckedChange={(checked) =>
                                changeRolePermission(
                                  role.id,
                                  permission.id,
                                  checked === true,
                                )
                              }
                            />
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ACCOUNT_ROLES.map((role) => (
              <Card key={role.id} className="rounded-xl border-slate-200 shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {role.id === 'admin' ? <ShieldCheck className="size-4 text-blue-600" /> : <Shield className="size-4 text-slate-500" />}
                    {role.label}
                  </CardTitle>
                  <CardDescription>{role.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {(rolePermissions[role.id] ?? DEFAULT_ROLE_PERMISSIONS[role.id]).length} permissions granted
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {section === 'audit' && (
        <ActivityTable
          title="Audit Logs"
          description="Administrative changes and security actions recorded on this browser."
          empty="No administrative activity has been recorded yet."
          headings={['Action', 'Performed By', 'Affected User', 'Details', 'Date & Time']}
          rows={auditLogs.map((log) => [
            log.action,
            `${log.actorName} (@${log.actorUsername})`,
            log.affectedUserName ?? '—',
            log.details ?? log.module,
            dateTime(log.createdAt),
          ])}
        />
      )}

      {section === 'logins' && (
        <ActivityTable
          title="Login History"
          description="Successful and failed sign-in attempts recorded by this browser."
          empty="No login attempts have been recorded yet."
          headings={['User', 'Device', 'Location / IP', 'Date & Time', 'Status']}
          rows={loginHistory.map((entry) => [
            `${entry.userName} (@${entry.username})`,
            entry.device,
            entry.locationIp,
            dateTime(entry.createdAt),
            entry.status,
          ])}
        />
      )}

      {section === 'sessions' && (
        <Card className="rounded-xl border-slate-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Active Sessions</CardTitle>
            <CardDescription>
              Signed-in browser sessions known to this device. End a session to revoke its local sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                    <UserRound className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{session.userName}</p>
                    <p className="text-sm text-muted-foreground">
                      {session.device} · {session.platform}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.locationIp} · Active since {dateTime(session.startedAt)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-emerald-700">Active now</span>
                  <Button size="sm" variant="outline" onClick={() => terminateSession(session.id)}>
                    <X className="size-4" />
                    Logout Device
                  </Button>
                </div>
              ))}
              {activeSessions.length === 0 && (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No active sessions.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        actorId={actorId}
      />
      <UserProfileDialog
        account={selectedAccount}
        onClose={() => setSelectedAccountId(null)}
        actorId={actorId}
      />
    </div>
  )
}

function ActivityTable({
  title,
  description,
  empty,
  headings,
  rows,
}: {
  title: string
  description: string
  empty: string
  headings: string[]
  rows: string[][]
}) {
  return (
    <Card className="rounded-xl border-slate-200 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                {headings.map((heading) => <TableHead key={heading}>{heading}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row[0]}-${index}`}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${cellIndex}-${cell}`} className={cellIndex === 0 ? 'font-medium' : 'text-slate-600'}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={headings.length} className="h-24 text-center text-muted-foreground">
                    {empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
