import {
  CalendarPlus,
  GraduationCap,
  LayoutDashboard,
  MoreHorizontal,
  Users,
} from 'lucide-react'
import { useNavStore, type Page } from '@/store/navStore'
import { cn } from '@/lib/utils'

const ITEMS: { label: string; page: Page; icon: typeof Users }[] = [
  { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
  { label: 'Members', page: 'master-list', icon: Users },
  { label: 'Trainees', page: 'trainees', icon: GraduationCap },
  { label: 'Suguan', page: 'suguan-builder', icon: CalendarPlus },
  { label: 'More', page: 'settings', icon: MoreHorizontal },
]

/** Mobile-only bottom tab bar. Hidden from `md` up, where the sidebar takes over. */
export function MobileBottomNav() {
  const page = useNavStore((s) => s.page)
  const navigate = useNavStore((s) => s.navigate)

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const isActive =
            page === item.page ||
            (item.page === 'suguan-builder' &&
              (page === 'suguan-history' || page === 'suguan-detail'))
          return (
            <li key={item.page}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => navigate(item.page)}
                className={cn(
                  'flex w-full flex-col items-center gap-1 px-1 py-2.5 transition-colors',
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
  )
}
