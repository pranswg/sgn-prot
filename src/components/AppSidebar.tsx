import { useSidebarStore } from '@/store/sidebarStore'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { SidebarBody } from '@/components/sidebar/SidebarBody'
import { SidebarShell } from '@/components/sidebar/SidebarShell'

/**
 * Picks between the two layouts. They are deliberately not the same element:
 * on desktop the card sits in normal flow and pushes the content; on mobile it
 * is a Radix `Sheet`, because 72px of icons on a phone leaves nothing readable
 * and a push sidebar would starve the content. Splitting on `useIsMobile()` also
 * keeps the hidden desktop card out of the tree entirely on mobile, so there is
 * only one set of nav landmarks for a screen reader to walk.
 */
export function AppSidebar() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileDrawer /> : <DesktopSidebar />
}

function DesktopSidebar() {
  const isNavigationOpen = useSidebarStore((s) => s.isNavigationOpen)
  const isSidebarExpanded = useSidebarStore((s) => s.isSidebarExpanded)

  // `collapsed` is the icon-rail state, not visibility. A hidden card has width
  // 0 and is handled by `open` below.
  const collapsed = !isSidebarExpanded

  return (
    <SidebarShell collapsed={collapsed} open={isNavigationOpen}>
      <SidebarBody collapsed={collapsed} />
    </SidebarShell>
  )
}

function MobileDrawer() {
  const open = useSidebarStore((s) => s.isMobileDrawerOpen)
  const setOpen = useSidebarStore((s) => s.setMobileDrawerOpen)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        data-sidebar="sidebar"
        data-mobile="true"
        // The overlay is matched to the panel's 300ms so the dimming and the
        // slide read as one gesture instead of two.
        overlayClassName="duration-300"
        className="w-[280px] gap-0 bg-sidebar p-0 text-sidebar-foreground duration-300 ease-in-out [&>button]:hidden motion-reduce:transition-none"
      >
        {/* Radix requires both and warns in dev without them. */}
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Jump to a section of the choir manager.
        </SheetDescription>
        {/*
          The drawer is always the full-width version and has no collapse
          affordance; navigating closes it.
        */}
        <SidebarBody collapsed={false} showCollapseButton={false} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  )
}