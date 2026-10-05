import { cn } from '@/lib/utils'
import { ChevronLeft, Music4, PanelLeft } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebarStore'

interface SidebarHeaderProps {
  collapsed: boolean
  /** The drawer has no collapse affordance; it is always full width. */
  showCollapseButton?: boolean
}

/**
 * Branding block: logo tile, wordmark, subtitle, and the collapse control.
 *
 * The tile is a fixed 36px square in both states so the crossfade between the
 * glyph and the `IC` initials never resizes the header.
 */
export function SidebarHeader({
  collapsed,
  showCollapseButton = true,
}: SidebarHeaderProps) {
  const setSidebarExpanded = useSidebarStore((s) => s.setSidebarExpanded)

  const showCollapse = showCollapseButton && !collapsed

  return (
    // px-5 plus the shell's own 16px inset is 36px from the viewport edge, so the
    // logo is clear of the card border rather than sitting against it.
    <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
      <button
        type="button"
        onClick={() => setSidebarExpanded(true)}
        disabled={!collapsed}
        aria-hidden={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        title={collapsed ? 'Expand sidebar' : undefined}
        className={cn(
          'group relative flex size-9 shrink-0 items-center justify-center rounded-[10px]',
          'bg-logo-bg text-logo-icon',
          'transition-colors duration-150 ease-in-out motion-reduce:transition-none',
          collapsed
            ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
            : 'cursor-default',
        )}
      >
        {/* Crossfade rather than a swap, so the mark does not pop mid-collapse.
            Collapsed, hovering (or keyboard-focusing) the tile crossfades the
            `IC` initials into the expand-sidebar icon. */}
        {collapsed ? (
          <PanelLeft
            className="absolute size-[18px] opacity-0 transition-opacity duration-300 motion-reduce:transition-none group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        ) : (
          <Music4
            className="absolute size-[18px] opacity-100 transition-opacity duration-300 motion-reduce:transition-none"
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            'relative text-[11px] font-bold tracking-tight transition-opacity duration-300 motion-reduce:transition-none',
            collapsed
              ? 'opacity-100 group-hover:opacity-0 group-focus-visible:opacity-0'
              : 'opacity-0',
          )}
          aria-hidden="true"
        >
          IC
        </span>
      </button>

      <div
        className={cn(
          'min-w-0 flex-1 transition-opacity duration-300 motion-reduce:transition-none',
          collapsed ? 'pointer-events-none opacity-0' : 'opacity-100',
        )}
      >
        <p className="truncate text-sm font-semibold text-sidebar-foreground">
          INC Choir Manager
        </p>
        <p className="truncate text-[11px] text-sidebar-secondary">
          Suguan Scheduling System
        </p>
        {/* Gold is a brand highlight only. It never appears on a nav row. */}
        <span className="mt-1.5 block h-0.5 w-5 rounded-full bg-brand-gold" />
      </div>

      {showCollapse && (
        <button
          type="button"
          onClick={() => setSidebarExpanded(false)}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg',
            'text-sidebar-muted transition-colors duration-150 ease-in-out motion-reduce:transition-none',
            'hover:bg-sidebar-hover hover:text-sidebar-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          )}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}