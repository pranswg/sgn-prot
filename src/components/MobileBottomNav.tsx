import { useState } from 'react'
import {
  CalendarPlus,
  GraduationCap,
  Grid2X2,
  LayoutDashboard,
  MoreHorizontal,
  Users,
} from 'lucide-react'
import { useNavStore, type Page } from '@/store/navStore'
import { cn } from '@/lib/utils'
import {
  NAV_GROUPS,
  navItemFor,
  isNavItemActive,
  type NavItem,
} from '@/lib/sidebarNav'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/store/authStore'
import { useAdminStore } from '@/store/adminStore'
import { canAccessPage } from '@/lib/rbac'

const ITEMS: { label: string; page: Page; icon: typeof Users }[] = [
  { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
  { label: 'Members', page: 'master-list', icon: Users },
  { label: 'Trainees', page: 'trainees', icon: GraduationCap },
  { label: 'Koro', page: 'koro-maker', icon: Grid2X2 },
  { label: 'Suguan', page: 'suguan-builder', icon: CalendarPlus },
  { label: 'More', page: 'settings', icon: MoreHorizontal },
]

/** Pages already pinned to the tab bar; the More sheet lists the rest. */
const PRIMARY_BAR_PAGES: Page[] = [
  'dashboard',
  'master-list',
  'trainees',
  'koro-maker',
  'suguan-builder',
]

/** Pages reached only from the More sheet light up the More tab itself. */
const MORE_PAGES: Page[] = [
  'members-history',
  'organista-suguan-maker',
  'suguan-history',
  'settings',
  'administration',
]

/** The sidebar groups, minus the tabs already on the bar. */
function moreNavGroups(): { label: string; items: NavItem[] }[] {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.pages
      .map((groupPage) => navItemFor(groupPage))
      .filter((item): item is NavItem => item !== undefined)
      .filter((item) => !PRIMARY_BAR_PAGES.includes(item.page)),
  })).filter((group) => group.items.length > 0)
}

/** Mobile-only bottom tab bar. Hidden from `md` up, where the sidebar takes over. */
export function MobileBottomNav() {
  const page = useNavStore((s) => s.page)
  const navigate = useNavStore((s) => s.navigate)
  const accounts = useAuthStore((state) => state.accounts)
  const currentAccountId = useAuthStore((state) => state.currentAccountId)
  const account = accounts.find((item) => item.id === currentAccountId)
  const rolePermissions = useAdminStore((state) => state.rolePermissions)
  const [moreOpen, setMoreOpen] = useState(false)

  // The builder has its own fixed Back/Next bar on the same edge and the same
  // z-index; rendering both stacked the tab bar on top of the step navigation
  // and hid Next completely. The focused step flow replaces the tab bar.
  if (page === 'suguan-builder') return null

  const allowed = (target: Page) => canAccessPage(target, account, rolePermissions)
  const visibleItems = ITEMS.filter(
    (item) => item.page === 'settings' || allowed(item.page),
  )
  const groups = moreNavGroups()
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed(item.page)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleItems.map((item) => {
            const moreActive =
              item.page === 'settings' &&
              MORE_PAGES.some((morePage) => morePage === page && allowed(morePage))
            const isActive =
              page === item.page ||
              moreActive ||
              (item.page === 'suguan-builder' &&
                (page === 'suguan-history' || page === 'suguan-detail'))
            return (
              <li key={item.page}>
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() =>
                    item.page === 'settings'
                      ? setMoreOpen(true)
                      : navigate(item.page)
                  }
                  className={cn(
                    'pressable flex w-full flex-col items-center gap-1 px-1 py-2.5',
                    isActive
                      ? 'text-brand-teal'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-lg transition-colors',
                      isActive && 'bg-brand-teal-soft',
                    )}
                  >
                    <item.icon className="size-[1.125rem]" />
                  </span>
                  <span
                    className={cn(
                      'text-[0.625rem] leading-none',
                      isActive && 'font-semibold',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* The rest of the sidebar, as a bottom sheet instead of a fifth tab. */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-3xl px-0 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden"
        >
          <span
            aria-hidden
            className="mx-auto mt-0.5 h-1.5 w-10 shrink-0 rounded-full bg-muted"
          />
          <SheetHeader className="gap-0.5 border-b border-border/70 px-4 pt-3 pb-2">
            <SheetTitle>More tabs</SheetTitle>
            <SheetDescription>Everything else in the sidebar</SheetDescription>
          </SheetHeader>
          <div className="max-h-[60vh] overflow-y-auto pb-2">
            {groups.map((group) => (
              <div key={group.label} className="mt-3">
                <p className="px-4 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </p>
                <ul className="mt-1 px-2">
                  {group.items.map((item) => {
                    const active = isNavItemActive(page, item.page)
                    return (
                      <li key={item.page}>
                        <button
                          type="button"
                          aria-current={active ? 'page' : undefined}
                          onClick={() => {
                            setMoreOpen(false)
                            navigate(item.page)
                          }}
                          className={cn(
                            'pressable flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium',
                            active
                              ? 'bg-brand-teal-soft text-brand-teal'
                              : 'text-foreground hover:bg-muted',
                          )}
                        >
                          <item.icon className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          {active && (
                            <span className="size-1.5 shrink-0 rounded-full bg-brand-teal" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
