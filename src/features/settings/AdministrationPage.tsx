import { useAuthStore } from '@/store/authStore'
import { AdminManagement } from './AdminManagement'

export function AdministrationPage() {
  const account = useAuthStore((state) =>
    state.accounts.find((item) => item.id === state.currentAccountId),
  )
  if (!account) return null
  return <AdminManagement actorId={account.id} />
}