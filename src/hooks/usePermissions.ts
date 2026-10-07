import { hasPermission } from '@/lib/rbac'
import type { Permission } from '@/core/types/auth'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'

export function usePermissions() {
  const accounts = useAuthStore((state) => state.accounts)
  const currentAccountId = useAuthStore((state) => state.currentAccountId)
  const account = accounts.find((item) => item.id === currentAccountId)
  const rolePermissions = useAdminStore((state) => state.rolePermissions)
  return {
    account,
    can: (permission: Permission) =>
      hasPermission(account, permission, rolePermissions),
  }
}
