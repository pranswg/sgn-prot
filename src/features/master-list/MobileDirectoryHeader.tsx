import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MobileDirectoryHeaderProps {
  title: string
  description: string
  onOpenMenu: () => void
}

/**
 * Mobile screen header. It owns the top navigation for the Master List on its
 * own — menu button and title — so `Layout` hides its app bar on this page and
 * the two titles do not stack. Import and export live in the content area under
 * the KPI cards, not here.
 *
 * The negative margins cancel the `p-4 pt-5` gutter that `Layout` puts on the
 * page container, which is what lets a sticky, full-bleed bar sit flush with the
 * screen edges. `h-14` is fixed on purpose: the search bar below sticks at
 * `top-14`, so a header that grew would leave a gap showing content through it.
 */
export function MobileDirectoryHeader({
  title,
  description,
  onOpenMenu,
}: MobileDirectoryHeaderProps) {
  return (
    <header className="sticky top-0 z-30 -mx-4 -mt-5 flex h-14 shrink-0 items-center gap-1.5 border-b border-border/70 bg-background px-3 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open navigation"
        onClick={onOpenMenu}
      >
        <Menu className="size-4" />
      </Button>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight text-foreground">
          {title}
        </p>
        <p className="truncate text-[0.625rem] text-muted-foreground">
          {description}
        </p>
      </div>
    </header>
  )
}