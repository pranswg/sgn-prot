import { SidebarHeader } from '@/components/sidebar/SidebarHeader'
import { SidebarSection } from '@/components/sidebar/SidebarSection'
import { SidebarItem } from '@/components/sidebar/SidebarItem'
import { SidebarFooter } from '@/components/sidebar/SidebarFooter'
import { resolvedNavGroups } from '@/lib/sidebarNav'

export interface SidebarBodyProps {
  /** Whether the outer container is the icon rail. */
  collapsed: boolean
  /** Close the mobile drawer after navigating. */
  onNavigate?: () => void
  /** Render the collapse control in the header? Drawer hides it. */
  showCollapseButton?: boolean
}

/**
 * Shared scrollable body for desktop and mobile. The collapse state determines
 * how sections and items render, but the data itself is the same, which is what
 * makes the two variants look like "one sidebar, two layouts".
 *
 * The horizontal padding is deliberately dropped here and the cards handle their
 * own insets instead. A `px-4` on this wrapper would push every child in, but
 * the section rows and the footer card then need their own margin anyway to stop
 * sitting flush against the card edge, and two nested paddings are what made
 * this feel cramped before. One inset per element, no stacking.
 */
export function SidebarBody({
  collapsed,
  onNavigate,
  showCollapseButton = true,
}: SidebarBodyProps) {
  const groups = resolvedNavGroups()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarHeader collapsed={collapsed} showCollapseButton={showCollapseButton} />
      <div className="mx-5 h-px bg-sidebar-border" />
      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex flex-col">
          {groups.map((group) => (
            <SidebarSection key={group.label} label={group.label} collapsed={collapsed}>
              {group.items.map((item) => (
                <SidebarItem
                  key={item.page}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarSection>
          ))}
        </div>
      </div>
      <SidebarFooter collapsed={collapsed} />
    </div>
  )
}