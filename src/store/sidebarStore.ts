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
  setNavigationOpen: (open: boolean) => void
  toggleNavigation: () => void
  setSidebarExpanded: (expanded: boolean) => void
  toggleSidebarExpanded: () => void
  setMobileDrawerOpen: (open: boolean) => void
}

/**
 * Read once at module load. `isNavigationOpen` is intentionally NOT persisted:
 * the spec's default is the current viewport, so a reload re-evaluates it rather
 * than restoring a stale decision made on a different screen.
 */
function initialNavigationOpen(): boolean {
  if (typeof window === 'undefined') return true
  return defaultNavigationOpen(window.innerWidth)
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isNavigationOpen: initialNavigationOpen(),
      isSidebarExpanded: true,
      isMobileDrawerOpen: false,

      setNavigationOpen: (open) => set({ isNavigationOpen: open }),
      toggleNavigation: () => set((s) => ({ isNavigationOpen: !s.isNavigationOpen })),

      setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
      toggleSidebarExpanded: () =>
        set((s) => ({ isSidebarExpanded: !s.isSidebarExpanded })),

      setMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),
    }),
    {
      // Key name is the `localStorage.sidebarExpanded` the spec asked for.
      name: 'sidebarExpanded',
      version: 1,
      // Persist expansion only. Actions, the drawer flag, and
      // `isNavigationOpen` are left out so the viewport default above survives
      // a reload.
      partialize: (state) => ({ isSidebarExpanded: state.isSidebarExpanded }),
    },
  ),
)