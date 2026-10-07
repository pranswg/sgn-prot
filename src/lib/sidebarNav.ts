/**
 * Sidebar navigation structure and layout constants.
 *
 * Kept in a `.ts` file with no React in it for two reasons: the icon references
 * resolve fine under `node:test`, and it lets `sidebarNav.test.ts` assert that
 * every `Page` is reachable from the sidebar. Adding a page to `navStore.Page`
 * without adding it here fails that test.
 */

import {
  CalendarPlus,
  GraduationCap,
  Grid2X2,
  History,
  LayoutDashboard,
  Music4,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Page } from '@/store/navStore'

export interface NavItem {
  label: string
  page: Page
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  /** Referenced by page rather than by index into `NAV_ITEMS`, so reordering
   *  the flat list cannot silently move an item into the wrong group. */
  pages: Page[]
}

/** Widths in px. Kept in sync with the `w-*` classes in `resolveSidebarWidth`. */
export const SIDEBAR_WIDTH = {
  expanded: 260,
  collapsed: 72,
  hidden: 0,
  /** Floating card: 16px of backdrop on every side, so 32px off the height. */
  margin: 16,
  /** Mobile drawer width. The drawer is never collapsed, so it gets its own. */
  drawer: 280,
} as const

/** Tailwind classes for the three sidebar widths. */
export type SidebarWidthClass = 'w-[260px]' | 'w-[72px]' | 'w-0'

/**
 * Row and tile geometry.
 *
 * `row` is deliberately constant in both states. Expanded rows are 38px per the
 * spec and collapsed tiles are 44px, and if that height lived on the row the
 * whole list below would shuffle by 6px per item during the 300ms collapse.
 * Pinning the *row* to 44px and centring a 38px pill inside it keeps every
 * icon on the same centre line in both states, so the only thing that moves is
 * the label fade.
 */
export const SIDEBAR_METRICS = {
  row: 44,
  itemExpandedHeight: 38,
  itemCollapsedSize: 44,
} as const

/**
 * Single source of truth for navigation order. `NAV_GROUPS` below references
 * these by page, so a label or icon is only ever declared once.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
  { label: 'Master List', page: 'master-list', icon: Users },
  { label: 'Trainees', page: 'trainees', icon: GraduationCap },
  { label: 'Koro Maker', page: 'koro-maker', icon: Grid2X2 },
  { label: 'Organist Suguan', page: 'organista-suguan-maker', icon: Music4 },
  { label: 'Choir Suguan', page: 'suguan-builder', icon: CalendarPlus },
  { label: 'Suguan History', page: 'suguan-history', icon: History },
  { label: 'Settings', page: 'settings', icon: Settings },
]

export const NAV_GROUPS: readonly NavGroup[] = [
  { label: 'Overview', pages: ['dashboard'] },
  { label: 'Choir Management', pages: ['master-list', 'trainees', 'koro-maker'] },
  { label: 'Suguan', pages: ['suguan-builder', 'organista-suguan-maker', 'suguan-history'] },
  { label: 'System', pages: ['settings'] },
]

/**
 * Detail pages that should light up their parent entry. `suguan-detail` is
 * reached by drilling into the history list, so its nav highlight belongs on
 * Suguan History rather than on nothing.
 */
const ACTIVE_ALIASES: Partial<Record<Page, Page>> = {
  'suguan-detail': 'suguan-history',
}

export function navItemFor(page: Page): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.page === page)
}

export function isNavItemActive(currentPage: Page, itemPage: Page): boolean {
  return currentPage === itemPage || ACTIVE_ALIASES[currentPage] === itemPage
}

/** Groups with their items resolved, skipping any page with no nav item. */
export function resolvedNavGroups(): { label: string; items: NavItem[] }[] {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.pages
      .map((page) => navItemFor(page))
      .filter((item): item is NavItem => item !== undefined),
  }))
}



/**
 * The collapsed sidebar is an icon rail, so a click there would otherwise
 * navigate with no label visible. Callers expand first, then navigate; see
 * `SidebarItem`.
 */
export function resolveSidebarWidth(
  isNavigationOpen: boolean,
  isSidebarExpanded: boolean,
): SidebarWidthClass {
  if (!isNavigationOpen) return 'w-0'
  return isSidebarExpanded ? 'w-[260px]' : 'w-[72px]'
}

export const MOBILE_BREAKPOINT = 768

/** Matches `MOBILE_BREAKPOINT`, used by `useIsMobile` and the store default. */
export function isMobileViewport(width: number): boolean {
  return width < MOBILE_BREAKPOINT
}

/** Should navigation start visible? Wide viewports get the push sidebar. */
export function defaultNavigationOpen(width: number): boolean {
  return width >= MOBILE_BREAKPOINT
}