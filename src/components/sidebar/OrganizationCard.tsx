import { Music4 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useMemberStore } from '@/store/memberStore'

/**
 * Bottom card identifying the workspace and who is signed in.
 *
 * It reads real stores rather than fixed copy: the member count comes from
 * `memberStore` and the identity from `authStore`. Hard-coded placeholder
 * numbers here would look like real choir statistics, which is exactly the kind
 * of thing an officer trusts without checking.
 */
export function OrganizationCard({ collapsed }: { collapsed: boolean }) {
  const currentAccountId = useAuthStore((s) => s.currentAccountId)
  const accounts = useAuthStore((s) => s.accounts)
  const members = useMemberStore((s) => s.members)

  const account = accounts.find((candidate) => candidate.id === currentAccountId)
  const activeCount = members.filter((member) => member.isActive).length

  if (collapsed) {
    // Nothing legible fits in 72px, so the rail shows the monogram alone.
    return (
      <div className="grid h-11 place-items-center px-1">
        <div
          className={cn(
            'flex size-11 items-center justify-center rounded-xl',
            'border border-sidebar-org-border bg-sidebar-org text-logo-icon',
          )}
          title={account?.fullName}
        >
          <span className="text-xs font-bold">{initials(account?.fullName)}</span>
        </div>
      </div>
    )
  }

  // px-1 plus the card's own 16px shell inset is 20px from the viewport edge, and
  // it visually floats inside the sidebar rather than sitting against its edge.
  return (
    <div className="px-1">
      <div className="rounded-xl border border-sidebar-org-border bg-sidebar-org px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-logo-bg text-logo-icon">
            <Music4 className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">
              {account?.fullName ?? 'Signed in'}
            </p>
            <p className="truncate text-[11px] text-sidebar-secondary">
              {account?.role === 'admin' ? 'Administrator' : 'Member'}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-sidebar-secondary">
          {activeCount} active {activeCount === 1 ? 'member' : 'members'}
        </p>
      </div>
    </div>
  )
}

/** Up to two initials; falls back to a neutral mark for an unknown account. */
function initials(fullName: string | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}