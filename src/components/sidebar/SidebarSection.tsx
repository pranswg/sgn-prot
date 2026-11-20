import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/store/sidebarStore'
import type { ReactNode } from 'react'

interface SidebarSectionProps {
  label: string
  collapsed: boolean
  children: ReactNode
}

/**
 * A titled group of navigation rows whose header is a toggle button.
 *
 * The header is a disclosure: clicking it reveals or hides the section's rows.
 * Sections start closed so the sidebar opens as a short list of group headings.
 *
 * The reveal animates through `grid-template-rows` (`1fr` -> `0fr`) on a real
 * grid container with an `overflow-hidden` child, which is what makes the rows
 * collapse to zero height instead of merely being clipped. The container must
 * keep its `grid` display or the property has no effect at all.
 *
 * When the sidebar itself is collapsed to the icon rail the header hides and all
 * rows show as icons, so nothing is unreachable from the rail.
 */
export function SidebarSection({ label, collapsed, children }: SidebarSectionProps) {
  const expandedSections = useSidebarStore((s) => s.expandedSections)
  const toggleSection = useSidebarStore((s) => s.toggleSection)
  const isExpanded = expandedSections.includes(label)
  const showRows = isExpanded || collapsed

  return (
    <div className="px-1 mb-2">
      <button
        type="button"
        onClick={() => toggleSection(label)}
        aria-expanded={isExpanded}
        className={cn(
          // Mirrors the tab chrome: a rounded muted pill whose active state
          // reads as selected. Expanded (open) section = the tab state.
          'flex h-8 w-full items-center justify-between gap-2 px-4 text-left rounded-lg',
          'transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none',
          'hover:bg-sidebar-hover hover:text-sidebar-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
          collapsed ? 'pointer-events-none opacity-0' : '',
          isExpanded
            ? 'bg-background shadow-sm text-sidebar-foreground'
            : 'bg-muted text-sidebar-secondary',
        )}
      >
        <span
          className={cn(
            'truncate text-[10px] font-semibold tracking-[0.08em] uppercase',
            'motion-reduce:transition-none',
            isExpanded
              ? 'text-sidebar-foreground'
              : 'text-sidebar-secondary',
          )}
        >
          {label}
        </span>
        {isExpanded ? (
          <ChevronDown
            className="size-3.5 shrink-0 text-sidebar-foreground"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="size-3.5 shrink-0 text-sidebar-secondary"
            aria-hidden="true"
          />
        )}
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
          showRows ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {/* px-1 keeps every row 4px clear of the card edge, so the active pill
              has visible breathing room on both sides. pt-1 separates the first
              row from the header button above it. */}
          <div className="flex flex-col gap-[5px] px-1 pt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
