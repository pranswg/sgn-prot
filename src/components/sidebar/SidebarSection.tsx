import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface SidebarSectionProps {
  label: string
  collapsed: boolean
  children: ReactNode
}

/**
 * A titled group of navigation rows.
 *
 * The heading animates its own height to zero via `grid-template-rows` rather
 * than `max-height`, so the rows below slide up smoothly instead of snapping
 * the moment the collapse starts.
 */
export function SidebarSection({ label, collapsed, children }: SidebarSectionProps) {
  return (
    <div className="px-1">
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div className="overflow-hidden">
          {/* px-4 aligns the caption with the item labels below it, which sit at
              px-1 (row inset) + px-3 (button padding) inside the 260px card. */}
          <p
            className={cn(
              'px-4 pt-4 pb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase',
              'text-sidebar-muted transition-opacity duration-300 motion-reduce:transition-none',
              collapsed && 'opacity-0',
            )}
          >
            {label}
          </p>
        </div>
      </div>
      {/* px-1 keeps every row 4px clear of the card edge, so the active pill has
          visible breathing room on both sides. */}
      <div className="flex flex-col gap-[5px] px-1">{children}</div>
    </div>
  )
}