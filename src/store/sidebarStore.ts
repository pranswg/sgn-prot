import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultNavigationOpen } from '@/lib/sidebarNav'

interface SidebarState {
  /**
   * Whether the sidebar occupies space at all. `false` is width 0 with the
   * content reflowing to full width. Kept separate from expansion because
   * "hide it" and "shrink it to icons" are different intentions, and collapsing
   * to a 72px rail is much more usable than either extreme alone.
   */
  isNavigationOpen: boolean
  /** 256px rail with labels, or a 72px icon-only rail. */
  isSidebarExpanded: boolean
  /** Radix drawer state, only ever read on mobile. */
  isMobileDrawerOpen: boolean
  /** Section labels whose items are showing. Starts empty so the sidebar opens
   *  as a list of group headings; the user opens the section they need. */
  expandedSections: string[]
  setNavigationOpen: (open: boolean) => void
  toggleNavigation: () => void
  setSidebarExpanded: (expanded: boolean) => void
  toggleSidebarExpanded: () => void
  setMobileDrawerOpen: (open: boolean) => void
  /** Opens or closes one section group's rows. */
  toggleSection: (label: string) => void
}

function initialNavigationOpen(): boolean {
  if (typeof window === 'undefined') return true
  return defaultNavigationOpen(window.innerWidth)
}

function initialExpandedSections(): string[] {
  return []
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isNavigationOpen: initialNavigationOpen(),
      isSidebarExpanded: true,
      isMobileDrawerOpen: false,
      expandedSections: initialExpandedSections(),

      setNavigationOpen: (open) => set({ isNavigationOpen: open }),
      toggleNavigation: () => set((s) => ({ isNavigationOpen: !s.isNavigationOpen })),

      setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
      toggleSidebarExpanded: () =>
        set((s) => ({ isSidebarExpanded: !s.isSidebarExpanded })),

      setMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),

      toggleSection: (label) =>
        set((s) => ({
          expandedSections: s.expandedSections.includes(label)
            ? s.expandedSections.filter((l) => l !== label)
            : [...s.expandedSections, label],
        })),
    }),
    {
      name: 'sidebarExpanded',
      version: 3,
      partialize: (state) => ({
        isSidebarExpanded: state.isSidebarExpanded,
        expandedSections: state.expandedSections,
      }),
      // Version 2 stored every section as open; sections now start closed, so
      // drop the old list rather than restoring a sidebar that looks unchanged.
      migrate: (persisted) => ({
        ...(persisted as SidebarState),
        expandedSections: [],
      }),
    },
  ),
)
