import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { isNavItemActive, type NavItem } from '@/lib/sidebarNav'
import { useNavStore } from '@/store/navStore'
import { useSidebarStore } from '@/store/sidebarStore'

interface SidebarItemProps {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}

/**
 * One navigation row.
 *
 * The row wrapper is a fixed-height grid cell in both states and the button
 * inside it is centred, which is what keeps every icon on the same centre line
 * as the sidebar collapses. See `SIDEBAR_METRICS` for why the height is pinned
 * rather than matching the pill.
 */
export function SidebarItem({ item, collapsed, onNavigate }: SidebarItemProps) {
  const page = useNavStore((s) => s.page)
  const navigate = useNavStore((s) => s.navigate)
  const setSidebarExpanded = useSidebarStore((s) => s.setSidebarExpanded)
  const active = isNavItemActive(page, item.page)
  const Icon = item.icon

  const handleClick = () => {
    // Expanding first matters: on the collapsed rail there is no label on
    // screen, so navigating without this would move the user somewhere they
    // cannot identify.
    if (collapsed) setSidebarExpanded(true)
    navigate(item.page)
    onNavigate?.()
  }

  const button = (
    <div className="grid h-11 place-items-center">
      <button
        type="button"
        onClick={handleClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group flex items-center rounded-lg transition-colors duration-150 ease-in-out motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
          collapsed
            ? 'size-11 justify-center rounded-xl'
            : // w-full minus the section's px-1 inset on each side, so the active
              // pill stops 4px short of the card edge instead of running flush.
              'h-[38px] w-full gap-2.5 px-3',
          active
            ? 'bg-sidebar-active text-sidebar-active-foreground shadow-[var(--shadow-nav-active)]'
            : 'text-sidebar-secondary hover:bg-sidebar-hover hover:text-sidebar-foreground',
        )}
      >
        <Icon className="size-[17px] shrink-0" aria-hidden="true" />
        <span
          className={cn(
            'truncate text-sm font-medium transition-all duration-300 ease-in-out motion-reduce:transition-none',
            collapsed ? 'max-w-0 overflow-hidden opacity-0' : 'max-w-[160px] opacity-100',
          )}
        >
          {item.label}
        </span>
      </button>
    </div>
  )

  // No tooltip when the label is already on screen: it would be a second copy
  // of the same text sitting over the sidebar.
  if (!collapsed) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={12}
        align="center"
        className="border-sidebar-border bg-sidebar text-sidebar-foreground"
      >
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}