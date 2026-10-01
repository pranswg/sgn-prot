import { OrganizationCard } from '@/components/sidebar/OrganizationCard'
import { ThemeToggle } from '@/components/sidebar/ThemeToggle'

/**
 * Bottom utility area: the theme switch above the organization card.
 *
 * It is pushed to the bottom with `mt-auto` on the scroll container rather than
 * by a flex spacer here, so it stays anchored when the nav list is longer than
 * the viewport on a small laptop.
 */
export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="mt-auto pb-5 pt-3">
      <div className="px-1 pb-3">
        <ThemeToggle collapsed={collapsed} />
      </div>
      <OrganizationCard collapsed={collapsed} />
    </div>
  )
}