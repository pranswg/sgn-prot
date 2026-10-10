import { useState } from 'react'
import {
  Activity,
  Check,
  Clock3,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  ACCOUNT_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  rolePermissionsFor,
} from '@/lib/rbac'
import { useAdminStore, type ManagedRole } from '@/store/adminStore'
import {
  useAuthStore,
  type CreateManagedAccountInput,
} from '@/store/authStore'

type AdminSection = 'overview' | 'users' | 'roles' | 'audit' | 'logins' | 'sessions'

const EMPTY_NEW_USER: CreateManagedAccountInput = {
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  password: '',
  role: '',
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
  const removedRoleIds = useAdminStore.getState().removedRoleIds
  return (
    [...ACCOUNT_ROLES, ...useAdminStore.getState().customRoles].find(
      (item) => item.id === role && !removedRoleIds.includes(item.id),
    )?.label ?? role
  )
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
                    checked={value.includes(permission.id)}
                    disabled={disabled}
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
  const customRoles = useAdminStore((state) => state.customRoles)
  const removedRoleIds = useAdminStore((state) => state.removedRoleIds)
  const roles = [...ACCOUNT_ROLES, ...customRoles].filter(
    (role) => !removedRoleIds.includes(role.id),
  )
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
      toast.success(
        `System account for ${result.account.fullName} created. They must change the temporary password at first sign-in.`,
      )
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
                <PasswordInput
                  id="admin-new-password"
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
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {roles.find((role) => role.id === form.role)?.description}
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
                    rolePermissionsFor(form.role, rolePermissions)
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
          <Button onClick={() => void createAccount()} loading={pending}>
            {!pending && <Plus className="size-4" />}
            {pending ? 'Creating…' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ManagedRoleDialog({
  actorId,
  role,
  onClose,
}: {
  actorId: string
  role: ManagedRole | null
  onClose: () => void
}) {
  const createManagedRole = useAuthStore((state) => state.createManagedRole)
  const updateManagedRole = useAuthStore((state) => state.updateManagedRole)
  const [label, setLabel] = useState(role?.label ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const save = async () => {
    setPending(true)
    setError('')
    try {
      const result = role
        ? await updateManagedRole(actorId, role.id, { label, description })
        : await createManagedRole(actorId, { label, description, permissions })
      if ('problems' in result) {
        setError(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success(role ? 'Role updated.' : 'Role created.')
      onClose()
    } catch (cause) {
      console.error(cause)
      setError('Could not save the role. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            Set the role name and description, then choose the permissions this
            role grants. You can revisit them any time by opening the role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="managed-role-name">Role name</Label>
            <Input
              id="managed-role-name"
              maxLength={48}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="managed-role-description">Description</Label>
            <Input
              id="managed-role-description"
              maxLength={160}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {!role && (
            <section className="grid gap-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                INITIAL PERMISSIONS
              </h3>
              <PermissionChecks value={permissions} onChange={setPermissions} />
            </section>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={pending}>
            {pending ? 'Saving…' : role ? 'Save Role' : 'Create Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RolePermissionsDialog({
  actorId,
  role,
  current,
  onClose,
}: {
  actorId: string
  role: ManagedRole
  current: Permission[]
  onClose: () => void
}) {
  const updateManagedRolePermissions = useAuthStore(
    (state) => state.updateManagedRolePermissions,
  )
  const isAdmin = role.id === 'admin'
  const [permissions, setPermissions] = useState<Permission[]>(current)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const save = async () => {
    setPending(true)
    setError('')
    try {
      const result = await updateManagedRolePermissions(
        actorId,
        role.id,
        permissions,
      )
      if ('problems' in result) {
        setError(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success(`${role.label} permissions updated.`)
      onClose()
    } catch (cause) {
      console.error(cause)
      setError('Could not save the permissions. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{role.label} permissions</DialogTitle>
          <DialogDescription>
            {isAdmin
              ? 'Admin always has full access and cannot be restricted.'
              : 'Check the permissions this role grants. Changes apply to every user assigned this role.'}
          </DialogDescription>
        </DialogHeader>
        <PermissionChecks
          value={isAdmin ? DEFAULT_ROLE_PERMISSIONS.admin : permissions}
          onChange={setPermissions}
          disabled={isAdmin}
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isAdmin ? 'Close' : 'Cancel'}
          </Button>
          {!isAdmin && (
            <Button onClick={() => void save()} loading={pending}>
              {pending ? 'Saving…' : 'Save Permissions'}
            </Button>
          )}
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
  const customRoles = useAdminStore((state) => state.customRoles)
  const removedRoleIds = useAdminStore((state) => state.removedRoleIds)
  const roles = [...ACCOUNT_ROLES, ...customRoles].filter(
    (role) => !removedRoleIds.includes(role.id),
  )
  const [editing, setEditing] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [requirePasswordChange, setRequirePasswordChange] = useState(true)
  const [passwordError, setPasswordError] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [permissionsCustomized, setPermissionsCustomized] = useState(false)
  const [disableReason, setDisableReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [statusPending, setStatusPending] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '' as AccountRole,
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
        rolePermissionsFor(account.role, rolePermissions),
    )
    setPermissionsCustomized(account.customPermissions != null)
    setEditing(true)
  }

  const save = async () => {
    if (!account || saving) return
    const nextPermissions =
      form.role === 'admin' || !permissionsCustomized ? null : [...permissions]
    setSaving(true)
    try {
      const result = await updateManagedAccount(actorId, account.id, {
        ...form,
        customPermissions: nextPermissions,
      })
      if ('problems' in result) {
        toast.error(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success('User account updated.')
      setEditing(false)
    } catch (cause) {
      console.error(cause)
      toast.error('Could not update the account. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async () => {
    if (!account || resetting) return
    setPasswordError('')
    setResetting(true)
    try {
      const result = await resetManagedPassword(
        actorId,
        account.id,
        newPassword,
        requirePasswordChange,
      )
      if ('problems' in result) {
        setPasswordError(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success(
        requirePasswordChange
          ? 'Temporary password set. The user must change it at next sign-in.'
          : 'Permanent password set. Share it securely with the user.',
      )
      setNewPassword('')
      setRequirePasswordChange(true)
    } catch (cause) {
      console.error(cause)
      setPasswordError('Could not reset the password.')
    } finally {
      setResetting(false)
    }
  }

  const changeStatus = async (status: AccountStatus, reason = '') => {
    if (!account || statusPending) return
    setStatusPending(true)
    try {
      const result = await updateManagedAccount(actorId, account.id, {
        status,
        statusReason: reason,
      })
      if ('problems' in result) {
        toast.error(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success(`Account ${status === 'active' ? 'reactivated' : status}.`)
      onClose()
    } catch (cause) {
      console.error(cause)
      toast.error('Could not change the account status. Please try again.')
    } finally {
      setStatusPending(false)
    }
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
                        loading={statusPending}
                        onClick={() => {
                          void changeStatus('disabled', disableReason.trim())
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
                      loading={statusPending}
                      onClick={() => void changeStatus('active')}
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
                              rolePermissionsFor(nextRole, rolePermissions),
                            )
                            setPermissionsCustomized(false)
                          }
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
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
                      onChange={(next) => {
                        setPermissions(next)
                        setPermissionsCustomized(true)
                      }}
                    />
                  )}
                  <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>Save Changes</Button>
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
                            rolePermissionsFor(account.role, rolePermissions)
                      ).map((permission) => (
                        <p key={permission} className="flex items-center gap-2 text-sm">
                          <Check className="size-4 text-emerald-600" />
                          {PERMISSION_DEFINITIONS.find((item) => item.id === permission)?.label}
                        </p>
                      ))}
                    </div>
                  </section>
                  <section className="grid gap-2 rounded-lg border p-3">
                    <Label htmlFor="admin-reset-password">Set a new password</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex-1">
                        <PasswordInput
                          id="admin-reset-password"
                          autoComplete="new-password"
                          placeholder="Enter the new password"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                        />
                      </div>
                      <Button variant="outline" onClick={() => void resetPassword()} loading={resetting}>
                        {!resetting && <KeyRound className="size-4" />}
                        Reset Password
                      </Button>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={requirePasswordChange}
                        onCheckedChange={(checked) =>
                          setRequirePasswordChange(checked === true)
                        }
                      />
                      Require this user to change it at next sign-in (temporary)
                    </label>
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
  const terminateManagedSession = useAuthStore(
    (state) => state.terminateManagedSession,
  )
  const deleteManagedRole = useAuthStore((state) => state.deleteManagedRole)
  const auditLogs = useAdminStore((state) => state.auditLogs)
  const loginHistory = useAdminStore((state) => state.loginHistory)
  const activeSessions = useAdminStore((state) => state.activeSessions)
  const rolePermissions = useAdminStore((state) => state.rolePermissions)
  const customRoles = useAdminStore((state) => state.customRoles)
  const removedRoleIds = useAdminStore((state) => state.removedRoleIds)
  const roles = [...ACCOUNT_ROLES, ...customRoles].filter(
    (role) => !removedRoleIds.includes(role.id),
  )
  const [section, setSection] = useState<AdminSection>('overview')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [roleBeingEdited, setRoleBeingEdited] = useState<ManagedRole | null>(null)
  const [permissionsRole, setPermissionsRole] = useState<ManagedRole | null>(null)
  const [rolePendingDelete, setRolePendingDelete] = useState<ManagedRole | null>(null)
  const [sessionPendingId, setSessionPendingId] = useState<string | null>(null)
  const [deletingRole, setDeletingRole] = useState(false)
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

  const terminateSession = async (id: string) => {
    if (sessionPendingId) return
    setSessionPendingId(id)
    try {
      const result = await terminateManagedSession(actorId, id)
      if ('problems' in result) {
        toast.error(result.problems.map((problem) => problem.message).join(' '))
        return
      }
      toast.success(`Session for ${result.session.userName} ended.`)
    } catch (cause) {
      console.error(cause)
      toast.error('Could not end the session. Please try again.')
    } finally {
      setSessionPendingId(null)
    }
  }

  const confirmDeleteRole = async () => {
    if (!rolePendingDelete || deletingRole) return
    setDeletingRole(true)
    try {
      const result = await deleteManagedRole(actorId, rolePendingDelete.id)
      if ('problems' in result) {
        toast.error(result.problems.map((problem) => problem.message).join(' '))
      } else {
        toast.success(`${rolePendingDelete.label} role deleted.`)
      }
    } catch (cause) {
      console.error(cause)
      toast.error('Could not delete the role. Please try again.')
    } finally {
      setDeletingRole(false)
      setRolePendingDelete(null)
    }
  }

  const changeTab = (target: AdminSection) => setSection(target)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Administration"
        description="Manage system accounts, roles, permissions, and security activity."
      />
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <p className="font-medium">Server-backed administration</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-900/80">
          Accounts, roles, permissions, audit records, logins, and sessions are
          stored on your organization's server and shared across every device
          that signs in. Permissions are enforced by the server, not just by
          this screen.
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
                  {roles.map((role) => (
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Create roles for your organization and assign them to system accounts.
            </p>
            <Button
              onClick={() => {
                setRoleBeingEdited(null)
                setRoleDialogOpen(true)
              }}
            >
              <Plus className="size-4" />
              Create Role
            </Button>
          </div>
          <Card className="rounded-xl border-slate-200 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Roles & Permissions</CardTitle>
              <CardDescription>
                Open a role to choose the permissions it grants. Admin always retains full access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {roles.map((role) => {
                  const count = rolePermissionsFor(role.id, rolePermissions).length
                  return (
                    <div
                      key={role.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-slate-300"
                    >
                      <button
                        type="button"
                        className="flex flex-1 flex-col items-start gap-2 text-left"
                        onClick={() => setPermissionsRole(role)}
                      >
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          {role.id === 'admin' ? (
                            <ShieldCheck className="size-4 text-blue-600" />
                          ) : (
                            <Shield className="size-4 text-slate-500" />
                          )}
                          {role.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {role.description}
                        </span>
                        <span className="text-xs font-medium text-slate-600">
                          {role.id === 'admin'
                            ? 'Full access'
                            : `${count} permission${count === 1 ? '' : 's'} granted`}
                        </span>
                      </button>
                      {role.id !== 'admin' && (
                        <div className="flex justify-end gap-1">
                          {role.id.startsWith('custom-') && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Edit ${role.label}`}
                              onClick={() => {
                                setRoleBeingEdited(role)
                                setRoleDialogOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${role.label}`}
                            title={
                              accounts.some((account) => account.role === role.id)
                                ? 'Reassign users before deleting this role'
                                : 'Delete role'
                            }
                            disabled={accounts.some(
                              (account) => account.role === role.id,
                            )}
                            onClick={() => setRolePendingDelete(role)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {section === 'audit' && (
        <ActivityTable
          title="Audit Logs"
          description="Administrative changes and security actions recorded by the server."
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
          description="Successful and failed sign-in attempts recorded by the server."
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
              Signed-in sessions recorded by the server. End a session to revoke that device's sign-in.
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
                  <Button
                    size="sm"
                    variant="outline"
                    loading={sessionPendingId === session.id}
                    onClick={() => void terminateSession(session.id)}
                  >
                    {sessionPendingId !== session.id && <X className="size-4" />}
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
      {roleDialogOpen && (
        <ManagedRoleDialog
          key={roleBeingEdited?.id ?? 'new-role'}
          actorId={actorId}
          role={roleBeingEdited}
          onClose={() => setRoleDialogOpen(false)}
        />
      )}
      {permissionsRole && (
        <RolePermissionsDialog
          key={permissionsRole.id}
          actorId={actorId}
          role={permissionsRole}
          current={rolePermissionsFor(permissionsRole.id, rolePermissions)}
          onClose={() => setPermissionsRole(null)}
        />
      )}
      <AlertDialog
        open={rolePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setRolePendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this role?</AlertDialogTitle>
            <AlertDialogDescription>
              {rolePendingDelete
                ? `${rolePendingDelete.label} and its permission setup will be removed. The Admin role is protected, and roles assigned to users cannot be deleted.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              disabled={deletingRole}
              onClick={() => void confirmDeleteRole()}
            >
              {deletingRole && <Loader2 className="size-4 animate-spin" />}
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
