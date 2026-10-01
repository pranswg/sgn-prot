import { resolveSidebarWidth } from '@/lib/sidebarNav'
import { cn } from '@/lib/utils'

/**
 * The sidebar on desktop: a full-height panel, edge to edge.
 *
 * It is a plain flex sibling of `<main>`, so the collapse animates this box and
 * the content follows in normal flow. No overlay on desktop.
 *
 * This is the original shell behaviour, deliberately restored:
 * - Full-bleed. `h-dvh` with no margin and no gutter wrapper, so the panel runs
 *   from the top of the viewport to the bottom and is flush to the left edge.
 *   A 16px inset plus a radius and a shadow turns the sidebar into a small
 *   detached panel floating inside the app, which is not what this app looks
 *   like.
 * - `dvh`, not `vh`. A `100vh` panel overflows once a mobile URL bar or desktop
 *   zoom shrinks the visible viewport.
 * - A right divider, not a full border: with the panel flush to the edges there
 *   is nothing on the left, top, or bottom to draw a line against.
 */
export function SidebarShell({
  collapsed,
  open,
  children,
}: {
  collapsed: boolean
  open: boolean
  children: React.ReactNode
}) {
  return (
    <aside
      data-slot="app-sidebar"
      data-state={!open ? 'hidden' : collapsed ? 'collapsed' : 'expanded'}
      aria-label="Primary"
      // At width 0 the content is clipped but still in the tab order and the
      // accessibility tree. `inert` (a React 19 boolean attribute) removes both.
      inert={!open}
      className={cn(
        'sticky top-0 flex h-dvh shrink-0 flex-col overflow-hidden',
        'border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        'transition-all duration-300 ease-in-out motion-reduce:transition-none',
        resolveSidebarWidth(open, !collapsed),
        open ? 'opacity-100' : 'm-0 opacity-0',
        !open && 'pointer-events-none',
      )}
    >
      {children}
    </aside>
  )
}